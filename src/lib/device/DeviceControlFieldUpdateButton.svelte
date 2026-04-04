<script lang="ts">
	import { Button, type ButtonProps } from 'flowbite-svelte';
	import type { ClassValue } from 'svelte/elements';

	import type { DeviceRemoteControls } from '$lib/device/types';
	import { deviceState, deviceUpdate } from '$lib/device/device.svelte';
	import AppSpinner from '$lib/AppSpinner.svelte';

	const controls = $derived(deviceState.data?.controls);

	let {
		label,
		name,
		value,
		onDone,
		class: className,
		color,
		size
	}: {
		label: string;
		name: keyof DeviceRemoteControls;
		value: number | string | boolean;
		onDone?: () => void;
		class?: ClassValue;
		color?: ButtonProps['color'];
		size?: ButtonProps['size'];
	} = $props();

	async function update() {
		if (!controls || controls[name] === value) {
			onDone?.();
			return;
		}

		await deviceUpdate({ [name]: value }).catch();
		onDone?.();
	}
</script>

<Button
	class={`${className} w-full`}
	{size}
	color={controls == null ? 'gray' : color}
	disabled={controls == null || deviceState.updating}
	onclick={update}
>
	{#if deviceState.updating}
		<AppSpinner size="6" />
	{:else if controls}
		{label}
	{/if}
</Button>
