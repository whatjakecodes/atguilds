import { expect, test } from '@playwright/test';
import { resetGuildRecords } from './helpers/atproto';
import { loginViaOAuth } from './helpers/oauth';

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing env var ${name}. Copy .env.test.example to .env.test and fill it in.`);
	}
	return value;
}

const USER1_HANDLE = requireEnv('TEST_USER1_HANDLE');
const USER1_PASSWORD = requireEnv('TEST_USER1_PASSWORD');
const USER2_HANDLE = requireEnv('TEST_USER2_HANDLE');
const USER2_PASSWORD = requireEnv('TEST_USER2_PASSWORD');

// Unique per run so assertions and the Accept button target this guild even if older
// rows from previous runs are still cached in Postgres.
const guildName = `E2E Guild ${Date.now()}`;

test.describe('guild create -> invite -> accept', () => {
	test.beforeAll(async () => {
		await resetGuildRecords(USER1_HANDLE, USER1_PASSWORD);
		await resetGuildRecords(USER2_HANDLE, USER2_PASSWORD);
	});

	test('leader creates a guild, invites a member, member accepts', async ({ browser }) => {
		// --- User 1 (leader): log in, create guild, invite user 2 ---
		const leaderCtx = await browser.newContext();
		const leader = await leaderCtx.newPage();
		await loginViaOAuth(leader, USER1_HANDLE, USER1_PASSWORD);

		await leader.fill('#guildName', guildName);
		await leader.getByRole('button', { name: 'Create' }).click();

		// Redirected to the guild detail page.
		await expect(leader).toHaveURL(/\/guild\/at\//);
		await expect(leader.getByRole('heading', { name: guildName })).toBeVisible();

		await leader.fill('#memberHandle', USER2_HANDLE);
		await leader.getByRole('button', { name: 'Invite Member' }).click();

		// User 2 now appears under "Pending Invites".
		await expect(leader.getByRole('heading', { name: 'Pending Invites' })).toBeVisible();
		await expect(leader.getByText(USER2_HANDLE, { exact: false })).toBeVisible();

		// --- User 2 (invitee): log in, accept the invite ---
		const memberCtx = await browser.newContext();
		const member = await memberCtx.newPage();
		await loginViaOAuth(member, USER2_HANDLE, USER2_PASSWORD);

		// The invite shows up in the "Invites" list on the home page.
		const inviteRow = member.locator('li', { hasText: guildName });
		await expect(inviteRow).toBeVisible();
		await inviteRow.getByRole('button', { name: 'Accept' }).click();

		// Accepting redirects to the guild page; the member now sees the guild.
		await expect(member).toHaveURL(/\/guild\/at\//);
		await expect(member.getByRole('heading', { name: guildName })).toBeVisible();

		await leaderCtx.close();
		await memberCtx.close();
	});
});
