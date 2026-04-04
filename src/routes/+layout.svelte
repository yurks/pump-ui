<script lang="ts">
	import './+layout.css';
	import { navbarContainer } from 'flowbite-svelte';
	import { onDestroy } from 'svelte';

	import favicon from '$lib/assets/favicon.svg';
	import AppHeader from '$lib/AppHeader.svelte';
	import AppFooter from '$lib/AppFooter.svelte';
	import DeviceClientStatus from '$lib/device/DeviceClientStatus.svelte';
	import { device } from '$lib/device/device.svelte';

	let { children } = $props();

	device.initialize();

	onDestroy(() => {
		device.destroy();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="grid h-screen grid-rows-[auto_1fr_auto]">
	<header>
		<AppHeader>
			<DeviceClientStatus />
		</AppHeader>
	</header>
	<main class="overflow-y-auto">
		<div class="{navbarContainer()} h-full w-full">
			<div class="h-full w-full">
				{@render children()}
			</div>
		</div>
	</main>
	<footer>
		<AppFooter />
	</footer>
</div>
