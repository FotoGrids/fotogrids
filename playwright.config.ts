import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for FotoGrids end-to-end tests.
 *
 * Tests assume a WordPress site with the plugin active at baseURL.
 * `tests/harness/boot.sh` boots one and writes WP_BASE_URL, WP_CLI, WP_PATH and
 * the admin credentials into tests/harness/.env; source that file before
 * running. Pointing WP_BASE_URL at a site of your own works too.
 *
 * A spec's filename names its project, which is what it may write:
 *
 * | `readonly` | nothing                                    | full workers |
 * | `scoped`   | only collections it created itself         | full workers |
 * | `serial`   | anything, including options and capabilities | one worker  |
 *
 * `serial` runs only after the other two, through `dependencies`.
 */
const baseURL = process.env.WP_BASE_URL ?? 'http://127.0.0.1:8899';

/**
 * Tiers, selected from CI rather than configured here:
 *
 *   Tier 1 (gate, every PR)  --project=readonly, plus --grep @critical
 *   Tier 2 (full, main)      everything except @flaky
 *   Quarantine (nightly)     only @flaky, and it blocks nothing
 *
 * `readonly` is the whole API layer, so Tier 1 is that plus the browser rows
 * tagged `@critical`: the paths whose breakage would ship a broken plugin.
 *
 * `@flaky` quarantines a test: it stops gating anything and starts being
 * measured. Quarantine, file the issue, fix, untag — never raise `retries`.
 */

/** Shared by all three; only the write contract differs. */
const chromium = { ...devices[ 'Desktop Chrome' ] };

export default defineConfig( {
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !! process.env.CI,
	// One retry, never more: a test needing two is not a signal, it burns 3x its
	// runtime and still reports green.
	retries: process.env.CI ? 1 : 0,
	// Quarantined tests are excluded everywhere unless a run asks for only them,
	// so forgetting a --grep-invert somewhere cannot let one back into a gate.
	grepInvert: 'quarantine' === process.env.FG_TIER ? undefined : /@flaky/,
	grep: 'quarantine' === process.env.FG_TIER ? /@flaky/ : undefined,
	// One WordPress serves every project, so this is bounded by PHP-FPM.
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
