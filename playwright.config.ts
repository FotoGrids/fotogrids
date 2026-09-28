import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for FotoGrids end-to-end tests.
 *
 * Tests assume a WordPress site with the plugin active is reachable at baseURL.
 * `tests/harness/boot.sh` boots one and writes WP_BASE_URL (along with WP_CLI,
 * WP_PATH and the admin credentials) into tests/harness/.env; source that file
 * before running. Pointing WP_BASE_URL at a site of your own works too.
 *
 * ## The three projects
 *
 * Every spec shares one WordPress, so what a spec is allowed to write decides
 * how much of it can run at once. A spec belongs to exactly one project, and
 * says which in its filename.
 *
 * | Project    | May write                                  | Parallelism |
 * |------------|--------------------------------------------|-------------|
 * | `readonly` | nothing                                    | full        |
 * | `scoped`   | only collections it created itself         | full        |
 * | `serial`   | anything, including options and capabilities | one worker |
 *
 * `serial` runs after the other two have finished, not alongside them: a spec
 * that toggles a site-wide option would otherwise change the answer for a
 * `readonly` spec reading it. That ordering is what `dependencies` buys, and it
 * is the whole reason the split exists - before it the suite ran on one worker
 * because `settings-persistence` toggles autosave while `autosave` asserts on
 * it, and `rest-route-auth` created galleries while `autosave` asserted none
 * had appeared.
 *
 * A spec needing `workers: 1` for any reason other than writing global state is
 * written wrong; scope its writes instead.
 */
const baseURL = process.env.WP_BASE_URL ?? 'http://127.0.0.1:8899';

/** Shared by all three; only the isolation contract differs. */
const chromium = { ...devices[ 'Desktop Chrome' ] };

export default defineConfig( {
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// The ceiling across every project. One WordPress serves them all, so this
	// is bounded by PHP-FPM rather than by cores.
	workers: Number( process.env.FG_WORKERS ) || 4,
	reporter: process.env.CI
		? [ [ 'github' ], [ 'html', { open: 'never' } ] ]
		: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'readonly',
			testMatch: /.*\.readonly\.spec\.ts/,
			use: chromium,
		},
		{
			name: 'scoped',
			testMatch: /.*\.scoped\.spec\.ts/,
			use: chromium,
		},
		{
			name: 'serial',
			testMatch: /.*\.serial\.spec\.ts/,
			dependencies: [ 'readonly', 'scoped' ],
			fullyParallel: false,
			workers: 1,
			use: chromium,
		},
	],
} );
