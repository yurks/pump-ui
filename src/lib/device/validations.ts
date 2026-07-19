import type { DeviceServerMessage } from '$lib/device/types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Runtime validation for incoming WebSocket messages.
 * TypeScript does not protect data received over the network.
 */
export function validateDeviceServerMessage(msg: DeviceServerMessage) {
	if (!isRecord(msg) || typeof msg.cmd !== 'string') {
		console.error('Invalid message received:', msg);
		throw new Error(`Invalid message received`);
	}
	const value = msg as DeviceServerMessage;

	// Pong is a data-less liveness reply.
	if (value.cmd === 'pong') {
		return;
	}

	if (!isRecord(value.data)) {
		console.error('Invalid message received:', msg);
		throw new Error(`Invalid message received`);
	}

	if (
		value.cmd === 'pump:monitor' &&
		isRecord(value.data.status) &&
		isRecord(value.data.metrics) &&
		isRecord(value.data.error)
	) {
		return;
	}

	if (
		(value.cmd === 'pump:config_set' ||
			value.cmd === 'pump:config_get' ||
			value.cmd === 'pump:config_list') &&
		Array.isArray(value.data)
	) {
		return;
	}

	if (value.cmd === 'pump:toggle' || value.cmd === 'pump:info') {
		return;
	}

	if (value.cmd === 'error' && typeof value.data.message === 'string') {
		return;
	}

	throw new Error(`Unknown message received (cmd: ${value.cmd})`);
}
