import type {
	DeviceClientMessage,
	DeviceServerMessage,
	DeviceConfigParam,
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

	// Full parameter metadata keyed by name. `value` is always number or text;
	// booleans are encoded as 0/1. `label`, `measure`, `multiplier` and
	// `options` (and every field inside `options`) are optional.
	const config: Record<string, Omit<DeviceConfigParam, 'name'>> = {
		MAX_PRESSURE: {
			value: 30,
			label: 'Max pressure',
			type: 'number',
			measure: 'atm',
			multiplier: 10,
			options: { min: 10, max: 80, step: 1 }
		},
		DELTA_PSTART: {
			value: 10,
			label: 'Start delta',
			type: 'number',
			measure: 'atm',
			options: { min: 1, max: 30, step: 1 }
		},
		PRESSURE_DRY: {
			value: 5,
			label: 'Dry-run pressure',
			type: 'number',
			measure: 'atm',
			options: { min: 0, max: 20 }
		},
		I_LIMIT: {
			value: 8,
			label: 'Current limit',
			type: 'number',
			measure: 'A',
			options: { min: 0, max: 16, step: 1 }
		},
		FREQ_SPEED_CHANGE: {
			value: 45,
			label: 'Speed change frequency',
			type: 'number',
			measure: 'Hz',
			options: { min: 30, max: 60 }
		},
		FLOW_SENSOR: {
			value: 1,
			label: 'Flow sensor',
			type: 'number',
			options: {
				items: [
					{ id: 0, value: 'Off' },
					{ id: 1, value: 'On' }
				]
			}
		},
		ROTATE: {
			value: 0,
			label: 'Rotation',
			type: 'number',
			options: {
				items: [
					{ id: 0, value: 'Normal' },
					{ id: 1, value: 'Reversed' }
				]
			}
		},
		PRESSURE_DELAY: {
			value: 3,
			label: 'Pressure delay',
			type: 'number',
			measure: 's',
			options: { min: 0, max: 60 }
		},
		DRY_MODE: {
			value: 1,
			label: 'Dry-run mode',
			type: 'number',
			options: {
				items: [
					{ id: 0, value: 'Auto' },
					{ id: 1, value: 'Manual' },
					{ id: 2, value: 'Off' }
				]
			}
		},
		DELAY_AFTER_DRY_START: {
			value: 20,
			label: 'Delay after dry start',
			type: 'number',
			measure: 's',
			options: { min: 0, max: 120 }
		},
		NUM_REBUTS_FOR_DRY_START: {
			value: 3,
			label: 'Retries before dry start',
			type: 'number',
			options: { min: 0, max: 10, step: 1 }
		}
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
					data: message.data
						.filter(({ name }) => config[name])
						.map(({ name }) => ({ name, ...config[name] }))
				};

			case 'pump:config_set':
				return {
					cmd: 'pump:config_set',
					data: message.data
						.filter((param) => config[param.name])
						.map((param) => {
							// Value is always number or text; booleans arrive as 0/1.
							config[param.name].value = param.value;
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
