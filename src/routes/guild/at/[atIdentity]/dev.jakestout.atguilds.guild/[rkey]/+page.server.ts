import { getAgent } from '$lib/server/agent';
import guildService from '$lib/server/guildService';
import { resolveDisplayNames } from '$lib/server/atproto/profiles';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';

export const load: ServerLoad = async ({ params, locals, cookies }) => {
	const atIdentity = params.atIdentity;
	const rkey = params.rkey;
	if (!atIdentity || !rkey) {
		error(400, 'Invalid path. Missing params.');
	}

	// Browsing is public: a logged-out visitor can view any cached guild. An authenticated
	// agent is only needed for the leader-only controls below.
	const agent = await getAgent(cookies, locals.session, locals.oauthClient);

	const guild = await guildService.getGuild(atIdentity, rkey, locals.db).catch(() => null);
	if (!guild) {
		error(404, 'guild not found');
	}

	const guildMembers = await guildService.getGuildMembers(atIdentity, rkey, locals.db);
	const memberDids = guildMembers.map((m) => m.memberDid);
	const didHandleMap = await locals.resolver.resolveDidsToHandles(memberDids);
	const didDisplayNameMap = await resolveDisplayNames(memberDids, { agent });

	const profile = agent ? (await agent.getProfile({ actor: agent.assertDid })).data : null;
	const isLeader = !!profile && guild.leaderDid === profile.did;

	// Pending invites expose invited handles, so only the leader sees them.
	const invites = isLeader ? await guildService.getGuildInvites(guild.uri, locals.db) : [];

	return {
		guild,
		guildMembers,
		invites,
		profile,
		didHandleMap,
		didDisplayNameMap
	};
};

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

		throw redirect(303, `/my-guilds`);
	}
} satisfies Actions;
