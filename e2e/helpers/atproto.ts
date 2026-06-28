import { AtpAgent } from '@atproto/api';

// NSIDs from the custom lexicons (src/lib/lexicon/lexicons.ts -> `ids`). Hardcoded here
// because the e2e suite runs under Playwright's own loader, not through the SvelteKit
// `$lib` alias.
const GUILD_COLLECTIONS = [
	'dev.jakestout.atguilds.guild',
	'dev.jakestout.atguilds.guildMemberClaim'
] as const;

/**
 * Deletes every ATGuilds record (guild + guildMemberClaim) from a user's PDS repo,
 * giving the e2e flow a clean slate. Logs in with the account's main password via the
 * com.atproto createSession auth (the app itself uses OAuth, but this is just for test
 * setup, and the same password must work on the bsky OAuth sign-in page too).
 */
export async function resetGuildRecords(
	handle: string,
	password: string,
	service = process.env.PDS_SERVICE || 'https://bsky.social'
): Promise<void> {
	const agent = new AtpAgent({ service });
	await agent.login({ identifier: handle, password });
	const repo = agent.assertDid;

	for (const collection of GUILD_COLLECTIONS) {
		let cursor: string | undefined;
		do {
			const res = await agent.com.atproto.repo.listRecords({
				repo,
				collection,
				cursor,
				limit: 100
			});
			for (const record of res.data.records) {
				const rkey = record.uri.split('/').at(-1)!;
				await agent.com.atproto.repo.deleteRecord({ repo, collection, rkey });
			}
			cursor = res.data.cursor;
		} while (cursor);
	}
}

const GUILD_COLLECTION = 'dev.jakestout.atguilds.guild';

/**
 * Creates a guild record on the leader's PDS in the LEGACY shape: `members` is an array of
 * plain DID strings with no per-member `addedAt`. PDSes don't validate custom lexicons, so the
 * old shape is accepted as-is. Used to set up the "needs upgrade" precondition for the auto-upgrade
 * that runs in syncLocals when the leader next logs in. Returns the guild's at:// URI and the
 * `createdAt` it was given (the expected `addedAt` fallback after upgrade).
 */
export async function createLegacyGuild(
	handle: string,
	password: string,
	guildName: string,
	extraMemberDids: string[] = [],
	service = process.env.PDS_SERVICE || 'https://bsky.social'
): Promise<{ guildUri: string; createdAt: string }> {
	const agent = new AtpAgent({ service });
	await agent.login({ identifier: handle, password });
	const repo = agent.assertDid;
	const createdAt = new Date().toISOString();

	const res = await agent.com.atproto.repo.createRecord({
		repo,
		collection: GUILD_COLLECTION,
		record: {
			$type: GUILD_COLLECTION,
			name: guildName,
			leader: repo,
			members: [repo, ...extraMemberDids], // legacy shape: bare DID strings, no addedAt
			createdAt
		}
	});

	return { guildUri: res.data.uri, createdAt };
}

/** Fetches a guild record from the leader's PDS and returns its raw `value` for inspection. */
export async function getPdsGuildValue(
	handle: string,
	password: string,
	guildUri: string,
	service = process.env.PDS_SERVICE || 'https://bsky.social'
): Promise<Record<string, unknown>> {
	const agent = new AtpAgent({ service });
	await agent.login({ identifier: handle, password });
	const rkey = guildUri.split('/').at(-1)!;
	const res = await agent.com.atproto.repo.getRecord({
		repo: agent.assertDid,
		collection: GUILD_COLLECTION,
		rkey
	});
	return res.data.value as Record<string, unknown>;
}

const GUILD_MEMBER_CLAIM_COLLECTION = 'dev.jakestout.atguilds.guildMemberClaim';

/**
 * Deletes the guildMemberClaim record on a user's PDS that points at `guildUri`.
 * Simulates a member leaving a guild by removing their own claim, leaving the local
 * Postgres cache (and the leader's guild.members array) stale until the next sync.
 */
export async function deleteGuildMemberClaim(
	handle: string,
	password: string,
	guildUri: string,
	service = process.env.PDS_SERVICE || 'https://bsky.social'
): Promise<void> {
	const agent = new AtpAgent({ service });
	await agent.login({ identifier: handle, password });
	const repo = agent.assertDid;

	let cursor: string | undefined;
	do {
		const res = await agent.com.atproto.repo.listRecords({
			repo,
			collection: GUILD_MEMBER_CLAIM_COLLECTION,
			cursor,
			limit: 100
		});
		for (const record of res.data.records) {
			const value = record.value as { guildUri?: string };
			if (value?.guildUri === guildUri) {
				const rkey = record.uri.split('/').at(-1)!;
				await agent.com.atproto.repo.deleteRecord({
					repo,
					collection: GUILD_MEMBER_CLAIM_COLLECTION,
					rkey
				});
			}
		}
		cursor = res.data.cursor;
	} while (cursor);
}
