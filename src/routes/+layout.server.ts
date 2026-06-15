import { getAgent } from '$lib/server/agent';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const agent = await getAgent(cookies, locals.session, locals.oauthClient);
	if (!agent) {
		return { loggedIn: false, displayName: null as string | null };
	}

	try {
		const { data } = await agent.getProfile({ actor: agent.assertDid });
		return { loggedIn: true, displayName: data.displayName ?? null };
	} catch (err) {
		console.warn({ err }, 'failed to load profile for navbar');
		return { loggedIn: true, displayName: null as string | null };
	}
};
