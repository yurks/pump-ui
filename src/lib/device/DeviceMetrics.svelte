<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import DeviceMetricCard from '$lib/device/DeviceMetricCard.svelte';
	import { deviceState } from '$lib/device/device.svelte';
	import {
		type DeviceCmdPatch,
		type DeviceCmd,
		type TelemetryCmd,
		type StateCmd,
		type StatusCmd,
	} from './types.ts';
	const metrics: DeviceCmd<TelemetryCmd> | null  = $derived(deviceState.data);
</script>

<DeviceMetricCard label={m.pressure()} value={metrics?.data.pressure} />
<DeviceMetricCard label={m.voltage()} value={metrics?.data.voltage} />
<DeviceMetricCard label={m.current()} value={metrics?.data.current} />
<DeviceMetricCard label={m.temperature()} value={metrics?.data.temperature} />
