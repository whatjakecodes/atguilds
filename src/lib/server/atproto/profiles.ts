import type { Agent, AtpAgent } from '@atproto/api';
import { createPublicAppviewClient } from './clients';

// app.bsky.actor.getProfiles accepts at most 25 actors per call.
const GET_PROFILES_BATCH = 25;

/**
 * Resolves DIDs to display names. Uses the authenticated agent when one is provided,
 * otherwise falls back to the public AppView so logged-out viewers still get names.
 *
 * Returns a `did -> displayName` map. Entries are omitted when a profile has no
 * display name (or a batch fails), so callers should fall back to a handle.
 */
export async function resolveDisplayNames(
	dids: string[],
	{ agent }: { agent?: Agent | null } = {}
): Promise<Record<string, string>> {
	const map: Record<string, string> = {};
	if (dids.length === 0) return map;

	const client: Agent | AtpAgent = agent ?? createPublicAppviewClient();

	for (let i = 0; i < dids.length; i += GET_PROFILES_BATCH) {
		const actors = dids.slice(i, i + GET_PROFILES_BATCH);
		try {
			const { data } = await client.app.bsky.actor.getProfiles({ actors });
			for (const profile of data.profiles) {
				if (profile.displayName) {
					map[profile.did] = profile.displayName;
				}
			}
		} catch (err) {
			console.error('failed to resolve display names', { err });
		}
	}

	return map;
}
