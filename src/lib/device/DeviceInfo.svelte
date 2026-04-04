<script lang="ts">
	import { Avatar, Badge, Card, TextPlaceholder } from 'flowbite-svelte';

	import { m } from '$lib/paraglide/messages.js';
	import favicon from '$lib/assets/favicon.svg';
	import { deviceState } from '$lib/device/device.svelte';
	import DeviceControlFieldUpdateButton from '$lib/device/DeviceControlFieldUpdateButton.svelte';

	const enabled = $derived(deviceState.data?.controls.enabled);
	const flags = $derived(deviceState.data?.metrics.flags);
	const info = $derived(deviceState.data?.info);

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
					{#if info.firmware}
						<p class="mt-1 text-xs opacity-70">{info.firmware}</p>
					{/if}
					{#if flags?.length}
						<div class="mt-2 flex flex-wrap gap-2">
							{#each flags as flag (flag)}
								<Badge color="yellow" large>{flag}</Badge>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<DeviceControlFieldUpdateButton
			size="xl"
			color={enabled ? 'red' : 'green'}
			class="md:w-3xs"
			name="enabled"
			value={!enabled}
			label={enabled ? m.control_off() : m.control_on()}
		/>
	</div>
</Card>
