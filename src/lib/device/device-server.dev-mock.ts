import type {
	DeviceClientMessage,
	DeviceServerMessage,
	DeviceRemoteState
} from '$lib/device/types';

export function createMockDeviceServer() {
	let device: DeviceRemoteState = {
		metrics: {
			flags: [],
			pressure: 48,
			voltage: 215,
			current: 1000,
			temperature: 22.4
		},
		controls: {
			enabled: true,
			pressure_limit: 40,
			temp_limit: 40,
			mode: 'auto'
		},
		info: {
			name: 'Mock Magnetik PSM-100',
			firmware: 'mock-v1.0.3'
		},
		ts: Date.now()
	};

	function snapshot(): DeviceRemoteState {
		return device;
	}

	function tick(): void {
		const nextTemp = Number((device.metrics.temperature + (Math.random() - 0.5) * 0.6).toFixed(1));
		const nextVoltage = Number((device.metrics.voltage + (Math.random() - 0.5) * 10).toFixed());
		const nextCurrent = Number((device.metrics.current + (Math.random() - 0.5) * 100).toFixed());
		const nextPressure = Number((device.metrics.pressure + (Math.random() - 0.5) * 3).toFixed(1));

		device.metrics.flags.length = 0;

		if (nextVoltage > 225) device.metrics.flags.push('OVER_VOLT');
		if (nextPressure > device.controls.pressure_limit * 0.85)
			device.metrics.flags.push('HIGH_PRESSURE');
		if (nextTemp > device.controls.temp_limit * 0.85) device.metrics.flags.push('HIGH_TEMP');

		device = {
			...device,
			metrics: {
				...device.metrics,
				pressure: nextPressure,
				voltage: nextVoltage,
				current: nextCurrent,
				temperature: nextTemp
			},
			ts: Date.now()
		};
	}

	function handle(message: DeviceClientMessage): DeviceServerMessage {
		switch (message.type) {
			case 'ping':
				return {
					type: 'pong',
					payload: { ts: Date.now() }
				};

			case 'update':
				device = {
					...device,
					controls: {
						...device.controls,
						...message.payload.controls
					},
					ts: Date.now()
				};

				return {
					type: 'state',
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
