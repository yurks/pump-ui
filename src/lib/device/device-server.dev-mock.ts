import type {
	DeviceClientMessage,
	DeviceServerMessage,
	DeviceRemoteState,
	DeviceCmd,
	TelemetryCmd,
	StateCmd,
	StatusCmd,
	DeviceCmdPatch
} from '$lib/device/types';

/*
{"cmd":"error","data":{"error":"NO_ERRORS"}
{"cmd":"status","data":{"hw_sw":{"soft":"SW: 2.60","hard":"HW: 2.0"},"PumpType":3}}
{"cmd":"state",""data":{"DryWorkStop":false,"PressureStop":false,"temp_stop":false,"user_stop":false}}
{"cmd":"telemetry","data":{"freq":20,"voltage":219,"current":0.00,"pressure":0.17,"temperature":27,"flow":0,"error":"NO_ERRORS"}}
{"cmd": "pump","data":{}}
*/

export function createMockDeviceServer() {

	let telemetry: TelemetryCmd = {
        freqency: 20,
        pressure: 1.4,
        voltage: 220,
        current: 5.5,
        temperature: 25,
        flow: true,
		error: "NO_ERRORS"
    };

	let state: StateCmd = {
        DryWorkStop: false,
        PressureStop: false,
        temp_stop: false,
        user_stop: false
    };

    let status: StatusCmd = {
        hw_sw: {
            soft: "SW: 2.60",
            hard: "HW: 2.0"
        },
        PumpType: "3"
    };

	function snapshot(): DeviceCmd<TelemetryCmd> {
		return {
				cmd: "telemetry",
				data: telemetry
		};
	}

	function tick(): void {

        telemetry = {
            ...telemetry,
            temperature: Number(
                (telemetry.temperature + (Math.random() - 0.5) * 0.5).toFixed(1)
            ),
            pressure: Number(
                (telemetry.pressure + (Math.random() - 0.5) * 0.2).toFixed(2)
            ),
            voltage: Math.round(
                telemetry.voltage + (Math.random() - 0.5) * 4
            ),
            current: Number(
                Math.max(
                    0,
                    telemetry.current + (Math.random() - 0.5) * 0.2
                ).toFixed(2)
            )
        };

        telemetry.flow = telemetry.pressure > 0.2;

        state.PressureStop = telemetry.pressure > 5;
        state.temp_stop = telemetry.temperature > 70;

	}

	function handle(message: DeviceClientMessage): DeviceServerMessage {
		switch (message.type) {
			case 'ping':
				return {
					type: 'pong',
					payload: { ts: Date.now() }
				};

            case "cmd":
                switch (message.payload.cmd) {
                    case "telemetry":
                        telemetry = {
                            ...telemetry,
                            ...message.payload.data
                        };

                        return {
                            type: "cmd_result",
                            payload: {
                                cmd: "telemetry",
                                data: telemetry
                            }
                        };
					case "status":
                        status = {
                            ...status,
                            ...message.payload.data
                        };

                        return {
                            type: "cmd_result",
                            payload: {
                                cmd: "status",
                                data: status
                            }
                        };

				}
		}
	}

	return {
		snapshot,
		tick,
		handle
	};
}
