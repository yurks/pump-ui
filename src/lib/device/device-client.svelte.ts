import { createSocketConnector } from '$lib/socket/connector';
import { validateDeviceServerMessage } from '$lib/device/validations';

import {
	type DeviceClient,
	type DeviceClientMessage,
	type DeviceRemoteState,
	type DeviceServerMessage,
	type DeviceCmd,
	type TelemetryCmd,
	type StateCmd,
	type StatusCmd,
	type DeviceCmdPatch
} from './types.ts';

import { browser } from '$app/environment';

type DeviceClientOptions = {
	// WS endpoint for device stream / commands.
	url: string;

	// How long incoming metrics can be absent before state becomes stale.
	staleDataAfterMs?: number;

	// How long we wait for the next authoritative server response after update().
	updateTimeoutMs?: number;

	// Connector debug logs.
	debug?: boolean;
};

type PendingUpdate = {
	timeoutId: ReturnType<typeof setTimeout>;
	resolve: () => void;
	reject: (error: Error) => void;
};

const STALE_CHECK_INTERVAL_MS = 1000;
const DEFAULT_STALE_DATA_AFTER_MS = 5_000;
const DEFAULT_UPDATE_TIMEOUT_MS = 5_000;

export function createDeviceClient({
	url,
	staleDataAfterMs = DEFAULT_STALE_DATA_AFTER_MS,
	updateTimeoutMs = DEFAULT_UPDATE_TIMEOUT_MS,
	debug = false
}: DeviceClientOptions) {
	const state = $state<DeviceClient>({
		socketStatus: 'disconnected',
		data: null,
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
			createPingMessage: () => ({
				type: 'ping',
				payload: { ts: Date.now() }
			})
		}
	});

	let unsubscribeMessage: (() => void) | null = null;
	let unsubscribeStatus: (() => void) | null = null;
	let unsubscribeError: (() => void) | null = null;
	let staleCheckTimer: ReturnType<typeof setInterval> | null = null;
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

	function applyRemoteState(nextState: DeviceCmd<TelemetryCmd | StateCmd | StatusCmd>) {
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

	function resolvePendingUpdate() {
		clearPendingUpdate()?.resolve();
	}

	function rejectPendingUpdate(message: string) {
		setLastError(message);
		clearPendingUpdate()?.reject(new Error(message));
	}

	function startStaleCheckTimer() {
		stopStaleCheckTimer();
		staleCheckTimer = setInterval(refreshStaleFlag, STALE_CHECK_INTERVAL_MS);
	}

	function stopStaleCheckTimer() {
		if (!staleCheckTimer) return;

		clearInterval(staleCheckTimer);
		staleCheckTimer = null;
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
		});

		unsubscribeError = connector.onError((error) => {
			const message = error instanceof Error ? error.message : 'Socket error';
			setLastError(message);

			if (pendingUpdate) {
				rejectPendingUpdate(`Update interrupted: ${message}`);
			}
		});

		unsubscribeMessage = connector.onMessage((message) => {
			switch (message.type) {
				case 'cmd_result': {
					applyRemoteState(message.payload);
					resolvePendingUpdate();
					break;
				}

				case 'pong': {
					// Heartbeat was answered, so transport is alive.
					// We do not touch lastMessageAt here because metrics freshness and
					// socket liveness are different concepts.
					setLastError(null);
					break;
				}

				case 'error': {
					rejectPendingUpdate(message.payload.message);
					break;
				}
			}
		});

		startStaleCheckTimer();
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
		connector.disconnect();

		state.initializedAt = null;
		state.socketStatus = 'disconnected';
		state.stale = true;
		state.updating = false;
	}

	async function update<T>(controlsPatch: DeviceCmdPatch<T>): Promise<void> {
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
				connector.send({
					type: 'cmd',
					payload: controlsPatch
				});
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
