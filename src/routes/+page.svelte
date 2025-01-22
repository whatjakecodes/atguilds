<script lang="ts">
	const { data } = $props();

	async function handleSyncClick() {
		try {
			await fetch('/sync');
			window.location.reload();
		} catch (error) {
			console.error('Error syncing data:', error);
		}
	}

	const memberOfGuilds = data.guilds ? data.guilds.filter(guild => guild.leaderDid !== data.profile.did) : [];
	const leaderOfGuilds = data.guilds ? data.guilds.filter(guild => guild.leaderDid === data.profile.did) : [];
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
		<h1>Hi, <span>{data.profile.displayName}</span></h1>

		{#if leaderOfGuilds.length > 0}
			<span>Leader of: </span>
			<ul>
				{#each leaderOfGuilds as g}
					<li><a href="/guild/{g.uri.replace('at://', 'at/')}">{g.name}</a></li>
				{/each}
			</ul>
		{/if}

		{#if memberOfGuilds.length > 0}
			<span>Member of: </span>
			<ul>
				{#each memberOfGuilds as g}
					<li><a href="/guild/{g.uri.replace('at://', 'at/')}">{g.name}</a></li>
				{/each}
			</ul>
		{/if}

		{#if data.invites}
			<span>Invites: </span>
			<ul>
				{#each data.invites as i}
					<li>

						<form
							method="POST"
							action="?/acceptInvite"
						>
							<input type="hidden" name="inviteId" value={i.inviteId} />
							<span>{i.guildName}</span>
							<button type="submit" class="link-button">
								Accept
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		<form method="POST" action="?/createGuild" class="space-y-4">
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

		<section>
			<button onclick={handleSyncClick}>
				Sync with PDS
			</button>
		</section>
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
