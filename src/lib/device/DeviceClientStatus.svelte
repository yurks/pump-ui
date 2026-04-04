<script lang="ts">
	import { Badge } from 'flowbite-svelte';

	import { m } from '$lib/paraglide/messages.js';
	import ElapsedTime from '$lib/ElapsedTime.svelte';
	import { deviceState as state } from '$lib/device/device.svelte';
	import AppSpinner from '$lib/AppSpinner.svelte';
</script>

<div class="flex flex-wrap items-center gap-1 text-nowrap">
	{#if state.socketStatus === 'error'}
		<Badge rounded color="red">{m.socket_error()}</Badge>
	{:else if state.socketStatus === 'disconnected'}
		<Badge rounded color="gray">{m.socket_disconnected()}</Badge>
	{:else if state.socketStatus === 'connecting' || state.socketStatus === 'reconnecting'}
		<Badge rounded color="yellow">
			{m.socket_connecting()}
			<AppSpinner size="4" class="ml-1" />
			<ElapsedTime timestamp={state.lastMessageAt} class="ml-1 opacity-70" />
		</Badge>
	{:else if state.socketStatus === 'connected'}
		{#if state.stale}
			<Badge rounded color="yellow">
				{m.socket_waiting()}
				<AppSpinner size="4" class="ml-1" />
				<ElapsedTime timestamp={state.lastMessageAt} class="ml-1 opacity-70" />
			</Badge>
		{:else}
			<Badge rounded color="green">
				{m.socket_connected()}
			</Badge>
		{/if}
	{:else}
		<Badge rounded color="cyan">{state.socketStatus}</Badge>
	{/if}

	{#if state.lastError}
		<Badge rounded color="red">{state.lastError}</Badge>
	{/if}
</div>
