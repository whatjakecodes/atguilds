import guildService from '$lib/server/guildService';
import { getAgent } from '$lib/server/agent';
import { error } from '@sveltejs/kit';

export async function load({ locals, cookies }) {
	const agent = await getAgent(cookies, locals.session, locals.client);

	if (!agent) {
		return {
			profile: null
		};
	}

	const response = await agent.getProfile({
		actor: agent.assertDid
	});

	const guilds = await guildService.getUserGuilds(agent.assertDid, locals.db);

	return {
		profile: response.data,
		guilds
	};
}

export const actions = {
	default: async ({ request, locals, cookies }) => {
		const agent = await getAgent(cookies, locals.session, locals.client);
		if (!agent) {
			error(401, 'You must be logged in to create a new guild')
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
	}
};
