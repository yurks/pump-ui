<script lang="ts">
	import { Label, Input, Checkbox } from 'flowbite-svelte';
	import { untrack } from 'svelte';

	import type { DeviceRemoteControls } from '$lib/device/types';
	import DeviceControlFieldUpdateButton from '$lib/device/DeviceControlFieldUpdateButton.svelte';

	let {
		label,
		name,
		value,
		onDone
	}: {
		name: keyof DeviceRemoteControls;
		value: number | string | boolean | readonly number[] | readonly string[];
		label?: string;
		onDone?: () => void;
	} = $props();

	// Creates a deep, non-reactive copy of the initial prop
	let newValue = $state(untrack(() => value));
</script>

<div class="flex flex-col space-y-6">
	<h3 class="mb-4 text-xl font-medium">{label || name}</h3>
	<Label class="space-y-2">
		{#if typeof newValue === 'boolean'}
			<Checkbox bind:checked={newValue} />
		{:else if typeof newValue === 'string'}
			<Input type="text" autocomplete="off" required bind:value={newValue} />
		{:else if typeof newValue === 'number'}
			<Input type="number" autocomplete="off" required bind:value={newValue} />
		{:else}
			{newValue}
		{/if}
	</Label>
	<div class="flex">
		<DeviceControlFieldUpdateButton {name} value={newValue} label="Save" {onDone} />
	</div>
</div>
