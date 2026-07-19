import type {
	DeviceClientMessage,
	DeviceServerMessage,
	DeviceRemoteMonitor,
	DeviceRemoteInfo
} from '$lib/device/types';

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
			user_stop: false,
			motor_current_state: 1
		},
		error: { message: 'NO_ERROR', code: 0 }
	};

	const config: Record<string, string> = {
		MAX_PRESSURE: '30',
		DELTA_PSTART: '10',
		PRESSURE_DRY: '5',
		I_LIMIT: '8',
		FREQ_SPEED_CHANGE: '45',
		FLOW_SENSOR: '1',
		ROTATE: '0',
		PRESSURE_DELAY: '3',
		DRY_MODE: '1',
		DELAY_AFTER_DRY_START: '20',
		NUM_REBUTS_FOR_DRY_START: '3'
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
			case 'ping':
				return { cmd: 'pong' };

			case 'pump:config_list':
				return {
					cmd: 'pump:config_list',
					data: Object.keys(config).map((name) => ({ name }))
				};

			case 'pump:config_get':
				return {
					cmd: 'pump:config_get',
					data: message.data.map(({ name }) => ({ name, value: config[name] }))
				};

			case 'pump:config_set':
				return {
					cmd: 'pump:config_set',
					data: message.data.map((param) => {
						config[param.name] = String(param.value);
						return param.name;
					})
				};

			case 'pump:toggle':
				device.status.motor_current_state = device.status.motor_current_state ? 0 : 1;
				return {
					cmd: 'pump:toggle',
					data: { motor_current_state: device.status.motor_current_state }
				};

			case 'pump:info':
				return { cmd: message.cmd, data: deviceInfo };

			case 'pump:monitor':
				tick();
				return { cmd: message.cmd, data: snapshot() };
		}
	}

	return {
		snapshot,
		tick,
		handle
	};
}
