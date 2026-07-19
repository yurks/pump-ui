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
	//
	// Names/labels are grouped by the editor control they trigger, so the dev UI
	// lists one simple example of every DeviceControlFieldEditor branch in order.
	const config: Record<string, Omit<DeviceConfigParam, 'name'>> = {
		// number dropdown: options.items.length > 1, value stores the option id
		NUMBER_DROPDOWN_3: {
			value: 1,
			label: 'Number dropdown (3 options)',
			type: 'number',
			options: {
				items: [
					{ id: 0, value: 'Auto' },
					{ id: 1, value: 'Manual' },
					{ id: 2, value: 'Off' }
				]
			}
		},
		NUMBER_DROPDOWN_2: {
			value: 0,
			label: 'Number dropdown (2 options)',
			type: 'number',
			options: {
				items: [
					{ id: 0, value: 'Forward' },
					{ id: 1, value: 'Reverse' }
				]
			}
		},
		// text dropdown: same control, but value stores the option string
		TEXT_DROPDOWN_3: {
			value: 'eco',
			label: 'Text dropdown (3 options)',
			type: 'text',
			options: {
				items: [
					{ id: 0, value: 'eco' },
					{ id: 1, value: 'normal' },
					{ id: 2, value: 'boost' }
				]
			}
		},

		// readonly: options.items.length === 1
		READONLY_SINGLE: {
			value: 0,
			label: 'Readonly (single option)',
			type: 'number',
			options: { items: [{ id: 0, value: 'Magnetic' }] }
		},

		// text input: type === 'text', min/max act as minlength/maxlength
		TEXT_INPUT: {
			value: 'Pump-01',
			label: 'Text input (2–16 chars)',
			type: 'text',
			options: { min: 2, max: 16 }
		},

		// toggle: type === 'number' && min === 0 && max === 1
		TOGGLE_BOOL: {
			value: 1,
			label: 'Toggle (0/1)',
			type: 'number',
			options: { min: 0, max: 1 }
		},

		// number range: number with min/max/step
		NUMBER_RANGE: {
			value: 40,
			label: 'Number range',
			type: 'number',
			measure: '°C',
			options: { min: 0, max: 100, step: 5 }
		},
		// number range in human units (raw 30 -> 3.0 atm, 1.0-8.0 step 0.1)
		NUMBER_RANGE_X10: {
			value: 30,
			label: 'Number range (multiplier ×10)',
			type: 'number',
			measure: 'atm',
			multiplier: 10,
			options: { min: 10, max: 80, step: 1 }
		},

		// number input: bounds, no step
		NUMBER_BOUNDED: {
			value: 8,
			label: 'Number input (bounded)',
			type: 'number',
			measure: 'A',
			options: { min: 0, max: 16 }
		},
		// number input in human units (raw 80 -> 8 A, 0-16)
		NUMBER_BOUNDED_X10: {
			value: 80,
			label: 'Number input (multiplier ×10)',
			type: 'number',
			measure: 'A',
			multiplier: 10,
			options: { min: 0, max: 160 }
		},
		// number input with no options (unbounded)
		NUMBER_UNBOUNDED: {
			value: 100,
			label: 'Number input (unbounded)',
			type: 'number',
			measure: 'mbar'
		},
		// step but no min/max -> falls back to a plain number input
		NUMBER_STEP_FALLBACK: {
			value: 3,
			label: 'Number input (step only → fallback)',
			type: 'number',
			options: { step: 1 }
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
