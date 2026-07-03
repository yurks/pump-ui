import type { SocketAdapter, SocketConnectorStatus } from '$lib/socket/types';
import { createSocketAdapter } from '$lib/socket/adapter';
import {
	SOCKET_COMMANDS_QUEUE_MAX_SIZE,
	SOCKET_CONNECTION_HEARTBEAT_INTERVAL_MS,
	SOCKET_CONNECTION_HEARTBEAT_TIMEOUT_MS,
	SOCKET_DEFAULT_CONNECTION_TIMEOUT_MS,
	SOCKET_DEFAULT_RECONNECTION_BACKOFF_MULTIPLIER,
	SOCKET_DEFAULT_RECONNECTION_INITIAL_DELAY_MS,
	SOCKET_DEFAULT_RECONNECTION_MAX_DELAY_MS
} from '$lib/socket/config';

import { browser } from '$app/environment';

type Listener<T> = (value: T) => void;

type SocketConnectorOptions<TIncoming, TOutgoing> = {
	url: string;
	parse?: (raw: string) => TIncoming;
	validateIncoming?: (value: TIncoming) => void;
	serialize?: (message: TOutgoing) => string;
	onOpen?: () => void;
	connectTimeoutMs?: number;
	reconnect?: {
		initialDelayMs?: number;
		maxDelayMs?: number;
		backoffMultiplier?: number;
	};
	heartbeat?: {
		intervalMs?: number;
		timeoutMs?: number;
		command?: TOutgoing;
	};
	queue?: {
		maxSize?: number;
	};
	debug?: boolean;
	createSocket?: (url: string) => SocketAdapter;
};

export function createSocketConnector<
	TIncoming extends { cmd: string },
	TOutgoing extends { cmd: string }
