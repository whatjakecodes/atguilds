import { Agent } from '@atproto/api';
import type { Cookies } from '@sveltejs/kit';

async function getAgent(locals: App.Locals, cookies: Cookies) {
	if (!locals.session) return null;
	try {
		const oauthSession = await locals.client.restore(locals.session.did);
		return oauthSession ? new Agent(oauthSession) : null;
	} catch (err) {
		console.warn({ err }, 'oauth restore failed');
		cookies.delete('sid', {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
		return null;
	}
}

export async function load({ locals, cookies }) {
	const agent = await getAgent(locals, cookies);

	if (!agent) {
		return {
			profile: null
		};
	}

	const response = await agent.getProfile({
		actor: agent.assertDid
	});

	return {
		profile: response.data,
	};
}
