<script lang="ts">
	import { untrack } from 'svelte';
	import { Label, Input, Range, Select, Toggle, Helper } from 'flowbite-svelte';

	import type { DeviceConfigParam, DeviceConfigValue } from '$lib/device/types';
	import { decimalsFor, fieldDesc } from '$lib/device/utils';
	import DeviceControlFieldUpdateButton from '$lib/device/DeviceControlFieldUpdateButton.svelte';

	let {
		param,
		label,
		onDone
	}: {
		param: DeviceConfigParam;
		label?: string;
		onDone?: () => void;
	} = $props();

	const options = $derived(param.options ?? {});
	const items = $derived(options.items ?? []);

	// The value type is driven by the param, falling back to the current value.
	const valueType = $derived(param.type ?? (typeof param.value === 'number' ? 'number' : 'text'));

	// Which control to render. Toggle is checked before range on purpose: a
	// 0..1 numeric range is really a boolean and reads better as a switch.
	// A range needs concrete bounds, otherwise it falls back to a number input.
	const kind = $derived.by(() => {
		if (items.length > 1) return 'select';
		if (items.length === 1) return 'readonly';
		if (valueType === 'text') return 'text';
		if (valueType === 'number' && options.min === 0 && options.max === 1) return 'toggle';
		if (
			valueType === 'number' &&
			options.step != null &&
			options.min != null &&
			options.max != null
		)
			return 'range';
		return 'number';
	});

	const selectItems = $derived(
		items.map((item) => ({
			name: item.value,
			value: valueType === 'number' ? item.id : item.value
		}))
	);

	// `value`, `min`, `max` and `step` are stored pre-scaled. Numeric controls
	// operate in human units (raw / multiplier); we scale back on save.
	const multiplier = $derived(param.multiplier || 1);
	const scaled = $derived(kind === 'number' || kind === 'range');
	const decimals = $derived(decimalsFor(multiplier));

	const min = $derived(options.min != null ? options.min / multiplier : undefined);
	const max = $derived(options.max != null ? options.max / multiplier : undefined);
	// One raw unit is 1/multiplier in human units, so multiplier fields step in
	// floats (×10 -> 0.1) even when the param defines no explicit step.
	const step = $derived(
		options.step != null ? options.step / multiplier : multiplier !== 1 ? 1 / multiplier : undefined
	);

	// Bounds hint shown above numeric fields, e.g. "(1 – 8 atm)".
	const bounds = $derived(
		scaled && min != null && max != null
			? `(${min} – ${max}${param.measure ? ` ${param.measure}` : ''})`
			: undefined
	);
	// Editing hint = the localized description plus the bounds hint.
	const hint = $derived([fieldDesc(param.name), bounds].filter(Boolean).join(' '));

	// Non-reactive working copy of the initial value, in the control's own units.
	let newValue = $state<DeviceConfigValue>(
		untrack(() => {
			const raw = param.value ?? (valueType === 'text' ? '' : 0);
			return scaled && typeof raw === 'number' ? raw / multiplier : raw;
		})
	);

	// The raw value handed back to the device (human units scaled by multiplier).
	const valueToSave = $derived.by<DeviceConfigValue>(() => {
		if (!scaled) return newValue;
		const raw = Number(newValue) * multiplier;
		return multiplier === 1 ? raw : Math.round(raw);
	});
</script>

<div class="flex flex-col space-y-6">
	<h3 class="mb-4 text-xl font-medium">{label || param.name}</h3>

	<Label class="space-y-2">
		{#if hint}
			<Helper class="text-gray-500 dark:text-gray-400">{hint}</Helper>
		{/if}
		{#if kind === 'select'}
			<Select bind:value={newValue} items={selectItems} />
		{:else if kind === 'readonly'}
			<Input type="text" readonly disabled value={items[0]?.value} />
		{:else if kind === 'text'}
			<Input
				type="text"
				autocomplete="off"
				required
				minlength={options.min}
				maxlength={options.max}
				bind:value={newValue}
			/>
		{:else if kind === 'toggle'}
			<Toggle
				checked={Number(newValue) === 1}
				onchange={(e) => (newValue = e.currentTarget.checked ? 1 : 0)}
			/>
		{:else if kind === 'range'}
			<Range appearance="auto" color="blue" {min} {max} {step} bind:value={newValue} />
			<Helper class="text-center">
				{multiplier !== 1 ? Number(newValue).toFixed(decimals) : newValue}{param.measure
					? ` ${param.measure}`
					: ''}
			</Helper>
		{:else}
			<Input type="number" autocomplete="off" required {min} {max} {step} bind:value={newValue} />
		{/if}
	</Label>

	<div class="flex">
		<DeviceControlFieldUpdateButton
			name={param.name}
			value={valueToSave}
			label="Save"
			disabled={kind === 'readonly' ? true : undefined}
			{onDone}
		/>
	</div>
</div>
