<script lang="ts">
	const { data } = $props();
	const { guild, guildMembers, didHandleMap, invites } = data;
</script>

<section>
	{#if guild}
		<h1>{guild.name}</h1>
		<p>Leader: {didHandleMap[guild.leaderDid]}</p>
		<p>Members:</p>
		<ul>
			{#each guildMembers as member}
				<li>{didHandleMap[member.memberDid]}</li>
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
	<h1>Invite Member</h1>
	<form method="POST" class="space-y-4">
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
				placeholder="Enter handle"
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