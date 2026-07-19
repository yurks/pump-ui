<script lang="ts">
	import { Avatar, Badge, Card, TextPlaceholder } from 'flowbite-svelte';

	import { m } from '$lib/paraglide/messages.js';
	import favicon from '$lib/assets/favicon.svg';
	import { deviceState } from '$lib/device/device.svelte';
	import DeviceControlFieldUpdateButton from '$lib/device/DeviceControlFieldUpdateButton.svelte';

	const error = $derived(deviceState.data?.error);
	const info = $derived(deviceState.info);

	const disabled = $derived.by(() => {
		const status = deviceState.data?.status;
		if (!status) {
			return null;
		}
		return !status.motor_current_state;
	});

	const { class: className } = $props();
</script>

<Card class={`${className} max-w-full p-4 md:p-6`}>
	<div class="flex flex-wrap items-center justify-between gap-4">
		{#if info == null}
			<TextPlaceholder class="h-20 overflow-hidden" />
		{:else}
			<div class="flex items-center gap-4">
				<Avatar size="lg" src={favicon} />
				<div>
					<h5 class="text-xl font-medium">{info.name}</h5>
					{#if info.firmware_sw || info.firmware_hw}
						<p class="mt-1 text-xs opacity-70">{info.firmware_sw} {info.firmware_hw}</p>
					{/if}
					{#if error?.code}
						<div class="mt-2 flex flex-wrap gap-2">
							<Badge color="yellow" large>{error.message}</Badge>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<DeviceControlFieldUpdateButton
			size="xl"
			color={!disabled ? 'red' : 'green'}
			class="md:w-3xs"
			name="toggle"
			value={!!disabled}
			disabled={disabled == null}
			label={!disabled ? m.control_off() : m.control_on()}
		/>
	</div>
</Card>
