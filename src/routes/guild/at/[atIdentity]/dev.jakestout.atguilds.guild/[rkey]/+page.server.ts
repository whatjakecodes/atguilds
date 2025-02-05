import { getAgent } from '$lib/server/agent';
import guildService from '$lib/server/guildService';
import { type Actions, error, redirect } from '@sveltejs/kit';

export async function load({ params, locals, cookies }) {
	const atIdentity = params.atIdentity;
	const rkey = params.rkey;
	const agent = await getAgent(cookies, locals.session, locals.oauthClient);
	if (!agent) {
		error(401, 'Must be logged in');
	}

	const guild = await guildService.getGuild(atIdentity, rkey, locals.db);

	if (!guild) {
		error(404, 'guild not found');
	}

	const guildMembers = await guildService.getGuildMembers(atIdentity, rkey, locals.db);
	const invites = await guildService.getGuildInvites(guild.uri, locals.db);
	const didHandleMap = await locals.resolver.resolveDidsToHandles(
		guildMembers.map((m) => m.memberDid)
	);

	const didDisplayNameMap: { [key: string]: string } = {};
	for (const member of guildMembers) {
		const profile = await agent.getProfile({ actor: member.memberDid });
		didDisplayNameMap[member.memberDid] = profile.data.displayName!;
	}

	const response = await agent.getProfile({
		actor: agent.assertDid
	});
	return {
		guild,
		guildMembers,
		invites,
		profile: response.data,
		didHandleMap,
		didDisplayNameMap
	};
}

export const actions = {
	inviteMember: async ({ request, locals, cookies, params }) => {
		const agent = await getAgent(cookies, locals.session, locals.oauthClient);
		if (!agent) {
			return {
				success: false,
				error: 'You must be logged in to invite members'
			};
		}

		const guild = await guildService.getGuild(params.atIdentity!, params.rkey!, locals.db);
		if (!guild) {
			return {
				success: false,
				error: 'Guild does not exist'
			};
		}

		if (guild.leaderDid !== agent.assertDid) {
			return {
				success: false,
				error: 'Only leader can invite'
			};
		}

		const data = await request.formData();
		const inviteeHandle = data.get('memberHandle') as string;
		const didResponse = await agent.com.atproto.identity.resolveHandle({ handle: inviteeHandle });
		const inviteeDid = didResponse.data.did;

		if (inviteeDid.length < 1) {
			console.error('failed to lookup inviteeDid for ', inviteeHandle);
			return { success: false };
		}

		await guildService.inviteHandle(
			inviteeHandle,
			inviteeDid,
			guild.uri,
			locals.db,
			agent,
			locals.resolver
		);

		return {
			success: true
		};
	},
	removeMember: async ({ locals, request, params, cookies }) => {
		console.log('remove member');
		const agent = await getAgent(cookies, locals.session, locals.oauthClient);
		if (!agent) {
			return {
				success: false,
				error: 'You must be logged in to remove members'
			};
		}

		const formData = await request.formData();

		const memberDid = formData.get('memberDid') as string;
		if (!memberDid) {
			throw Error('must provide memberDid');
		}

		if (!params.atIdentity || !params.rkey) {
			throw Error('must include leader did and guild rkey');
		}

		await guildService.removeMember(memberDid, params.atIdentity, params.rkey, locals.db, agent);
	},
	deleteGuild: async ({ locals, params, cookies }) => {
		const agent = await getAgent(cookies, locals.session, locals.oauthClient);
		if (!agent) {
			return {
				success: false,
				error: 'You must be logged in to delete a guild'
			};
		}

		if (!params.atIdentity || !params.rkey) {
			throw Error('must include leader did and guild rkey');
		}

		await guildService.deleteGuild(params.atIdentity, params.rkey, locals.db, agent);

		throw redirect(303, `/`);
	}
} satisfies Actions;
