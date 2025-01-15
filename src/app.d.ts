// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Session } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			client: NodeOAuthClient;
			session?: Session
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
