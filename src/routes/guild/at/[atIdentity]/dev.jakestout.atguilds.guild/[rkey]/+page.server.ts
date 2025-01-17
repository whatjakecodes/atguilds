import { getAgent } from '$lib/server/agent';
import guildService from '$lib/server/guildService';
import { error } from '@sveltejs/kit';

export async function load({ params, locals, cookies }) {
	const atIdentity = params.atIdentity;
	const rkey = params.rkey;
	const agent = await getAgent(cookies, locals.session, locals.client);
	if (!agent) {
		error(401, 'Must be logged in');
	}

	const guild = await guildService.getGuild(atIdentity, rkey, locals.db);

	if (!guild) {
		error(404, 'guild not found');
	}

	const guildMembers = await guildService.getGuildMembers(atIdentity, rkey, locals.db);
	const invites = await guildService.getGuildInvites(guild.uri, locals.db);
	const didHandleMap = await locals.resolver.resolveDidsToHandles(guildMembers.map(m => m.memberDid));
	return {
		guild,
		guildMembers,
		invites,
		didHandleMap
	};
}

export const actions = {
	default: async ({ request, locals, cookies, params }) => {
		const agent = await getAgent(cookies, locals.session, locals.client);
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
		const handle = data.get('memberHandle') as string;

		console.log(`POST invite guild.uri: ${guild.uri}`);

		const invite = await guildService.inviteHandle(handle, guild.uri, locals.db);
		return {
			success: false,
			invite
		};
	}
};
