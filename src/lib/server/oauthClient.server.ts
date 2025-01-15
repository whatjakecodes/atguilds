import { VITE_VERCEL_URL } from '$env/static/private';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { SessionStore, StateStore } from './storage';
import type { Database } from '$lib/server/db';
import { getLocalPort } from '$lib/server/getLocalPort';

export const createClient = async (db: Database) => {
	const enc = encodeURIComponent;

	const publicUrl = VITE_VERCEL_URL;
	const url = publicUrl || `http://127.0.0.1:${getLocalPort()}`;

	console.log({
		VITE_VERCEL_URL,
		url
	});

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
