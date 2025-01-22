import { getAgent } from '$lib/server/agent';
import guildService from '$lib/server/guildService';
import { error } from '@sveltejs/kit';

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
	return {
		guild,
		guildMembers,
		invites,
		didHandleMap
	};
}

export const actions = {
	default: async ({ request, locals, cookies, params }) => {
		const agent = await getAgent(cookies, locals.session, locals.oauthClient);
		if (!agent) {
			return {
				success: false,
				error: 'You must be logged in to invite members'
			};
		}

		const guild = await guildService.getGuild(params.atIdentity, params.rkey, locals.db);
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
		// const inviteeDid = (await locals.resolver.resolveDidToHandle(inviteeHandle)) as string;
		const didResponse = await agent.com.atproto.identity.resolveHandle({ handle: inviteeHandle });
		const inviteeDid = didResponse.data.did;
		console.log({ inviteeHandle, inviteeDid });
		if (inviteeDid.length < 1) {
			console.error('failed to lookup inviteeDid for ', inviteeHandle);
			return { success: false };
		}

		const invite = await guildService.inviteHandle(
			inviteeHandle,
			inviteeDid,
			guild.uri,
			locals.db,
			agent
		);
		return {
			success: false,
			invite
		};
	}
};
