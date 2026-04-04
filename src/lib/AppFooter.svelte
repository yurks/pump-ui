<script lang="ts">
	import { BottomNav, BottomNavItem } from 'flowbite-svelte';
	import {
		ObjectsColumnSolid,
		WalletSolid,
		AdjustmentsVerticalOutline
	} from 'flowbite-svelte-icons';

	import { m } from '$lib/paraglide/messages.js';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let activeUrl = $derived(page.url.pathname);
</script>

<BottomNav {activeUrl} position="static" classes={{ inner: 'grid-cols-3' }}>
	<BottomNavItem btnName={m.control_page_title()} href={resolve('/')}>
		<ObjectsColumnSolid />
	</BottomNavItem>
	<BottomNavItem btnName={m.charts_page_title()} href={resolve('/chart')}>
		<WalletSolid />
	</BottomNavItem>
	<BottomNavItem btnName={m.settings_page_title()}>
		<AdjustmentsVerticalOutline />
	</BottomNavItem>
</BottomNav>
