import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for FotoGrids end-to-end tests.
 *
 * Tests assume a WordPress site with the plugin active is reachable at
 * baseURL. `tests/harness/boot.sh` boots one and writes WP_BASE_URL (along
 * with WP_CLI, WP_PATH and the admin credentials) into tests/harness/.env;
 * source that file before running. Pointing WP_BASE_URL at a site of your own
 * works too.
 */
const baseURL = process.env.WP_BASE_URL ?? 'http://localhost:8888';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// The whole suite shares one WordPress and one database, so workers past a
	// couple do not buy parallelism - they queue on PHP-FPM and turn slow admin
	// screens into timeouts. A laptop defaulting to 7 took 17s over pages that
	// take 2s at this setting. Matching CI also means local runs reproduce CI's
	// interference rather than a different one. FG_WORKERS overrides.
	workers: Number(process.env.FG_WORKERS) || 2,
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
