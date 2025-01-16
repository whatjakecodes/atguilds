<script lang="ts">
	const { data } = $props();
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Portable ATProtocol Guilds" />
</svelte:head>

<section>
	<h1>
		ATGuilds
	</h1>

	{#if data.profile}
		<p>Logged in as: <span>{data.profile.displayName}</span></p>

		{#if data.guilds}
			<p>In guilds: </p>
			<ul>
				{#each data.guilds as g}
					<li>{g.name} | leader {g.leaderDid} | Created {g.createdAt}</li>
				{/each}
			</ul>
		{/if}

		<form method="POST" class="space-y-4">
			<div>
				<label for="guildName" class="block text-sm font-medium mb-1">
					Guild Name
				</label>
				<input
					type="text"
					id="guildName"
					name="guildName"
					class="w-full px-3 py-2 border rounded-md"
					required
					minlength="3"
					maxlength="50"
					placeholder="Enter guild name"
				/>
			</div>

			<button
				type="submit"
				class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
			>
				Create Guild
			</button>
		</form>
	{/if}
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        flex: 0.6;
    }

    h1 {
        width: 100%;
    }
</style>
