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
const baseURL = process.env.WP_BASE_URL ?? 'http://127.0.0.1:8899';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// One worker, until the suite is split into projects that isolate the specs
	// which mutate global state.
	//
	// Every spec shares one WordPress. settings-persistence toggles autosave
	// site-wide while autosave.spec asserts on it; rest-route-auth creates
	// galleries while autosave asserts none appeared. Above one worker the
	// result depends on ordering. It also costs nothing: the bottleneck is
	// PHP-FPM, not the browsers, so the suite takes the same time either way.
	// FG_WORKERS overrides.
	workers: Number(process.env.FG_WORKERS) || 1,
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
