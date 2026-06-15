import { expect, type Browser } from '@playwright/test';
import { loginViaOAuth } from './oauth';

export type TestUser = { handle: string; password: string };

/** Turns a /guild/at/<did>/<collection>/<rkey> page URL into its at:// URI. */
export function guildUrlToAtUri(url: string): string {
	const path = new URL(url).pathname; // /guild/at/<did>/<collection>/<rkey>
	return path.replace(/^\/guild\//, '').replace(/^at\//, 'at://');
}

/**
 * Runs the full create -> invite -> accept flow so a test starts from a guild that
 * USER1 leads with USER2 as an accepted member. Returns the guild's at:// URI.
 */
export async function createGuildWithMember(
	browser: Browser,
	user1: TestUser,
	user2: TestUser,
	guildName: string
): Promise<{ guildUri: string }> {
	// USER1 (leader): log in, create the guild, invite USER2.
	const leaderCtx = await browser.newContext();
	const leader = await leaderCtx.newPage();
	await loginViaOAuth(leader, user1.handle, user1.password);

	await leader.goto('/my-guilds');
	await leader.fill('#guildName', guildName);
	await leader.getByRole('button', { name: 'Create' }).click();

	await expect(leader).toHaveURL(/\/guild\/at\//);
	await expect(leader.getByRole('heading', { name: guildName })).toBeVisible();
	const guildUri = guildUrlToAtUri(leader.url());

	await leader.fill('#memberHandle', user2.handle);
	await leader.getByRole('button', { name: 'Invite Member' }).click();
	await expect(leader.getByRole('heading', { name: 'Pending Invites' })).toBeVisible();

	// USER2 (invitee): log in, accept the invite.
	const memberCtx = await browser.newContext();
	const member = await memberCtx.newPage();
	await loginViaOAuth(member, user2.handle, user2.password);

	const inviteRow = member.locator('li', { hasText: guildName });
	await expect(inviteRow).toBeVisible();
	await inviteRow.getByRole('button', { name: 'Accept' }).click();
	await expect(member).toHaveURL(/\/guild\/at\//);

	await leaderCtx.close();
	await memberCtx.close();

	return { guildUri };
}
