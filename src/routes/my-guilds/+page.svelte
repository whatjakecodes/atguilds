<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { SyncSummary } from '$lib/types';

	const { data } = $props();

	let syncing = $state(false);
	let syncSummary = $state<SyncSummary | null>(null);
	let syncError = $state(false);
	let syncNotice = $state<string | null>(null);

	const syncChanged = $derived(
		!!syncSummary &&
			syncSummary.guilds.created.length +
				syncSummary.guilds.deleted.length +
				syncSummary.guildMemberClaims.created.length +
				syncSummary.guildMemberClaims.deleted.length >
				0
	);

	async function handleSyncClick() {
		syncing = true;
		syncError = false;
		syncSummary = null;
		syncNotice = null;
		try {
			const res = await fetch('/sync');
			const body = await res.json();
			if (res.status === 429) {
				const minutes = Math.ceil((body.retryAfterSeconds ?? 0) / 60);
				syncNotice = `You synced recently — try again in ${minutes} minute(s).`;
				return;
			}
			syncSummary = body.summary ?? null;
			// Re-run the page load to refresh the guild lists reactively (no full reload, so the
			// summary message survives).
			await invalidateAll();
		} catch (error) {
			console.error('Error syncing data:', error);
			syncError = true;
		} finally {
			syncing = false;
		}
	}

	const memberOfGuilds = $derived(
		data.guilds ? data.guilds.filter((guild) => guild.leaderDid !== data.profile.did) : []
	);
	const leaderOfGuilds = $derived(
		data.guilds ? data.guilds.filter((guild) => guild.leaderDid === data.profile.did) : []
	);
</script>

<svelte:head>
	<title>ATGuilds - My Guilds</title>
	<meta name="description" content="Your guilds on ATProtocol" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h2 class="text-xl font-semibold mb-8">My Guilds</h2>

	<div class="flex flex-col md:flex-row gap-8">
		<!-- Left Column - Guild Lists -->
		<div class="w-full md:w-1/2 space-y-6">
			{#if leaderOfGuilds.length > 0}
				<div class="bg-white p-4 rounded-lg shadow">
					<h3 class="font-medium mb-2">Leader of:</h3>
					<ul class="space-y-2">
						{#each leaderOfGuilds as g}
							<li>
								<a
									href="/guild/{g.uri.replace('at://', 'at/')}"
									class="text-blue-600 hover:text-blue-800 hover:underline"
								>
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
								<a
									href="/guild/{g.uri.replace('at://', 'at/')}"
									class="text-blue-600 hover:text-blue-800 hover:underline"
								>
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
									<button
										type="submit"
										class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
									>
										Accept
									</button>
								</form>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<button
				onclick={handleSyncClick}
				disabled={syncing}
				aria-busy={syncing}
				title="Refresh this app's data from your ATProto PDS: re-fetches the guilds you lead and the memberships you've claimed, adding anything missing and removing entries that no longer exist on your PDS."
				class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{#if syncing}
					<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
					</svg>
					Syncing…
				{:else}
					Sync with PDS
				{/if}
			</button>

			{#if syncError}
				<p class="text-sm text-red-600" role="alert">Sync failed. Please try again.</p>
			{:else if syncNotice}
				<p class="text-sm text-gray-600" role="status">{syncNotice}</p>
			{:else if syncSummary}
				{#if syncChanged}
					<p class="text-sm text-gray-600" role="status">
						Synced — guilds: +{syncSummary.guilds.created.length} / −{syncSummary.guilds.deleted
							.length} · member claims: +{syncSummary.guildMemberClaims.created.length} / −{syncSummary
							.guildMemberClaims.deleted.length}
					</p>
				{:else}
					<p class="text-sm text-gray-600" role="status">Already up to date.</p>
				{/if}
			{/if}
		</div>

		<!-- Right Column - Create Guild Form -->
		<div class="w-full md:w-1/2">
			<div class="bg-white p-6 rounded-lg shadow">
				<h2 class="text-xl font-semibold mb-4">Create a new guild</h2>
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
							placeholder="e.g. The Lollipop Guild"
						/>
					</div>

					<button
						type="submit"
						class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						Create
					</button>
				</form>
			</div>
		</div>
	</div>
</div>
