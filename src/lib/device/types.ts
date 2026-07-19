import type { SocketConnectorStatus } from '$lib/socket/types';

export type DeviceClient = {
	socketStatus: SocketConnectorStatus;
	lastError: string | null;
	lastMessageAt: number | null;
	data: DeviceRemoteMonitor | null;
	info: DeviceRemoteInfo | null;
	controls: DeviceConfigParam[] | null;
	stale: boolean;
	initializedAt: number | null;
	updating: boolean;
};

export type DeviceSetParam = {
	name: string;
	value: number | string | boolean;
};

// A single configuration parameter. `value` is absent in listings
// (pump:config_list) and present when reading values (pump:config_get).
export type DeviceConfigParam = {
	name: string;
	value?: string;
};

export type DeviceClientMessage =
	| { cmd: 'pump:config_set'; data: DeviceSetParam[] }
	| { cmd: 'pump:config_get'; data: { name: string }[] }
	| { cmd: 'pump:config_list' }
	| { cmd: 'pump:toggle' }
	| { cmd: 'pump:monitor' }
	| { cmd: 'pump:info' }
	| { cmd: 'ping' };

export type DeviceServerMessage =
	| { cmd: 'pump:config_set'; data: string[] }
	| { cmd: 'pump:config_get'; data: DeviceConfigParam[] }
	| { cmd: 'pump:config_list'; data: DeviceConfigParam[] }
	| { cmd: 'pump:toggle'; data: { motor_current_state: number } }
	| { cmd: 'pump:monitor'; data: DeviceRemoteMonitor }
	| { cmd: 'pump:info'; data: DeviceRemoteInfo }
	| { cmd: 'pong' }
	| { cmd: 'error'; data: DeviceRemoteError };

export type DeviceRemoteMonitorMetrics = {
	voltage: number;
	current: number;
	frequency: number;
	pressure: number;
	temperature: number;
	flow: number;
};

export type DeviceRemoteMonitorStatus = {
	DryWorkStop: boolean;
	PressureStop: boolean;
	temp_stop: boolean;
	user_stop: boolean;
	motor_current_state: number;
};

export type DeviceRemoteControls = {
	pressure_limit: number;
	temp_limit: number;
	mode: 'auto' | 'manual';
};

export type DeviceRemoteInfo = {
	name: string;
	firmware_hw: string;
	firmware_sw: string;
	type: number;
};

export type DeviceRemoteError = {
	message: string;
	code: number;
};

export type DeviceRemoteMonitor = {
	metrics: DeviceRemoteMonitorMetrics;
	status: DeviceRemoteMonitorStatus;
	error: DeviceRemoteError;
};
