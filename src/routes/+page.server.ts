import guildService from '$lib/server/guildService';
import { getAgent } from '$lib/server/agent';
import { error, redirect } from '@sveltejs/kit';

export async function load({ locals, cookies }) {
	const agent = await getAgent(cookies, locals.session, locals.oauthClient);

	if (!agent) {
		return {
			profile: null
		};
	}

	const response = await agent.getProfile({
		actor: agent.assertDid
	});

	const handle = await locals.resolver.resolveDidToHandle(agent.assertDid);

	const guilds = await guildService.getUserGuilds(agent.assertDid, locals.db);
	const invites = await guildService.getUserInvites(handle, locals.db);

	return {
		profile: response.data,
		guilds,
		invites: invites
	};
}

export const actions = {
	createGuild: async ({ request, locals, cookies }) => {
		const agent = await getAgent(cookies, locals.session, locals.oauthClient);
		if (!agent) {
			error(401, 'You must be logged in to create a new guild');
		}

		const data = await request.formData();
		const guildName = data.get('guildName') as string;

		try {
			const created = await guildService.create(agent, locals.db, guildName);
			return {
				success: true,
				guild: created
			};
		} catch (err) {
			console.error({ err }, 'create guild failed');
			return {
				success: false,
				error: (err as Error).message
			};
		}
	},

	acceptInvite: async ({ request, locals, cookies }) => {
		const agent = await getAgent(cookies, locals.session, locals.oauthClient);
		if (!agent) {
			error(401, 'You must be logged in to accept an invite');
		}

		const data = await request.formData();
		const inviteId = data.get('inviteId') as string;
		const handle = await locals.resolver.resolveDidToHandle(agent.assertDid);

		let guildUri = '';
		try {
			const result = await guildService.acceptInvite(parseInt(inviteId), handle, locals.db, agent);
			if (!result) {
				throw new Error("failed to accept invite")
			}
			guildUri = result.uri.replace('at://', 'at/');
		} catch (err) {
			console.error({ err }, 'accept invite failed');
			return {
				type: 'error',
				error: (err as Error).message
			};
		}
		throw redirect(303, `/guild/${guildUri}`);
	}
};
