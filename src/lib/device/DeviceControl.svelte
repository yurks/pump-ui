<script lang="ts">
	import { Card, Listgroup, ListPlaceholder } from 'flowbite-svelte';
	import type { ClassValue } from 'svelte/elements';

	import { deviceState } from '$lib/device/device.svelte.js';

	const controls = $derived(deviceState.controls);

	const { class: className }: { class?: ClassValue } = $props();
</script>

{#if !controls}
	<ListPlaceholder class={className} />
{:else}
	<Card class={className}>
		<Listgroup class="border-0">
			{#each controls as param (param.name)}
				<div class="py-2 text-sm font-medium text-gray-900 dark:text-white">
					{param.name}
				</div>
			{/each}
		</Listgroup>
	</Card>
{/if}
