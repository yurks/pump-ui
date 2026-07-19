import { createSocketConnector } from '$lib/socket/connector';
import { validateDeviceServerMessage } from '$lib/device/validations';
import {
	DEVICE_DEFAULT_STALE_DATA_AFTER_MS,
	DEVICE_DEFAULT_TELEMETRY_POLL_INTERVAL_MS,
	DEVICE_DEFAULT_UPDATE_TIMEOUT_MS,
	DEVICE_ERROR_DISPLAY_MS,
	DEVICE_STALE_CHECK_INTERVAL_MS
} from '$lib/device/config';

import {
	type DeviceClient,
	type DeviceClientMessage,
	type DeviceConfigParam,
	type DeviceConfigValue,
	type DeviceRemoteMonitor,
	type DeviceServerMessage,
	type DeviceSetParam
} from './types.ts';

import { browser } from '$app/environment';

type DeviceClientOptions = {
	// WS endpoint for device stream / commands.
	url: string;

	// How long incoming metrics can be absent before state becomes stale.
	staleDataAfterMs?: number;

	// How long we wait for the next authoritative server response after update().
	updateTimeoutMs?: number;

	// How often we poll the device for a fresh telemetry snapshot.
	pollIntervalMs?: number;

	// Connector debug logs.
	debug?: boolean;
};

type PendingUpdate = {
	timeoutId: ReturnType<typeof setTimeout>;
	resolve: () => void;
	reject: (error: Error) => void;
};

