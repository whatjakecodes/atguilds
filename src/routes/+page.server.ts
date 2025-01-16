import guildService from '$lib/server/guildService';
import { getAgent } from '$lib/server/agent';
import {PUBLIC_VERCEL_URL} from '$env/static/public'
import {VERCEL_URL} from '$env/static/private'
import {env as publicEnv} from '$env/dynamic/public'
import {env as privateEnv} from '$env/dynamic/private'

export async function load({ locals, cookies }) {
	console.log({
		PUBLIC_VERCEL_URL,
		VERCEL_URL,
		dynamicPUBLIC_VERCEL_URL: publicEnv.PUBLIC_VERCEL_URL,
		dynamicVERCEL_URL: privateEnv.VERCEL_URL,
	});

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
			return {
				success: false,
				error: 'You must be logged in to create a new guild'
			};
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
			console.error({ err }, 'created guild failed');
			return {
				success: false,
				error: (err as Error).message
			};
		}
	}
};
