<script lang="ts">
	import { PenSolid } from 'flowbite-svelte-icons';
	import { Button, Modal } from 'flowbite-svelte';

	import { m } from '$lib/paraglide/messages.js';
	import type { DeviceRemoteControls } from '$lib/device/types';
	import DeviceControlFieldEditor from '$lib/device/DeviceControlFieldEditor.svelte';

	let {
		name,
		value
	}: {
		name: keyof DeviceRemoteControls;
		value: number | string | boolean;
	} = $props();

	const mLabelKey = $derived(`field_label__${name}` satisfies keyof typeof m);
	const mDescKey = $derived(`field_desc__${name}` satisfies keyof typeof m);

	const label = $derived((mLabelKey in m && m[mLabelKey]()) || name);
	const desc = $derived((mDescKey in m && m[mDescKey]()) || undefined);

	let formModal = $state(false);
</script>

<div class="flex items-center space-x-4 py-2 rtl:space-x-reverse">
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium text-gray-900 dark:text-white">
			{label}
		</p>
		<p class="truncate text-sm text-gray-500 dark:text-gray-400">
			{desc}
		</p>
	</div>
	<div class="inline-flex items-center text-base font-semibold text-gray-900 dark:text-white">
		<div class="flex items-center gap-2">
			{value}
			{#if value != null}
				<Button onclick={() => (formModal = true)} color="alternative" size="xs"
					><PenSolid size="md" /></Button
				>
			{/if}
		</div>
		{#if value != null}
			<Modal bind:open={formModal} placement="bottom-center">
				<DeviceControlFieldEditor {label} {name} {value} onDone={() => (formModal = false)} />
			</Modal>
		{/if}
	</div>
</div>