>({
	url,
	parse = (raw) => JSON.parse(raw) as TIncoming,
	validateIncoming,
	serialize = (message) => JSON.stringify(message),
	onOpen,
	connectTimeoutMs = SOCKET_DEFAULT_CONNECTION_TIMEOUT_MS,
	reconnect = {},
	heartbeat = {},
	queue = {},
	debug = false,
	createSocket
}: SocketConnectorOptions<TIncoming, TOutgoing>) {
	const reconnectInitialDelayMs =
		reconnect.initialDelayMs ?? SOCKET_DEFAULT_RECONNECTION_INITIAL_DELAY_MS;
	const reconnectMaxDelayMs = reconnect.maxDelayMs ?? SOCKET_DEFAULT_RECONNECTION_MAX_DELAY_MS;
	const reconnectBackoffMultiplier =
		reconnect.backoffMultiplier ?? SOCKET_DEFAULT_RECONNECTION_BACKOFF_MULTIPLIER;

	const heartbeatIntervalMs = heartbeat.intervalMs ?? SOCKET_CONNECTION_HEARTBEAT_INTERVAL_MS;
	const heartbeatTimeoutMs = heartbeat.timeoutMs ?? SOCKET_CONNECTION_HEARTBEAT_TIMEOUT_MS;

	const queueMaxSize = queue.maxSize ?? SOCKET_COMMANDS_QUEUE_MAX_SIZE;

	const createSocketImpl = createSocket ?? createSocketAdapter;

	let socket: SocketAdapter | null = null;
	let status: SocketConnectorStatus = 'disconnected';
	let manuallyClosed = false;
	let reconnectAttempts = 0;

	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let connectTimeout: ReturnType<typeof setTimeout> | null = null;
	let heartbeatActive = false;
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

	const pending: TOutgoing[] = [];

	const messageListeners = new Set<Listener<TIncoming>>();
	const statusListeners = new Set<Listener<SocketConnectorStatus>>();
	const errorListeners = new Set<Listener<unknown>>();

	function log(...args: unknown[]) {
		if (debug) console.log('[socket:connector]', ...args);
	}

	function setStatus(next: SocketConnectorStatus) {
		status = next;

		for (const listener of statusListeners) {
			listener(next);
		}
	}

	function emitError(error: unknown) {
		for (const listener of errorListeners) {
			listener(error);
		}
	}

	function clearReconnectTimer() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	}

	function clearConnectTimeout() {
		if (connectTimeout) {
			clearTimeout(connectTimeout);
			connectTimeout = null;
		}
	}

	function stopHeartbeat() {
		heartbeatActive = false;
		if (heartbeatInterval) {
			clearTimeout(heartbeatInterval);
			heartbeatInterval = null;
		}

		if (heartbeatTimeout) {
			clearTimeout(heartbeatTimeout);
			heartbeatTimeout = null;
		}
	}

	function resetHeartbeatTimeout() {
		if (heartbeatTimeout) {
			clearTimeout(heartbeatTimeout);
		}

		heartbeatTimeout = setTimeout(() => {
			log('heartbeat timeout');
			socket?.close();
		}, heartbeatTimeoutMs);
	}

	function isOpen() {
		return socket?.readyState === WebSocket.OPEN;
	}

	function enqueue(message: TOutgoing) {
		if (pending.length >= queueMaxSize) {
			pending.shift();
		}

		pending.push(message);
	}

	function flushPending() {
		if (!isOpen()) return;

		while (pending.length > 0) {
			const message = pending.shift();
			if (!message) continue;

			socket!.send(serialize(message));
		}
	}

	function scheduleReconnect() {
		if (!browser || manuallyClosed) return;

		reconnectAttempts += 1;

		const baseDelay =
			reconnectInitialDelayMs * reconnectBackoffMultiplier ** (reconnectAttempts - 1);

		const cappedDelay = Math.min(baseDelay, reconnectMaxDelayMs);
		const jitter = cappedDelay * (0.1 + Math.random() * 0.2);
		const delay = Math.round(cappedDelay + jitter);

		setStatus('reconnecting');
		reconnectTimer = setTimeout(connect, delay);
	}

	function startHeartbeat(withTimeout = false) {
		if (!heartbeat.command) {
			return;
		}

		heartbeatActive = true;

		const ping = () => {
			if (!isOpen()) return;

			try {
				socket!.send(serialize(heartbeat.command!));
				resetHeartbeatTimeout();
			} catch (error) {
				emitError(error);
			}
		};

		if (withTimeout) {
			heartbeatInterval = setTimeout(ping, heartbeatIntervalMs);
		} else {
			ping();
		}
	}

	function connect() {
		if (!browser) return;

		// Prevent duplicate connection attempts.
		if (
			socket &&
			(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		clearReconnectTimer();
		clearConnectTimeout();
		manuallyClosed = false;

		setStatus(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

		try {
			socket = createSocketImpl(url);
		} catch (error) {
			setStatus('error');
			emitError(error);
			scheduleReconnect();
			return;
		}

		// Fail the current attempt if the socket stays in CONNECTING too long.
		connectTimeout = setTimeout(() => {
			log('connect timeout');
			setStatus('error');
			emitError(new Error('WebSocket connection timeout'));
			socket?.close();
		}, connectTimeoutMs);

		socket.onopen = () => {
			clearConnectTimeout();
			reconnectAttempts = 0;

			setStatus('connected');
			startHeartbeat();
			flushPending();
			onOpen?.();
		};

		socket.onmessage = (event) => {
			try {
				const message = parse(String(event.data));
				validateIncoming?.(message);
				// Any incoming message means the connection is alive
				if (heartbeat.command?.cmd === message.cmd) {
					if (!heartbeatActive) {
						return;
					}
					resetHeartbeatTimeout();
					startHeartbeat(true);
				}

				for (const listener of messageListeners) {
					listener(message);
				}
			} catch (error) {
				emitError(error);
			}
		};

		socket.onerror = (event) => {
			setStatus('error');
			emitError(event);
		};

		socket.onclose = () => {
			socket = null;

			clearConnectTimeout();
			clearReconnectTimer();
			stopHeartbeat();

			setStatus('disconnected');

			if (!manuallyClosed) {
				scheduleReconnect();
			}
		};
	}

	function disconnect() {
		manuallyClosed = true;

		clearReconnectTimer();
		clearConnectTimeout();
		stopHeartbeat();

		if (socket) {
			socket.close();
			socket = null;
		}

		setStatus('disconnected');
	}

	function send(message: TOutgoing, queueIfDisconnected = true) {
		if (isOpen()) {
			socket!.send(serialize(message));
			return;
		}

		if (queueIfDisconnected) {
			enqueue(message);
			return;
		}

		throw new Error('Socket is not connected');
	}

	function onMessage(listener: Listener<TIncoming>) {
		messageListeners.add(listener);
		return () => messageListeners.delete(listener);
	}

	function onStatus(listener: Listener<SocketConnectorStatus>) {
		statusListeners.add(listener);
		listener(status);
		return () => statusListeners.delete(listener);
	}

	function onError(listener: Listener<unknown>) {
		errorListeners.add(listener);
		return () => errorListeners.delete(listener);
	}

	return {
		startHeartbeat,
		stopHeartbeat,
		connect,
		disconnect,
		send,
		onMessage,
		onStatus,
		onError
	};
}
