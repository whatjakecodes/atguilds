<script lang="ts">
	import LoginForm from '$lib/components/LoginForm.svelte';

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

<div class="container mx-auto px-4 py-8">
	{#if data.profile}
		<h2 class="text-xl font-semibold mb-8">Hi, <span class="text-gray-600">{data.profile.displayName}</span>
			<form method="POST" action="/login?/logout" class="">
				<button
					type="submit"
					class="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm"
					aria-label="Logout from your account"
				>
					Logout
				</button>
			</form>
		</h2>

		<div class="flex flex-col md:flex-row gap-8">
			<!-- Left Column - Guild Lists -->
			<div class="w-full md:w-1/2 space-y-6">

				{#if leaderOfGuilds.length > 0}
					<div class="bg-white p-4 rounded-lg shadow">
						<h3 class="font-medium mb-2">Leader of:</h3>
						<ul class="space-y-2">
							{#each leaderOfGuilds as g}
								<li>
									<a href="/guild/{g.uri.replace('at://', 'at/')}"
										 class="text-blue-600 hover:text-blue-800 hover:underline">
										{g.name}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if memberOfGuilds.length > 0}
					<div class="bg-white p-4 rounded-lg shadow">
						<h3 class="font-medium mb-2">Member of:</h3>
						<ul class="space-y-2">
							{#each memberOfGuilds as g}
								<li>
									<a href="/guild/{g.uri.replace('at://', 'at/')}"
										 class="text-blue-600 hover:text-blue-800 hover:underline">
										{g.name}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if data.invites}
					<div class="bg-white p-4 rounded-lg shadow">
						<h3 class="font-medium mb-2">Invites:</h3>
						<ul class="space-y-2">
							{#each data.invites as i}
								<li>
									<form method="POST" action="?/acceptInvite" class="flex items-center gap-2">
										<input type="hidden" name="inviteId" value={i.inviteId} />
										<span>{i.guildName}</span>
										<button type="submit"
														class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:underline">
											Accept
										</button>
									</form>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<button onclick={handleSyncClick}
								class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded">
					Sync with PDS
				</button>
			</div>

			<!-- Right Column - Create Guild Form -->
			<div class="w-full md:w-1/2">
				<div class="bg-white p-6 rounded-lg shadow">
					<h2 class="text-xl font-semibold mb-4">Create Guild</h2>
					<form method="POST" action="?/createGuild" class="space-y-4">
						<div>
							<label for="guildName" class="block text-sm font-medium text-gray-700 mb-1">
								Guild Name
							</label>
							<input
								type="text"
								id="guildName"
								name="guildName"
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
								required
								minlength="3"
								maxlength="50"
								placeholder="Enter guild name"
							/>
						</div>

						<button
							type="submit"
							class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							Create Guild
						</button>
					</form>
				</div>
			</div>
		</div>
	{:else}
		<div class="w-full sm:w-1/2 mx-auto">
			<LoginForm />
		</div>
	{/if}
</div>