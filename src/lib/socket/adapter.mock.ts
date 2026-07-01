import type { SocketAdapter } from '$lib/socket/types';
import type { DeviceClientMessage, DeviceServerMessage } from '$lib/device/types';

import { createMockDeviceServer } from '../device/device-server.dev-mock.ts';

type MockSocketOptions = {
	connectDelayMs?: number;
	requestLatencyMs?: number;
	telemetryIntervalMs?: number;
};

const options: MockSocketOptions = {
	connectDelayMs: 300,
	requestLatencyMs: 1000,
	telemetryIntervalMs: 2000
};

function createOpenEvent(): Event {
	return new Event('open');
}

function createErrorEvent(): Event {
	return new Event('error');
}

function createCloseEvent(): CloseEvent {
	return new CloseEvent('close');
}

function createMessageEvent(data: string): MessageEvent {
	return new MessageEvent('message', { data });
}

const server = createMockDeviceServer();

export function createSocketAdapter(_url: string): SocketAdapter {
	let closed = false;
	let pendingRequests = 0;
	let pushTimer: ReturnType<typeof setInterval> | null = null;
	let openTimer: ReturnType<typeof setTimeout> | null = null;

	const socket: SocketAdapter = {
		readyState: WebSocket.CONNECTING,

		onopen: null,
		onmessage: null,
		onerror: null,
		onclose: null,

		send(data: string) {
			if (closed || socket.readyState !== WebSocket.OPEN) {
				throw new Error('Mock socket is not open');
			}

			let message: DeviceClientMessage;

			try {
				message = JSON.parse(data) as DeviceClientMessage;
			} catch {
				socket.onerror?.(createErrorEvent());
				return;
			}

			pendingRequests += 1;

			setTimeout(() => {
				try {
					if (closed || socket.readyState !== WebSocket.OPEN) return;

					try {
						const response: DeviceServerMessage = server.handle(message);
						socket.onmessage?.(createMessageEvent(JSON.stringify(response)));
					} catch {
						const fallback: DeviceServerMessage = {
							type: 'error',
							payload: { message: 'Mock server failed to process message' }
						};

						socket.onmessage?.(createMessageEvent(JSON.stringify(fallback)));
					}
				} finally {
					pendingRequests = Math.max(0, pendingRequests - 1);
				}
			}, options.requestLatencyMs);
		},

		close() {
			if (closed) return;

			closed = true;
			socket.readyState = WebSocket.CLOSED;

			if (openTimer) clearTimeout(openTimer);
			if (pushTimer) clearInterval(pushTimer);

			socket.onclose?.(createCloseEvent());
		}
	};

	openTimer = setTimeout(() => {
		if (closed) return;

		socket.readyState = WebSocket.OPEN;
		socket.onopen?.(createOpenEvent());

		pushTimer = setInterval(() => {
			if (closed || socket.readyState !== WebSocket.OPEN) return;
			if (pendingRequests > 0) return;

			server.tick();

			const message: DeviceServerMessage = {
				type: 'cmd_result',
				payload: server.snapshot()
			};

			socket.onmessage?.(createMessageEvent(JSON.stringify(message)));
		}, options.telemetryIntervalMs);
	}, options.connectDelayMs);

	return socket;
}
