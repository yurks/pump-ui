import type { SocketConnectorStatus } from '$lib/socket/types';
import type { BlockLike } from 'typescript';

type TimestampRecord = { ts: number };

export type DeviceClient = {
	socketStatus: SocketConnectorStatus;
	lastError: string | null;
	lastMessageAt: number | null;
	data: DeviceCmd<TelemetryCmd | StateCmd | StatusCmd> | DeviceRemoteState | null;
	stale: boolean;
	initializedAt: number | null;
	updating: boolean;
};

export type DeviceClientMessage =
	| {
			type: 'cmd';
			payload: DeviceCmd<TelemetryCmd | StateCmd | StatusCmd>;
	  }
	| {
			type: 'ping';
			payload: TimestampRecord;
	  };

export type DeviceServerMessage =
	| {
			type: 'cmd_result';
			payload: DeviceCmd<TelemetryCmd | StateCmd | StatusCmd>;
	  }
	| {
			type: 'pong';
			payload: TimestampRecord;
	  }
	| {
			type: 'error';
			payload: { message: string; code?: string };
	  };

// esp8622 module info 
export type DeviceRemoteInfo = {
	name: string;
	firmware: string;
};

export type DeviceRemoteState = {
	info: DeviceRemoteInfo;
	wifi: DeviceRemoteWiFiInfo
} & TimestampRecord;

export type DeviceRemoteWiFiInfo = {

};

// Device Command types
export type DeviceCmd<T> = {
    cmd: string;
    error: string;
    data: T;
};

export type TelemetryCmd = {
	freqency: number;
	pressure: number;
	voltage: number;
	current: number;
	temperature: number;
	flow: boolean;
};

export type StateCmd = {
	DryWorkStop: boolean;
	PressureStop: boolean;
	temp_stop: boolean;
	user_stop: boolean;
};

export type StatusCmd = {
	hw_sw: {
		soft: string;
		hard: string;
	};
	PumpType: string;
};