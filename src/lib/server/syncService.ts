import type { Agent } from '@atproto/api';
import type { Database } from '$lib/server/db';
import type { BidirectionalResolver } from '$lib/server/id-resolver';
import type { SyncSummary } from '$lib/types';
import guildService from '$lib/server/guildService';

export const DEFAULT_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Pure cooldown decision: how many ms remain before the user may sync again.
 * Returns 0 when there is no prior sync or the interval has elapsed.
 */
export function syncCooldownRemainingMs(
	lastSyncedAt: Date | null,
	now: Date,
	intervalMs: number
): number {
	if (!lastSyncedAt) return 0;
	return Math.max(0, intervalMs - (now.getTime() - lastSyncedAt.getTime()));
}

async function getLastSyncedAt(db: Database, did: string): Promise<Date | null> {
	const row = await db
		.selectFrom('sync_log')
		.select('lastSyncedAt')
		.where('did', '=', did)
		.executeTakeFirst();
	return row ? new Date(row.lastSyncedAt) : null;
}

async function markSynced(db: Database, did: string, when: Date): Promise<void> {
	const lastSyncedAt = when.toISOString();
	await db
		.insertInto('sync_log')
		.values({ did, lastSyncedAt })
		.onConflict((oc) => oc.column('did').doUpdateSet({ lastSyncedAt }))
		.execute();
}

export type RunSyncResult =
	| { rateLimited: true; retryAfterSeconds: number }
	| { rateLimited: false; summary: SyncSummary };

/**
 * Orchestrates an explicit sync with rate limiting. If the user synced within `intervalMs`,
 * returns a rate-limited result without running the (expensive) PDS reconciliation. Otherwise
 * runs syncLocals, records the sync time, and returns the summary.
 */
async function runSync(
	agent: Agent,
	db: Database,
	resolver: BidirectionalResolver,
	options: { intervalMs: number; now: Date }
): Promise<RunSyncResult> {
	const { intervalMs, now } = options;
	const did = agent.assertDid;

	const last = await getLastSyncedAt(db, did);
	const remaining = syncCooldownRemainingMs(last, now, intervalMs);
	if (remaining > 0) {
		return { rateLimited: true, retryAfterSeconds: Math.ceil(remaining / 1000) };
	}

	const summary = await guildService.syncLocals(agent, db, resolver);
	await markSynced(db, did, now);
	return { rateLimited: false, summary };
}

const syncService = {
	DEFAULT_SYNC_MIN_INTERVAL_MS,
	syncCooldownRemainingMs,
	getLastSyncedAt,
	markSynced,
	runSync
};

export default syncService;
