<script lang="ts">
	const { data } = $props();
	const { profile, guild, guildMembers, didHandleMap, invites } = data;
	const isLeader = guild.leaderDid === profile.did;

	function isMember(did: string) {
		return guild.leaderDid !== did;
	}
</script>

<section>
	{#if guild}
		<h1>{guild.name}</h1>
		<p>Leader: {didHandleMap[guild.leaderDid]}</p>
		<p>Members:</p>
		<ul>
			{#each guildMembers as member}
				<li>
					<span>{didHandleMap[member.memberDid]}</span>
					{#if isLeader && isMember(member.memberDid)}
						<form method="POST" action="?/removeMember">
							<input type="hidden" id="memberDid" name="memberDid" value={member.memberDid} />
							<button>Remove</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>

		<p>Invites:</p>
		<ul>
			{#each invites as invite}
				<li>{invite.invitee}</li>
			{/each}
		</ul>
	{/if}
</section>
<section>
	{#if isLeader}
		<h1>Leader Controls</h1>
		<section>
			<h2>Invite Member</h2>
			<form method="POST" action="?/inviteMember" class="space-y-4">
				<div>
					<label for="memberHandle" class="block text-sm font-medium mb-1">
						Member Handle:
					</label>
					<input
						type="text"
						id="memberHandle"
						name="memberHandle"
						class="w-full px-3 py-2 border rounded-md"
						required
						minlength="3"
						maxlength="50"
						placeholder="Enter a handle (eg bob.bsky.social)"
					/>
				</div>

				<button
					type="submit"
					class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
				>
					Invite
				</button>
			</form>
		</section>
		<section>
			<h2>Delete Guild</h2>
			<form method="POST" action="?/deleteGuild">
				<button>Delete</button>
			</form>
		</section>
	{/if}

</section>