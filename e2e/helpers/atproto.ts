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
