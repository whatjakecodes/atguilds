// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Session } from '$lib/types';
import type { Database } from '$lib/db';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			oauthClient: NodeOAuthClient;
			session?: Session;
			db: Database;
			resolver: BidirectionalResolver
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
