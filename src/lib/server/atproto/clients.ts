import { AtpAgent } from '@atproto/api';

const PUBLIC_APPVIEW_SERVICE = 'https://public.api.bsky.app';

/**
 * Unauthenticated client for the public Bluesky AppView. Use for read-only lookups
 * (e.g. profiles) that should work for logged-out visitors.
 */
export function createPublicAppviewClient(): AtpAgent {
	return new AtpAgent({ service: PUBLIC_APPVIEW_SERVICE });
}

/** Unauthenticated client pointed at a specific PDS endpoint, for repo reads. */
export function createPdsClient(endpoint: string): AtpAgent {
	return new AtpAgent({ service: endpoint });
}
