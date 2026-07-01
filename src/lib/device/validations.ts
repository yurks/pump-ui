import type { DeviceServerMessage } from '$lib/device/types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Runtime validation for incoming WebSocket messages.
 * TypeScript does not protect data received over the network.
 */
export function validateDeviceServerMessage(msg: unknown) {
	if (!isRecord(msg) || !isRecord(msg.payload) || typeof msg.type !== 'string') {
		console.error('Invalid message received:', msg);
		throw new Error(`Invalid message received`);
	}

	const value = msg as DeviceServerMessage;

	if (
		value.type === 'cmd_result' &&
		isRecord(value.payload)
	) {
		return;
	}

	if (value.type === 'pong' && typeof value.payload.ts === 'number') {
		return;
	}

	if (value.type === 'error' && typeof value.payload.message === 'string') {
		return;
	}

	throw new Error(`Unknown message received (type: ${value.type})`);
}
