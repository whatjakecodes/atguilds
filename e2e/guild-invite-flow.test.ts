import { expect, test, type Page } from '@playwright/test';
import { resetGuildRecords } from './helpers/atproto';
import { loginViaOAuth } from './helpers/oauth';
import { USER1_HANDLE, USER1_PASSWORD, USER2_HANDLE, USER2_PASSWORD } from './helpers/env';

// Unique per run so assertions and the Accept button target this guild even if older
// rows from previous runs are still cached in Postgres.
const guildName = `E2E Guild ${Date.now()}`;

// The Browse list is global and paginated (10/page), so the freshly created guild may not
// be on page 1. Walk the pages until we find its link (or run out of pages).
async function findGuildInBrowse(page: Page, name: string) {
	for (let p = 1; p <= 25; p++) {
		await page.goto(`/?page=${p}`);
		const link = page.getByRole('link', { name, exact: true });
		if ((await link.count()) > 0) {
			return link.first();
		}
		if ((await page.getByRole('link', { name: 'Next ›' }).count()) === 0) {
			break;
		}
	}
	return null;
}

test.describe('guild create -> invite -> accept', () => {
	test.beforeAll(async () => {
		await resetGuildRecords(USER1_HANDLE, USER1_PASSWORD);
		await resetGuildRecords(USER2_HANDLE, USER2_PASSWORD);
	});

	test('leader creates a guild, member accepts, leader removes the member and deletes the guild, and it disappears from Browse', async ({
		browser
	}) => {
		// --- User 1 (leader): log in, create guild, invite user 2 ---
		const leaderCtx = await browser.newContext();
		const leader = await leaderCtx.newPage();
		await loginViaOAuth(leader, USER1_HANDLE, USER1_PASSWORD);

		await leader.goto('/my-guilds');
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

		// The invite shows up in the "Invites" list on the My Guilds page.
		const inviteRow = member.locator('li', { hasText: guildName });
		await expect(inviteRow).toBeVisible();
		await inviteRow.getByRole('button', { name: 'Accept' }).click();

		// Accepting redirects to the guild page; the member now sees the guild.
		await expect(member).toHaveURL(/\/guild\/at\//);
		await expect(member.getByRole('heading', { name: guildName })).toBeVisible();

		// --- Public browsing: a logged-out visitor can find and view the guild ---
		// A fresh context with no session is the clean equivalent of "logged out"; it is logged
		// out even while the leader/member contexts remain open. Done before the leader tears the
		// guild down, while it still exists with both members.
		const publicCtx = await browser.newContext();
		const visitor = await publicCtx.newPage();

		const guildLink = await findGuildInBrowse(visitor, guildName);
		expect(guildLink, 'created guild should appear in the public Browse list').not.toBeNull();
		await guildLink!.click();

		await expect(visitor).toHaveURL(/\/guild\/at\//);
		await expect(visitor.getByRole('heading', { name: guildName })).toBeVisible();
		// Both members are visible read-only; no leader controls for a logged-out visitor.
		await expect(visitor.getByText(USER1_HANDLE, { exact: false })).toBeVisible();
		await expect(visitor.getByText(USER2_HANDLE, { exact: false })).toBeVisible();
		await expect(visitor.getByRole('button', { name: 'Invite Member' })).toHaveCount(0);

		// --- Leader removes the joined member ---
		// Reload so the leader's page picks up the member who joined after the page first rendered.
		await leader.reload();
		const removeButton = leader.getByRole('button', { name: 'Remove' });
		await expect(removeButton).toHaveCount(1);
		await removeButton.click();

		// The member's Remove control (and the member) are gone from the leader's view.
		await expect(leader.getByRole('button', { name: 'Remove' })).toHaveCount(0);
		await expect(leader.getByText(USER2_HANDLE, { exact: false })).toHaveCount(0);

		// --- Leader deletes the guild ---
		await leader.getByRole('button', { name: 'Delete Guild' }).click();
		// deleteGuild redirects to the personal dashboard.
		await expect(leader).toHaveURL(/\/my-guilds/);

		// --- Public browsing: the deleted guild no longer appears in Browse ---
		const goneLink = await findGuildInBrowse(visitor, guildName);
		expect(goneLink, 'deleted guild should no longer appear in the public Browse list').toBeNull();

		await leaderCtx.close();
		await memberCtx.close();
		await publicCtx.close();
	});
});
