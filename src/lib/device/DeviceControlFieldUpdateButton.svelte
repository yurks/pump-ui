<script lang="ts">
	import { Button, type ButtonProps } from 'flowbite-svelte';
	import type { ClassValue } from 'svelte/elements';

	import type { DeviceConfigValue } from '$lib/device/types';
	import { deviceState, deviceUpdate } from '$lib/device/device.svelte';
	import AppSpinner from '$lib/AppSpinner.svelte';

	const controls = $derived(deviceState.controls);
	let {
		label,
		name,
		value,
		onDone,
		class: className,
		color,
		size,
		disabled
	}: {
		label: string;
		name: string | 'toggle';
		value: DeviceConfigValue | boolean;
		onDone?: () => void;
		class?: ClassValue;
		color?: ButtonProps['color'];
		size?: ButtonProps['size'];
		disabled?: boolean | null;
	} = $props();

	const isDisabled = $derived(typeof disabled === 'boolean' ? disabled : controls == null);

	async function update() {
		if (name === 'toggle') {
			await deviceUpdate('toggle').catch();
			onDone?.();
			return;
		}

		const nextValue: DeviceConfigValue = typeof value === 'boolean' ? Number(value) : value;
		const current = controls?.find((param) => param.name === name)?.value;
		if (!controls || current === nextValue) {
			onDone?.();
			return;
		}

		await deviceUpdate({ [name]: nextValue }).catch();
		onDone?.();
	}
</script>

<Button
	class={`${className} w-full`}
	{size}
	color={isDisabled ? 'gray' : color}
	disabled={isDisabled || deviceState.updating}
	onclick={update}
>
	{#if deviceState.updating}
		<AppSpinner size="6" />
	{:else if !isDisabled}
		{label}
	{/if}
</Button>
