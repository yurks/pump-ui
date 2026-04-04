<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	let { timestamp, class: className = '' }: { timestamp: number | null; class?: string } = $props();

	let now = $state(Date.now());
	let timeout: ReturnType<typeof setTimeout> | undefined;

	function tick() {
		now = Date.now();
		timeout = setTimeout(tick, 1000);
	}

	$effect(() => {
		if (timestamp === null) return;

		tick();

		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});

	const elapsed = $derived(
		timestamp === null ? 0 : Math.max(0, Math.floor((now - timestamp) / 1000))
	);

	const formatted = $derived(
		elapsed < 60
			? m.time_seconds({ value: elapsed })
			: `${m.time_minutes({ value: Math.floor(elapsed / 60) })} ${m.time_seconds({ value: elapsed % 60 })}`
	);
</script>

{#if timestamp !== null}
	<span class={className}>{formatted}</span>
{/if}
