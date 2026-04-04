import type { SocketAdapter, SocketConnectorStatus } from '$lib/socket/types';
import { createSocketAdapter } from '$lib/socket/adapter';

import { browser } from '$app/environment';

type Listener<T> = (value: T) => void;

type SocketConnectorOptions<TIncoming, TOutgoing> = {
	url: string;
	parse?: (raw: string) => TIncoming;
	validateIncoming?: (value: unknown) => void;
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
		createPingMessage?: () => TOutgoing;
	};
	queue?: {
		maxSize?: number;
	};
	debug?: boolean;
	createSocket?: (url: string) => SocketAdapter;
};

export function createSocketConnector<TIncoming, TOutgoing>({
	url,
	parse = (raw) => JSON.parse(raw) as TIncoming,
	validateIncoming,
	serialize = (message) => JSON.stringify(message),
	onOpen,
	connectTimeoutMs = 8000,
	reconnect = {},
	heartbeat = {},
	queue = {},
	debug = false,
	createSocket
}: SocketConnectorOptions<TIncoming, TOutgoing>) {
	const reconnectInitialDelayMs = reconnect.initialDelayMs ?? 1000;
	const reconnectMaxDelayMs = reconnect.maxDelayMs ?? 15000;
	const reconnectBackoffMultiplier = reconnect.backoffMultiplier ?? 1.8;

	const heartbeatIntervalMs = heartbeat.intervalMs ?? 5000;
	const heartbeatTimeoutMs = heartbeat.timeoutMs ?? 3000;

	const queueMaxSize = queue.maxSize ?? 100;

	const createSocketImpl = createSocket ?? createSocketAdapter;

	let socket: SocketAdapter | null = null;
	let status: SocketConnectorStatus = 'disconnected';
	let manuallyClosed = false;
	let reconnectAttempts = 0;

	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let connectTimeout: ReturnType<typeof setTimeout> | null = null;
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

	function clearHeartbeat() {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
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

	function startHeartbeat() {
		if (!heartbeat.createPingMessage) {
			return;
		}

		heartbeatInterval = setInterval(() => {
			if (!isOpen()) return;

			try {
				socket!.send(serialize(heartbeat.createPingMessage!()));
				resetHeartbeatTimeout();
			} catch (error) {
				emitError(error);
			}
		}, heartbeatIntervalMs);
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
				if (heartbeat.createPingMessage) {
					resetHeartbeatTimeout();
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
			clearHeartbeat();

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
		clearHeartbeat();

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
		connect,
		disconnect,
		send,
		onMessage,
		onStatus,
		onError
	};
}
