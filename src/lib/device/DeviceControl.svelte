<script lang="ts">
	import { Card, Listgroup, ListPlaceholder } from 'flowbite-svelte';
	import type { ClassValue } from 'svelte/elements';

	import { deviceState } from '$lib/device/device.svelte.js';
	import DeviceControlField from '$lib/device/DeviceControlField.svelte';

	const controls = $derived(deviceState.data?.controls);

	const { class: className }: { class?: ClassValue } = $props();
</script>

{#if !controls}
	<ListPlaceholder class={className} />
{:else}
	<Card class={className}>
		<Listgroup class="border-0">
			<DeviceControlField name="pressure_limit" value={controls.pressure_limit} />
			<DeviceControlField name="temp_limit" value={controls.temp_limit} />
			<DeviceControlField name="mode" value={controls.mode} />
			<DeviceControlField name="enabled" value={controls.enabled} />
		</Listgroup>
	</Card>
{/if}
