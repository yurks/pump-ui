export type SocketConnectorStatus =
	| 'connecting'
	| 'reconnecting'
	| 'connected'
	| 'disconnected'
	| 'error';

export type SocketAdapter = {
	readyState: number;

	onopen: ((event: Event) => void) | null;
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: Event) => void) | null;
	onclose: ((event: CloseEvent) => void) | null;

	send(data: string): void;
	close(): void;
};
