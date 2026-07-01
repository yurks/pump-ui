import type {
	DeviceClientMessage,
	DeviceServerMessage,
	DeviceRemoteState,
	DeviceCmd,
	TelemetryCmd
} from '$lib/device/types';

/*
{"cmd":"status","error":"NO_ERRORS","data":{"hw_sw":{"soft":"SW: 2.60","hard":"HW: 2.0"},"PumpType":3}}
{"cmd":"state","error":"NO_ERRORS","data":{"DryWorkStop":false,"PressureStop":false,"temp_stop":false,"user_stop":false}}
{"cmd":"telemetry","error":"NO_ERRORS","data":{"freq":20,"voltage":219,"current":0.00,"pressure":0.17,"temperature":27,"flow":0}}

{"cmd":"some_command","error":"ERROR","data":{payload}}
*/

export function createMockDeviceServer() {
	let device: DeviceCmd<TelemetryCmd> = {
		cmd: "",
		error: "",
		data: <TelemetryCmd> {
			freqency: 40,
			pressure: 1.4,
			voltage: 213,
			current: 4,
			temperature: 21,
			flow: true
		}
	};

	function snapshot(): DeviceCmd<TelemetryCmd> {
		return device;
	}

	function tick(): void {
		const nextTemp = Number((device.data.temperature + (Math.random() - 0.5) * 0.6).toFixed(1));
		const nextVoltage = Number((device.data.voltage + (Math.random() - 0.5) * 10).toFixed());
		const nextCurrent = Number((device.data.current + (Math.random() - 0.5) * 100).toFixed());
		const nextPressure = Number((device.data.pressure + (Math.random() - 0.5) * 3).toFixed(1));

		device = {
			...device,
			data: {
				...device.data,
				pressure: nextPressure,
				voltage: nextVoltage,
				current: nextCurrent,
				temperature: nextTemp
			},
		};
	}

	function handle(message: DeviceClientMessage): DeviceServerMessage {
		switch (message.type) {
			case 'ping':
				return {
					type: 'pong',
					payload: { ts: Date.now() }
				};

			case 'cmd':
				device = {
					...device
				};

				return {
					type: 'cmd_result',
					payload: snapshot()
				};
		}
	}

	return {
		snapshot,
		tick,
		handle
	};
}
