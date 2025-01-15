import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { SessionStore, StateStore } from './storage'
import type { Database } from '$lib/server/db';

export const createClient = async (db: Database) => {
	const enc = encodeURIComponent;

	console.log({
		PUBLIC_URL: publicEnv.PUBLIC_URL
	});

	const publicUrl = publicEnv.PUBLIC_URL;
	const url = publicUrl || `http://127.0.0.1:${privateEnv.PORT}`;
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
