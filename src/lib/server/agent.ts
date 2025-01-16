import type { Cookies } from '@sveltejs/kit';
import { Agent } from '@atproto/api';
import type { Session } from '$lib/types';
import { NodeOAuthClient } from '@atproto/oauth-client-node';

export async function getAgent(cookies: Cookies, session?: Session, client?: NodeOAuthClient) {
	if (!session || !client) return null;
	try {
		const oauthSession = await client.restore(session.did);
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