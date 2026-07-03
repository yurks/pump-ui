import type {
	DeviceClientMessage,
	DeviceServerMessage,
	DeviceRemoteMonitor,
	DeviceRemoteInfo
} from '$lib/device/types';

/*
// {"cmd":"error","data":{"error":"NO_ERRORS"}
{"cmd":"status","data":{"hw_sw":{"soft":"SW: 2.60","hard":"HW: 2.0"},"PumpType":3}}
{"cmd":"state",""data":{"DryWorkStop":false,"PressureStop":false,"temp_stop":false,"user_stop":false}}
{"cmd":"telemetry","data":{"freq":20,"voltage":219,"current":0.00,"pressure":0.17,"temperature":27,"flow":0,"error":"NO_ERRORS"}}
{"cmd": "pump","data":{}}
*/

export function createMockDeviceServer() {
	const deviceInfo: DeviceRemoteInfo = {
		name: 'Mock Magnetik PSM-100',
		firmware_hw: 'HW: 2.0',
		firmware_sw: 'SW: 2.60',
		type: 3
	};

	let device: DeviceRemoteMonitor = {
		metrics: {
			voltage: 215,
			current: 1000,
			frequency: 50,
			pressure: 48,
			temperature: 22.4,
			flow: 1
		},
		status: {
			DryWorkStop: false,
			PressureStop: false,
			temp_stop: false,
			user_stop: false
		},
		error: { message: 'NO_ERROR', code: 0 }
	};

	function snapshot(): DeviceRemoteMonitor {
		return device;
	}

	function tick(): void {
		const nextTemp = Number((device.metrics.temperature + (Math.random() - 0.5) * 0.6).toFixed(1));
		const nextVoltage = Number((device.metrics.voltage + (Math.random() - 0.5) * 10).toFixed());
		const nextCurrent = Number((device.metrics.current + (Math.random() - 0.5) * 100).toFixed());
		const nextPressure = Number((device.metrics.pressure + (Math.random() - 0.5) * 3).toFixed(1));

		if (nextVoltage > 225) {
			device.error.message = 'OVER_VOLT';
			device.error.code = 1;
		} else if (nextPressure > 50) {
			device.error.message = 'HIGH_PRESSURE';
			device.error.code = 2;
		} else if (nextTemp > 22.1) {
			device.error.message = 'HIGH_TEMP';
			device.error.code = 3;
		} else {
			device.error.message = 'NO_ERRORS';
			device.error.code = 0;
		}

		device = {
			...device,
			metrics: {
				...device.metrics,
				pressure: nextPressure,
				voltage: nextVoltage,
				current: nextCurrent,
				temperature: nextTemp
			}
		};
	}

	function handle(message: DeviceClientMessage): DeviceServerMessage {
		switch (message.cmd) {
			case 'pump:update':
				break;

			case 'pump:toggle':
				device.status.user_stop = !device.status.user_stop;
				break;

			case 'pump:info':
				return { cmd: message.cmd, data: deviceInfo };

			case 'pump:monitor':
				tick();
				return { cmd: message.cmd, data: snapshot() };
		}

		return { cmd: message.cmd, data: {} };
	}

	return {
		snapshot,
		tick,
		handle
	};
}
