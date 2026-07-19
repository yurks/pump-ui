import { createDeviceClient } from '$lib/device/device-client.svelte';

import { browser } from '$app/environment';

function getWsUrl() {
	if (!browser) {
		throw new Error('Cannot compute wsUrl on server');
	}

	const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${protocol}//${location.hostname}:81`;
}

export const device = createDeviceClient({
	url: getWsUrl(),
	debug: false
});

export const deviceState = device.state;
export const deviceUpdate = device.update;
