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

// A config parameter's value is always a number or text.
// Booleans are encoded as 0/1.
export type DeviceConfigValue = number | string;

export type DeviceSetParam = {
	name: string;
	value: DeviceConfigValue;
};

// A parameter is either a free numeric/text value or a bounded/enumerated one.
// Booleans are represented as numeric 0/1, never as a real boolean.
export type DeviceConfigParamType = 'number' | 'text';

// A selectable option for enumerated params (e.g. Auto/Manual/Off).
export type DeviceConfigParamOptionItem = {
	id: number;
	value: string;
};

// Constraints / choices for a param. Every field is optional.
export type DeviceConfigParamOptions = {
	min?: number;
	max?: number;
	step?: number;
	items?: DeviceConfigParamOptionItem[];
};

// A single configuration parameter. `value` is absent in listings
// (pump:config_list) and present when reading values (pump:config_get).
// `label`, `measure`, `multiplier` and `options` are optional metadata.
export type DeviceConfigParam = {
	name: string;
	value?: DeviceConfigValue;
	label?: string;
	type?: DeviceConfigParamType;
	measure?: string;
	multiplier?: number;
	options?: DeviceConfigParamOptions;
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
	// Command responses may carry a root-level `error` string. When present the
	// command failed and the message is surfaced transiently (see showError).
	| { cmd: 'pump:config_set'; data: string[]; error?: string }
	| { cmd: 'pump:config_get'; data: DeviceConfigParam[] }
	| { cmd: 'pump:config_list'; data: DeviceConfigParam[] }
	| { cmd: 'pump:toggle'; data: { motor_current_state: number }; error?: string }
	| { cmd: 'pump:monitor'; data: DeviceRemoteMonitor }
	| { cmd: 'pump:info'; data: DeviceRemoteInfo }
	| { cmd: 'pong' }
	// Unsolicited/unexpected problem not tied to a specific request.
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
