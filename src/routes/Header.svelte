<script lang="ts">
	import github from '$lib/images/github.svg';

	let {
		loggedIn = false,
		displayName = null
	}: { loggedIn?: boolean; displayName?: string | null } = $props();
</script>

<header class="flex justify-between items-center px-4 py-2">
	<nav class="flex items-center gap-4">
		<a href="/" class="text-blue-700 hover:text-blue-900 font-medium hover:underline">Browse</a>
		{#if loggedIn}
			<a href="/my-guilds" class="text-blue-700 hover:text-blue-900 font-medium hover:underline"
				>My Guilds</a
			>
		{/if}
	</nav>

	<div class="flex items-center gap-4">
		{#if loggedIn}
			{#if displayName}
				<span class="text-sm text-gray-700">Hi, {displayName}</span>
			{/if}
			<form method="POST" action="/login?/logout">
				<button
					type="submit"
					class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
					aria-label="Logout from your account"
				>
					Logout
				</button>
			</form>
		{:else}
			<a href="/login" class="text-sm text-blue-600 hover:text-blue-800 hover:underline">Log in</a>
		{/if}
		<a
			href="https://github.com/whatjakecodes/atguilds"
			class="flex items-center justify-center w-8 h-8"
		>
			<img src={github} alt="GitHub" class="w-8 h-8 object-contain" />
		</a>
	</div>
</header>

<h1 class="text-3xl font-bold mb-1 text-center mt-5">
	<a href="/" class="no-underline">ATGuilds</a>
</h1>
<p class="text-lg text-center">
	Guild system for ATProtocol. Create a guild and invite your friends!
</p>