export function createDeviceClient({
	url,
	staleDataAfterMs = DEVICE_DEFAULT_STALE_DATA_AFTER_MS,
	updateTimeoutMs = DEVICE_DEFAULT_UPDATE_TIMEOUT_MS,
	pollIntervalMs = DEVICE_DEFAULT_TELEMETRY_POLL_INTERVAL_MS,
	debug = false
}: DeviceClientOptions) {
	const state = $state<DeviceClient>({
		socketStatus: 'disconnected',
		data: null,
		info: null,
		controls: null,
		stale: true,
		lastError: null,
		lastMessageAt: null,
		initializedAt: null,
		updating: false
	});

	const connector = createSocketConnector<DeviceServerMessage, DeviceClientMessage>({
		url,
		debug,
		validateIncoming: validateDeviceServerMessage,
		reconnect: {
			// Real backoff is safer for prod than constant retry spam.
			initialDelayMs: 1_000,
			maxDelayMs: 10_000,
			backoffMultiplier: 1.2
		},
		heartbeat: {
			// Transport-level liveness only. Kept separate from telemetry so a
			// slow/idle device stream never looks like a dead socket.
			ping: 'ping',
			pong: 'pong'
		}
	});

	let unsubscribeMessage: (() => void) | null = null;
	let unsubscribeStatus: (() => void) | null = null;
	let unsubscribeError: (() => void) | null = null;
	let staleCheckTimer: ReturnType<typeof setInterval> | null = null;
	let telemetryTimer: ReturnType<typeof setInterval> | null = null;
	let errorClearTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingUpdate: PendingUpdate | null = null;

	function clearErrorTimer() {
		if (!errorClearTimer) return;

		clearTimeout(errorClearTimer);
		errorClearTimer = null;
	}

	function setLastError(message: string | null) {
		clearErrorTimer();
		state.lastError = message;
	}

	// Show an error briefly, then auto-clear it. Used for one-off device errors
	// (the `error` command and command-level failures) that are not tied to the
	// ongoing connection state, so they should not linger on screen forever.
	function showError(message: string) {
		clearErrorTimer();
		state.lastError = message;
		errorClearTimer = setTimeout(() => {
			state.lastError = null;
			errorClearTimer = null;
		}, DEVICE_ERROR_DISPLAY_MS);
	}

	function refreshStaleFlag() {
		if (!state.data || !state.lastMessageAt) {
			state.stale = true;
			return;
		}

		const ageMs = Date.now() - state.lastMessageAt;
		state.stale = ageMs > staleDataAfterMs;
	}

	function applyRemoteState(nextState: DeviceRemoteMonitor) {
		// We deliberately use local receipt time, not payload.ts.
		// Remote clocks drift. Humans also drift, but usually with worse excuses.
		state.data = nextState;
		state.lastMessageAt = Date.now();
		// Healthy telemetry clears a lingering connection error, but never stomps
		// a transient device error that is still counting down its display timer.
		if (!errorClearTimer) {
			setLastError(null);
		}
		refreshStaleFlag();
	}

	// Config values are read one param at a time via pump:config_get. The list
	// of params (names only) arrives up front from pump:config_list.
	function requestConfigValues(names: string[]) {
		for (const name of names) {
			try {
				connector.send({ cmd: 'pump:config_get', data: [{ name }] });
			} catch {
				// Not connected right now; the status listener drives recovery.
			}
		}
	}

	// Merge freshly read params into the known list without dropping the order
	// we got from pump:config_list. config_list only carries names, so the value
	// read also carries the metadata (label, type, measure, multiplier, options).
	function applyConfigValues(params: DeviceConfigParam[]) {
		const controls = state.controls;
		if (!controls) return;

		for (const param of params) {
			const existing = controls.find((c) => c.name === param.name);
			if (existing) {
				Object.assign(existing, param);
			} else {
				controls.push({ ...param });
			}
		}
	}

	function clearPendingUpdate() {
		const current = pendingUpdate;
		if (!current) return null;

		pendingUpdate = null;
		clearTimeout(current.timeoutId);
		state.updating = false;

		return current;
	}

	function rejectPendingUpdate(message: string) {
		showError(message);
		clearPendingUpdate()?.reject(new Error(message));
	}

	function startStaleCheckTimer() {
		stopStaleCheckTimer();
		staleCheckTimer = setInterval(refreshStaleFlag, DEVICE_STALE_CHECK_INTERVAL_MS);
	}

	function stopStaleCheckTimer() {
		if (!staleCheckTimer) return;

		clearInterval(staleCheckTimer);
		staleCheckTimer = null;
	}

	// Telemetry is polled on its own cadence, independent from the socket
	// heartbeat. The server answers with a `pump:monitor` snapshot.
	function pollTelemetry() {
		if (state.socketStatus !== 'connected') return;

		try {
			connector.send({ cmd: 'pump:monitor' }, false);
		} catch {
			// Not connected right now; the status listener drives recovery.
		}
	}

	function startTelemetryPoll() {
		stopTelemetryPoll();
		telemetryTimer = setInterval(pollTelemetry, pollIntervalMs);
	}

	function stopTelemetryPoll() {
		if (!telemetryTimer) return;

		clearInterval(telemetryTimer);
		telemetryTimer = null;
	}

	function initialize() {
		if (!browser || state.initializedAt) return;

		state.initializedAt = Date.now();

		unsubscribeStatus = connector.onStatus((nextStatus) => {
			state.socketStatus = nextStatus;

			// If we have never received data, mark the client as stale immediately
			// once the socket starts moving, so UI does not pretend everything is fresh.
			if (!state.lastMessageAt && nextStatus !== 'connected') {
				state.stale = true;
			}

			if (pendingUpdate && nextStatus !== 'connected') {
				rejectPendingUpdate(`Update interrupted: socket ${nextStatus}`);
			}

			// On every (re)connect refresh device info and grab a telemetry
			// snapshot right away instead of waiting for the next poll tick.
			if (nextStatus === 'connected') {
				connector.send({ cmd: 'pump:info' });
				connector.send({ cmd: 'pump:config_list' });
				pollTelemetry();
			}
		});

		unsubscribeError = connector.onError((error) => {
			const message = error instanceof Error ? error.message : 'Socket error';
			setLastError(message);

			if (pendingUpdate) {
				rejectPendingUpdate(`Update interrupted: ${message}`);
			}
		});

		unsubscribeMessage = connector.onMessage((message) => {
			switch (message.cmd) {
				case 'pump:monitor': {
					applyRemoteState(message.data);
					break;
				}

				case 'pump:info': {
					state.info = message.data;
					break;
				}

				case 'pump:config_list': {
					state.controls = message.data;
					// Fetch the current value for every listed param.
					requestConfigValues(message.data.map((param) => param.name));
					break;
				}

				case 'pump:config_get': {
					applyConfigValues(message.data);
					break;
				}

				case 'pump:toggle': {
					// A root-level error means the toggle was refused; fail fast
					// instead of waiting for the update to time out.
					if (message.error) {
						rejectPendingUpdate(message.error);
						break;
					}
					// Toggle replies with the fresh motor state, so we reflect it
					// immediately instead of waiting for the next telemetry snapshot.
					if (state.data) {
						state.data.status.motor_current_state = message.data.motor_current_state;
					}
					clearPendingUpdate()?.resolve();
					break;
				}

				case 'pump:config_set': {
					// A root-level error means the write was rejected; fail fast
					// instead of waiting for the update to time out.
					if (message.error) {
						rejectPendingUpdate(message.error);
						break;
					}
					// Authoritative ack for our in-flight update: an update is
					// atomic and completes on its own response. We do not wait for
					// the next telemetry snapshot to consider it done.
					clearPendingUpdate()?.resolve();
					// Re-read the values the device reports as updated.
					requestConfigValues(message.data);
					break;
				}

				case 'error': {
					// Unsolicited/unexpected problem, not tied to a request. Just
					// surface it transiently.
					showError(message.data.message);
					break;
				}
			}
		});

		startStaleCheckTimer();
		startTelemetryPoll();
		connector.connect();
	}

	function destroy() {
		unsubscribeMessage?.();
		unsubscribeStatus?.();
		unsubscribeError?.();

		unsubscribeMessage = null;
		unsubscribeStatus = null;
		unsubscribeError = null;

		if (pendingUpdate) {
			rejectPendingUpdate('Device client destroyed');
		}

		stopStaleCheckTimer();
		stopTelemetryPoll();
		clearErrorTimer();
		connector.disconnect();

		state.initializedAt = null;
		state.socketStatus = 'disconnected';
		state.stale = true;
		state.updating = false;
	}

	async function update(
		controlsPatch: Record<string, DeviceConfigValue> | 'toggle'
	): Promise<void> {
		if (pendingUpdate || state.updating) {
			const message = 'Update already in progress';
			setLastError(message);
			throw new Error(message);
		}

		if (state.socketStatus !== 'connected') {
			const message = `Cannot update while socket is ${state.socketStatus}`;
			setLastError(message);
			throw new Error(message);
		}

		state.updating = true;
		setLastError(null);

		return new Promise<void>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				rejectPendingUpdate(`Update timed out after ${updateTimeoutMs}ms`);
			}, updateTimeoutMs);

			pendingUpdate = {
				timeoutId,
				resolve,
				reject
			};

			try {
				if (controlsPatch === 'toggle') {
					connector.send({ cmd: 'pump:toggle' });
				} else {
					const params: DeviceSetParam[] = Object.entries(controlsPatch)
						.filter(([, value]) => value !== undefined)
						.map(([name, value]) => ({ name, value: value as DeviceSetParam['value'] }));
					connector.send({ cmd: 'pump:config_set', data: params });
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to send update';
				rejectPendingUpdate(message);
			}
		});
	}

	return {
		state,
		initialize,
		destroy,
		update
	};
}
