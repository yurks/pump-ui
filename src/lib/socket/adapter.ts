import type { SocketAdapter } from '$lib/socket/types';

export function createSocketAdapter(url: string): SocketAdapter {
	return new WebSocket(url);
}
