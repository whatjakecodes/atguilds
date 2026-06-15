import { expect, type Page } from '@playwright/test';

/**
 * Logs a user in through the real ATProto OAuth flow:
 *   our /login form -> bsky.social sign-in + authorize pages -> back to our /oauth/callback.
 */
export async function loginViaOAuth(page: Page, handle: string, password: string): Promise<void> {
	// 1. Our app's login form
	await page.goto('/');
	await page.fill('#handle', handle);
	await page.getByRole('button', { name: /log in/i }).click();

	// 2. bsky's OAuth sign-in page
	await page.waitForURL(/bsky\.(social|network)/, { timeout: 30_000 });

	const username = page.locator('input[name="username"]');
	if (await username.isEditable().catch(() => false)) {
		await username.fill(handle);
	}
	await page.locator('input[name="password"]').fill(password);
	await page.locator('button[type="submit"]').click();

	// 3. Consent screen: "Authorize" is the only submit button (vs. "Deny access").
	//    Wait for it to appear; if it never does, the account already authorized this
	//    client and bsky redirected straight back, so we just continue.
	const authorize = page.locator('button[type="submit"]', { hasText: 'Authorize' });
	try {
		await authorize.waitFor({ state: 'visible', timeout: 15_000 });
		await authorize.click();
	} catch {
		// Consent step was skipped — nothing to do.
	}

	// 4. Back on our app with a session established.
	await page.waitForURL('http://127.0.0.1:5173/**', { timeout: 30_000 });
	await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
}
