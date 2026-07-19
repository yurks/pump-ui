import type { SocketConnectorStatus } from '$lib/socket/types';

export type DeviceClient = {
	socketStatus: SocketConnectorStatus;
	lastError: string | null;
	lastMessageAt: number | null;
	data: DeviceRemoteMonitor | null;
	info: DeviceRemoteInfo | null;
	controls: DeviceRemoteControls | null;
	stale: boolean;
	initializedAt: number | null;
	updating: boolean;
};

export type DeviceClientMessage =
	| { cmd: 'pump:update'; data: { controls: Partial<DeviceRemoteControls> } }
	| { cmd: 'pump:toggle' }
	| { cmd: 'pump:monitor' }
	| { cmd: 'pump:info' }
	| { cmd: 'ping' };

export type DeviceServerMessage =
	| { cmd: 'pump:update'; data: Record<string, unknown> }
	| { cmd: 'pump:toggle'; data: Record<string, unknown> }
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
