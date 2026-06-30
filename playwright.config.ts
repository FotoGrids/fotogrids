import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for FotoGrids end-to-end tests.
 *
 * Tests assume a WordPress site with the plugin active is reachable at
 * baseURL. In CI that site is provided by @wordpress/env (`wp-env`); locally,
 * run `npm run env:start` first or point WP_BASE_URL at your own site.
 */
const baseURL = process.env.WP_BASE_URL ?? 'http://localhost:8888';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
