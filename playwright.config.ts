import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

export default defineConfig({
	testDir: 'e2e',
	// OAuth round-trips through bsky.social, so give each test room to breathe.
	timeout: 120_000,
	use: {
		// Must be 127.0.0.1:5173 to match the loopback OAuth redirect_uri the app builds
		// from PORT (see src/lib/server/oauthClient.server.ts). `localhost` would not match.
		baseURL: 'http://127.0.0.1:5173'
	},
	webServer: {
		command: 'pnpm run build && pnpm exec vite preview --port 5173 --host 127.0.0.1',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
