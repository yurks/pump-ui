<script lang="ts">
	import { Card, Listgroup, ListPlaceholder } from 'flowbite-svelte';
	import type { ClassValue } from 'svelte/elements';

	import { deviceState } from '$lib/device/device.svelte.js';
	import DeviceControlField from '$lib/device/DeviceControlField.svelte';

	const controls = $derived(deviceState.controls);

	const { class: className }: { class?: ClassValue } = $props();
</script>

{#if !controls}
	<ListPlaceholder class={className} />
{:else}
	<Card class={className}>
		<Listgroup class="border-0">
			{#each controls as param (param.name)}
				<DeviceControlField {param} />
			{/each}
		</Listgroup>
	</Card>
{/if}
