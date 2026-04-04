import type { SocketConnectorStatus } from '$lib/socket/types';

type TimestampRecord = { ts: number };

export type DeviceClient = {
	socketStatus: SocketConnectorStatus;
	lastError: string | null;
	lastMessageAt: number | null;
	data: DeviceRemoteState | null;
	stale: boolean;
	initializedAt: number | null;
	updating: boolean;
};

export type DeviceClientMessage =
	| {
			type: 'update';
			payload: { controls: Partial<DeviceRemoteControls> };
	  }
	| {
			type: 'ping';
			payload: TimestampRecord;
	  };

export type DeviceServerMessage =
	| {
			type: 'state';
			payload: DeviceRemoteState;
	  }
	| {
			type: 'pong';
			payload: TimestampRecord;
	  }
	| {
			type: 'error';
			payload: { message: string; code?: string };
	  };

export type DeviceRemoteMetrics = {
	flags: string[];
	pressure: number;
	voltage: number;
	current: number;
	temperature: number;
};

export type DeviceRemoteControls = {
	enabled: boolean;
	pressure_limit: number;
	temp_limit: number;
	mode: 'auto' | 'manual';
};

export type DeviceRemoteInfo = {
	name: string;
	firmware: string;
};

export type DeviceRemoteState = {
	info: DeviceRemoteInfo;
	metrics: DeviceRemoteMetrics;
	controls: DeviceRemoteControls;
} & TimestampRecord;
