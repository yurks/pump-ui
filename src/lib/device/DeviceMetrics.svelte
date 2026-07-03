<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import DeviceMetricCard from '$lib/device/DeviceMetricCard.svelte';
	import { deviceState } from '$lib/device/device.svelte';
	const metrics = $derived(deviceState.data?.metrics);
</script>

<DeviceMetricCard label={m.pressure()} value={metrics?.pressure} />
<DeviceMetricCard label={m.flow()} value={metrics?.flow} />
<DeviceMetricCard label={m.temperature()} value={metrics?.temperature} />
<DeviceMetricCard label={m.voltage()} value={metrics?.voltage} />
<DeviceMetricCard label={m.current()} value={metrics?.current} />
<DeviceMetricCard label={m.frequency()} value={metrics?.frequency} />
