import guildService from '$lib/server/guildService';
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { getAgent } from '$lib/server/agent';

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const params = url.searchParams;
	try {
		const { session } = await locals.oauthClient.callback(params);

		// todo: encrypt this or secure it otherwise
		cookies.set('sid', session.did, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});

		const agent = await getAgent(cookies, session, locals.oauthClient);
		await guildService.syncLocals(agent, locals.db, locals.resolver)
	} catch (err) {
		console.error({ err }, 'oauth callback failed');
		throw redirect(303, '/?error');
	}

	throw redirect(303, '/');
};
