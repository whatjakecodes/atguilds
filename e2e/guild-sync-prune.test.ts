import { expect, test } from '@playwright/test';
import { deleteGuildMemberClaim, resetGuildRecords } from './helpers/atproto';
import { loginViaOAuth } from './helpers/oauth';
import { createGuildWithMember } from './helpers/flows';
import { USER1_HANDLE, USER1_PASSWORD, USER2_HANDLE, USER2_PASSWORD } from './helpers/env';

test.describe('sync prunes stale members', () => {
	test.beforeAll(async () => {
		await resetGuildRecords(USER1_HANDLE, USER1_PASSWORD);
		await resetGuildRecords(USER2_HANDLE, USER2_PASSWORD);
	});

	test('USER2 deletes their claim; USER1 sync removes them from the cache', async ({ browser }) => {
		const guildName = `E2E Sync ${Date.now()}`;
		const { guildUri } = await createGuildWithMember(
			browser,
			{ handle: USER1_HANDLE, password: USER1_PASSWORD },
			{ handle: USER2_HANDLE, password: USER2_PASSWORD },
			guildName
		);
		const guildPath = '/guild/' + guildUri.replace('at://', 'at/');

		// USER1 logs in. The OAuth callback runs syncLocals while USER2's claim still
		// exists, so USER2 legitimately remains a member at this point.
		const ctx = await browser.newContext();
		const leader = await ctx.newPage();
		await loginViaOAuth(leader, USER1_HANDLE, USER1_PASSWORD);

		await leader.goto(guildPath);
		await expect(leader.getByText(USER2_HANDLE, { exact: false })).toBeVisible();

		// USER2 deletes their guildMemberClaim directly on their PDS. Nothing re-syncs yet,
		// so the local Postgres cache is now stale: USER1 still sees USER2.
		await deleteGuildMemberClaim(USER2_HANDLE, USER2_PASSWORD, guildUri);

		await leader.goto(guildPath);
		await expect(leader.getByText(USER2_HANDLE, { exact: false })).toBeVisible();

		// Click "Sync with PDS" on My Guilds; handleSyncClick fetches /sync then reloads.
		await leader.goto('/my-guilds');
		await leader.getByRole('button', { name: 'Sync with PDS' }).click();
		await leader.waitForLoadState('networkidle');

		// Re-view the guild: USER2 has been pruned, USER1 (leader) remains.
		await leader.goto(guildPath);
		await expect(leader.getByText(USER2_HANDLE, { exact: false })).toHaveCount(0);
		await expect(leader.getByText(USER1_HANDLE, { exact: false })).toBeVisible();

		await ctx.close();
	});
});
