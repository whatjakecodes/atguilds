<script lang="ts">
	const { data } = $props();
	const { guilds, leaderHandleMap, page, total, pageSize } = data;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
</script>

<svelte:head>
	<title>ATGuilds - Browse guilds</title>
	<meta name="description" content="Browse guilds on ATProtocol" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h2 class="text-xl font-semibold mb-6">Browse guilds</h2>

	{#if guilds.length === 0}
		<p class="text-gray-600">No guilds yet.</p>
	{:else}
		<ul class="space-y-3">
			{#each guilds as g}
				<li class="bg-white p-4 rounded-lg shadow flex items-center justify-between gap-4">
					<a
						href="/guild/{g.uri.replace('at://', 'at/')}"
						class="text-blue-600 hover:text-blue-800 hover:underline font-medium"
					>
						{g.name}
					</a>
					<span class="text-sm text-gray-600">
						led by {leaderHandleMap[g.leaderDid]} · {g.memberCount}
						member{g.memberCount === 1 ? '' : 's'}
					</span>
				</li>
			{/each}
		</ul>

		<div class="flex items-center justify-between mt-6">
			{#if page > 1}
				<a href="/?page={page - 1}" class="text-blue-600 hover:text-blue-800 hover:underline"
					>‹ Prev</a
				>
			{:else}
				<span class="text-gray-400">‹ Prev</span>
			{/if}

			<span class="text-sm text-gray-600">Page {page} of {totalPages}</span>

			{#if page < totalPages}
				<a href="/?page={page + 1}" class="text-blue-600 hover:text-blue-800 hover:underline"
					>Next ›</a
				>
			{:else}
				<span class="text-gray-400">Next ›</span>
			{/if}
		</div>
	{/if}
</div>
