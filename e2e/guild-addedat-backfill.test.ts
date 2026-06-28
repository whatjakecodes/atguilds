import { expect, test } from '@playwright/test';
import { createLegacyGuild, getPdsGuildValue, resetGuildRecords } from './helpers/atproto';
import { loginViaOAuth } from './helpers/oauth';
import { USER1_HANDLE, USER1_PASSWORD } from './helpers/env';

type LegacyMembers = string[];
type UpgradedMembers = { did: string; addedAt: string }[];

test.describe('guild record addedAt auto-upgrade', () => {
	test.beforeAll(async () => {
		await resetGuildRecords(USER1_HANDLE, USER1_PASSWORD);
	});

	test('logging in as leader upgrades legacy members to carry addedAt', async ({ page }) => {
		const guildName = `E2E AddedAt ${Date.now()}`;

		// Set up a guild on USER1's PDS in the OLD shape (members are bare DID strings).
		const { guildUri, createdAt } = await createLegacyGuild(
			USER1_HANDLE,
			USER1_PASSWORD,
			guildName
		);

		// Precondition: the PDS record is legacy — members are strings, no addedAt anywhere.
		const before = await getPdsGuildValue(USER1_HANDLE, USER1_PASSWORD, guildUri);
		const beforeMembers = before.members as LegacyMembers;
		expect(beforeMembers.every((m) => typeof m === 'string')).toBe(true);

		// USER1 (the leader) logs in. The OAuth callback runs syncLocals, which detects the
		// legacy record the user leads and rewrites it in the new shape on their PDS.
		await loginViaOAuth(page, USER1_HANDLE, USER1_PASSWORD);

		// The PDS record is now upgraded: every member is { did, addedAt } and addedAt falls
		// back to the guild's createdAt (the coercion default for previously-undated members).
		const after = await getPdsGuildValue(USER1_HANDLE, USER1_PASSWORD, guildUri);
		const afterMembers = after.members as UpgradedMembers;
		expect(afterMembers.length).toBe(beforeMembers.length);
		for (const member of afterMembers) {
			expect(typeof member).toBe('object');
			expect(typeof member.did).toBe('string');
			expect(member.addedAt).toBe(createdAt);
		}
	});
});
