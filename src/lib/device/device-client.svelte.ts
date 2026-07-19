import { createSocketConnector } from '$lib/socket/connector';
import { validateDeviceServerMessage } from '$lib/device/validations';
import {
	DEVICE_DEFAULT_STALE_DATA_AFTER_MS,
	DEVICE_DEFAULT_TELEMETRY_POLL_INTERVAL_MS,
	DEVICE_DEFAULT_UPDATE_TIMEOUT_MS,
	DEVICE_STALE_CHECK_INTERVAL_MS
} from '$lib/device/config';

import {
	type DeviceClient,
	type DeviceClientMessage,
	type DeviceRemoteControls,
	type DeviceRemoteMonitor,
	type DeviceServerMessage
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
	let pendingUpdate: PendingUpdate | null = null;

	function setLastError(message: string | null) {
		state.lastError = message;
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
		setLastError(null);
		refreshStaleFlag();
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
		setLastError(message);
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

				case 'pump:toggle':
				case 'pump:update': {
					// Authoritative ack for our in-flight update: an update is
					// atomic and completes on its own response, not on the next
					// telemetry snapshot.
					const resolved = clearPendingUpdate();
					if (resolved) {
						resolved.resolve();
						// Reflect the applied change without waiting for the next tick.
						pollTelemetry();
					}
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
		connector.disconnect();

		state.initializedAt = null;
		state.socketStatus = 'disconnected';
		state.stale = true;
		state.updating = false;
	}

	async function update(controlsPatch: Partial<DeviceRemoteControls> | 'toggle'): Promise<void> {
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
					connector.send({ cmd: 'pump:update', data: { controls: controlsPatch } });
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
