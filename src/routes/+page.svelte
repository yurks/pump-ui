<script lang="ts">
	import DeviceMetrics from '$lib/device/DeviceMetrics.svelte';
	import DeviceControl from '$lib/device/DeviceControl.svelte';
	import DeviceInfo from '$lib/device/DeviceInfo.svelte';
</script>

<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
	<DeviceInfo class="col-start-1 col-end-3 md:col-end-5" />
	<DeviceMetrics />
</div>

<DeviceControl class="mt-4 max-w-full px-4 py-2 md:p-6" />
