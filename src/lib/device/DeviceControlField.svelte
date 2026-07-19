<script lang="ts">
	import { PenSolid } from 'flowbite-svelte-icons';
	import { Button, Modal } from 'flowbite-svelte';

	import type { DeviceConfigParam } from '$lib/device/types';
	import { decimalsFor, fieldDesc, fieldLabel } from '$lib/device/utils';
	import DeviceControlFieldEditor from '$lib/device/DeviceControlFieldEditor.svelte';

	let { param }: { param: DeviceConfigParam } = $props();

	const label = $derived(fieldLabel(param.name, param.label));
	const desc = $derived(fieldDesc(param.name));

	// `value`, `min`, `max` and `step` are stored pre-scaled; the UI works in
	// human units (raw / multiplier) and scales back only when sending.
	const multiplier = $derived(param.multiplier || 1);

	// Decimal places implied by the multiplier (10 -> 1, 100 -> 2), so scaled
	// values render as floats (raw 80, ×10 -> "8.0").
	const decimals = $derived(decimalsFor(multiplier));

	// Enumerated params store the option id as value; show the option label instead.
	const displayValue = $derived.by(() => {
		const items = param.options?.items;
		if (items?.length) {
			return items.find((item) => item.id === param.value)?.value ?? param.value;
		}
		if (typeof param.value === 'number') {
			return multiplier !== 1 ? (param.value / multiplier).toFixed(decimals) : param.value;
		}
		return param.value;
	});

	const editable = $derived(param.value != null);

	let formModal = $state(false);
</script>

<div class="flex items-center space-x-4 py-2 rtl:space-x-reverse">
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium text-gray-900 dark:text-white">
			{label}
		</p>
		{#if desc}
			<p class="truncate text-sm text-gray-500 dark:text-gray-400">
				{desc}
			</p>
		{/if}
	</div>
	<div class="inline-flex items-center text-base font-semibold text-gray-900 dark:text-white">
		<div class="flex items-center gap-2">
			{displayValue}
			{param.measure ?? ''}
			{#if editable}
				<Button onclick={() => (formModal = true)} color="alternative" size="xs">
					<PenSolid size="md" />
				</Button>
			{/if}
		</div>
		{#if editable}
			<Modal bind:open={formModal} placement="bottom-center">
				<DeviceControlFieldEditor {param} {label} onDone={() => (formModal = false)} />
			</Modal>
		{/if}
	</div>
</div>
