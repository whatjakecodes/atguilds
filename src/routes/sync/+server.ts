import type { RequestHandler } from '@sveltejs/kit';
import guildService from '$lib/server/guildService';
import { getAgent } from '$lib/server/agent';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const agent = await getAgent(cookies, locals.session, locals.client);
	if (!agent) {
		return new Response(JSON.stringify({ success: false }), {
			headers: {
				'content-type': 'application/json'
			}
		});
	}

	await guildService.syncLocals(agent, locals.db);
	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'content-type': 'application/json'
		}
	});

};
