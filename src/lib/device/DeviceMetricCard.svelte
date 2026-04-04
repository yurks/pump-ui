<script lang="ts">
	import { Card, Skeleton } from 'flowbite-svelte';

	let { value, label }: { value?: number | null; label: string } = $props();
</script>

<Card class="max-w-full p-4 md:p-6">
	{#if value == null}
		<Skeleton class="h-15 overflow-hidden" />
	{:else}
		<div class="flex justify-between">
			<div>
				<h5 class="pb-2 text-3xl leading-none font-bold">{value}</h5>
				<p class="text-base font-normal text-gray-500 dark:text-gray-400">{label}</p>
			</div>
		</div>
	{/if}
</Card>
