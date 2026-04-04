<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { Spinner } from 'flowbite-svelte';
	import type { SpinnerProps } from 'flowbite-svelte';

	const { class: className, size }: { size: SpinnerProps['size']; class?: ClassValue } = $props();
</script>

<Spinner type="dots" {size} class={`${className} fill-current text-inherit`} />
