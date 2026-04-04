<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Navbar, NavBrand, DarkMode, darkmode } from 'flowbite-svelte';

	import { locales, getLocale, setLocale } from '$lib/paraglide/runtime';
	let { children }: { children?: Snippet } = $props();
</script>

<Navbar class="w-full" navContainerClass="gap-2">
	<NavBrand class="nowrap flex gap-2">
		<span class="text-lg font-semibold whitespace-nowrap">Pump UI</span>
	</NavBrand>

	<div class="grow">
		{@render children?.()}
	</div>

	<div class="nowrap flex">
		{#each locales as locale (locale)}
			{#if locale !== getLocale()}
				<button
					type="button"
					class="{darkmode()} uppercase"
					tabindex={0}
					aria-label="Languages"
					onclick={() => setLocale(locale)}>{locale === 'uk' ? 'Укр' : locale}</button
				>
			{/if}
		{/each}
		<DarkMode />
	</div>
</Navbar>
