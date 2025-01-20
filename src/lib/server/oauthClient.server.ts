import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { PORT } from '$env/static/private';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { SessionStore, StateStore } from './storage';
import type { Database } from '$lib/server/db';

export const createClient = async (db: Database) => {
	const enc = encodeURIComponent;
	let publicUrl = env.PUBLIC_OAUTH_REDIRECT_URL;
	if (env.PUBLIC_OAUTH_REDIRECT_URL) {
		console.log(`Using PUBLIC_OAUTH_REDIRECT_URL for oauth redirect: ${publicUrl}`);
	}

	if (privateEnv.VERCEL_URL) {
		publicUrl = prependHttps(privateEnv.VERCEL_URL);
		console.log(`Using VERCEL_URL for oauth redirect: ${publicUrl}`);
	}
	const url = publicUrl || `http://127.0.0.1:${PORT}`;
	return new NodeOAuthClient({
		clientMetadata: {
			client_name: 'ATGuilds SvelteKit App',
			client_id: publicUrl
				? `${url}/client-metadata.json`
				: `http://localhost?redirect_uri=${enc(`${url}/oauth/callback`)}&scope=${enc('atproto transition:generic')}`,
			client_uri: url,
			redirect_uris: [`${url}/oauth/callback`],
			scope: 'atproto transition:generic',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			application_type: 'web',
			token_endpoint_auth_method: 'none',
			dpop_bound_access_tokens: true
		},
		sessionStore: new SessionStore(db),
		stateStore: new StateStore(db)
	});
};

const prependHttps = (url) => {
	if (!url.match(/^https?:\/\//i)) {
		return `https://${url}`;
	}
	return url;
};