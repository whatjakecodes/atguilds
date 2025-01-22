<script lang="ts">
	const { data } = $props();
	const { profile, guild, guildMembers, didHandleMap, invites } = data;
	const isLeader = guild.leaderDid === profile.did;

	function isMember(did: string) {
		return guild.leaderDid !== did;
	}
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold text-gray-900 mb-8">{guild.name}</h1>

	<div class="flex flex-col md:flex-row gap-8">
		<!-- Left Column - Members List -->
		<div class="w-full md:w-1/2">
			<div class="bg-white rounded-lg shadow-lg p-6">
				<div class="mb-6">
					<h2 class="text-xl font-semibold mb-2">Leader</h2>
					<p class="text-gray-700">{didHandleMap[guild.leaderDid]}</p>
				</div>

				<div class="mb-6">
					<h2 class="text-xl font-semibold mb-4">Members</h2>
					<ul class="space-y-3">
						{#each guildMembers as member}
							<li class="flex items-center justify-between">
								<span class="text-gray-700">{didHandleMap[member.memberDid]}</span>
								{#if isLeader && isMember(member.memberDid)}
									<form method="POST" action="?/removeMember" class="inline">
										<input type="hidden" id="memberDid" name="memberDid" value={member.memberDid} />
										<button class="text-red-600 hover:text-red-800 text-sm font-medium">
											Remove
										</button>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				</div>

				{#if invites.length > 0}
					<div>
						<h2 class="text-xl font-semibold mb-4">Pending Invites</h2>
						<ul class="space-y-2">
							{#each invites as invite}
								<li class="text-gray-600">{invite.invitee}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>

		<!-- Right Column - Leader Controls -->
		{#if isLeader}
			<div class="w-full md:w-1/2 space-y-6">
				<div class="bg-white rounded-lg shadow-lg p-6">
					<h2 class="text-xl font-semibold mb-6">Invite Member</h2>
					<form method="POST" action="?/inviteMember" class="space-y-4">
						<div>
							<label for="memberHandle" class="block text-sm font-medium text-gray-700 mb-1">
								Member Handle:
							</label>
							<input
								type="text"
								id="memberHandle"
								name="memberHandle"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
								minlength="3"
								maxlength="50"
								placeholder="Enter a handle (eg bob.bsky.social)"
							/>
						</div>

						<button
							type="submit"
							class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							Invite Member
						</button>
					</form>
				</div>

				<div class="bg-white rounded-lg shadow-lg p-6">
					<h2 class="text-xl font-semibold mb-4">Delete Guild</h2>
					<p class="text-gray-600 mb-4">This action cannot be undone.</p>
					<form method="POST" action="?/deleteGuild">
						<button
							class="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
						>
							Delete Guild
						</button>
					</form>
				</div>
			</div>
		{/if}
	</div>
</div>