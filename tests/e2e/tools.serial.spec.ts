import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { apiAs, storageStateFor, wpCli, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Tools > Migration on a site with nothing to migrate, Tools > System Info,
 * and the Tools grid's cards for tools that cannot be opened.
 *
 * Serial: the captured-error log is a site option and the extra tools come
 * from an mu-plugin; both are put back.
 */

test.describe.configure({ mode: 'serial' });

const TOOLS = '/wp-admin/admin.php?page=fotogrids-tools';
const ERROR_LOG = 'fotogrids_error_log';
const MU_PLUGIN = path.join(
	process.env.WP_PATH ?? '',
	'wp-content',
	'mu-plugins',
	'fg-e2e-extra-tools.php'
);

function route(p: string): string {
	return `/index.php?rest_route=${encodeURIComponent(p)}`;
}

/** The error log option as stored, or null when it does not exist. */
function readErrorLog(): string | null {
	try {
		return execFileSync(
			wpCli(),
			['option', 'get', ERROR_LOG, '--format=json'],
			{
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			}
		).trim();
	} catch {
		return null;
	}
}

function writeErrorLog(value: string | null): void {
	wpEval(`delete_option( '${ERROR_LOG}' );`);
	if (null === value) {
		return;
	}
	execFileSync(
		wpCli(),
		['option', 'add', ERROR_LOG, '--format=json', '--autoload=no'],
		{
			encoding: 'utf8',
			input: value,
		}
	);
}

test.describe('TOOL-06', () => {
	/**
	 * TOOL-06. With none of the gallery or slider plugins installed, Migration
	 * detects none of them, scanning WordPress galleries finds nothing to
	 * import, and a plugin source explains it is not available rather than
	 * failing.
	 */
	test(
		'TOOL-06: migration on a site with no source plugins finds nothing and fails nothing',
		{ tag: '@admin' },
		async ({ page, playwright }) => {
			const admin = await apiAs(playwright, 'administrator');
			const sources = await (
				await admin.context.get(
					route('/fotogrids/v1/admin/tools/migration/sources'),
					{
						headers: { 'X-WP-Nonce': admin.nonce },
					}
				)
			).json();
			const plugins = sources.filter(
				(s: { id: string }) => 'wp-core' !== s.id
			);

			expect(plugins.length).toBeGreaterThan(0);
			expect(
				plugins.filter((s: { detected: boolean }) => s.detected)
			).toEqual([]);

			for (const source of plugins) {
				const scan = await admin.context.get(
					route('/fotogrids/v1/admin/tools/migration/scan') +
						`&source=${source.id}`,
					{ headers: { 'X-WP-Nonce': admin.nonce } }
				);
				expect(scan.status(), source.id).toBe(409);
				expect((await scan.json()).message).toBe(
					'Import for this source is not available yet.'
				);
			}
			await admin.context.dispose();

			await page.goto(`${TOOLS}&tool=migration`);
			const scanned = page.waitForResponse((r) =>
				decodeURIComponent(r.url()).includes('migration/scan')
			);
			await page
				.locator('.fg-migration__source-card', {
					hasText: 'WordPress galleries',
				})
				.click();
			await page.getByRole('button', { name: 'Scan galleries' }).click();
			expect((await scanned).status()).toBe(200);
			await expect(page.locator('.fg-migration__empty')).toHaveText(
				'No galleries found for this source.'
			);
			await expect(page.locator('.fg-migration__preview')).toHaveCount(0);

			await page.getByRole('tab', { name: 'Choose' }).click();
			const plugin = page
				.locator('.fg-migration__source-card--soon')
				.first();
			const label = (
				await plugin.locator('.fg-migration__source-name').innerText()
			).trim();
			await expect(
				plugin.locator('.fg-migration__source-status')
			).toHaveText('Coming soon');
			await plugin.click();
			const panel = page.locator('.fg-migration__placeholder');
			await expect(
				panel.locator('.fg-migration__placeholder-title')
			).toHaveText(label);
			await expect(panel).toContainText(
				'Migration from this plugin isn’t available yet.'
			);
			await expect(
				panel.getByRole('button', { name: 'Coming soon' })
			).toBeDisabled();
		}
	);
});

test.describe('TOOL-07', () => {
	let saved: string | null = null;

	test.beforeAll(() => {
		saved = readErrorLog();
	});

	test.afterAll(() => {
		writeErrorLog(saved);
	});

	/**
	 * TOOL-07. The report has its seven sections in order, starting with the
	 * plugin's own version, and downloads as the same report in plain text.
	 */
	test(
		'TOOL-07: the System Info report shows every section and downloads as text',
		{ tag: '@admin' },
		async ({ page }) => {
			const version = wpEval('echo FOTOGRIDS_VERSION;').trim();
			const sections = [
				'FotoGrids',
				'Database',
				'WordPress environment',
				'Server environment',
				'Media',
				'Theme',
			];

			await page.goto(`${TOOLS}&tool=system-info`);
			const panels = page.locator('.fg-system-info__report-panel');
			// The last heading counts the active plugins.
			await expect(panels).toHaveCount(sections.length + 1);
			const headings = await panels.locator('h3').allInnerTexts();
			expect(headings.slice(0, -1)).toEqual(sections);
			expect(headings[sections.length]).toMatch(
				/^Active plugins \(\d+\)$/
			);
			await expect(panels.first()).toContainText(version);

			const download = page.waitForEvent('download');
			await page.getByRole('button', { name: 'Download .txt' }).click();
			const file = await (await download).path();
			const text = readFileSync(file, 'utf8');

			expect(text.startsWith('### FotoGrids System Info ###')).toBe(true);
			expect(text.match(/^## .+$/gm)).toEqual(
				headings.map((h) => `## ${h}`)
			);
			expect(text).toContain(version);
		}
	);

	/**
	 * TOOL-07. Captured PHP and JavaScript errors are listed by type with their
	 * count, and clearing one log, once confirmed, empties that log only.
	 */
	test(
		'TOOL-07: the Error Log lists captured errors and clears one log at a time',
		{ tag: '@admin' },
		async ({ page }) => {
			const php = `fg-e2e php failure ${process.pid}`;
			const js = `fg-e2e js failure ${process.pid}`;
			writeErrorLog(null);
			wpEval(`
			require_once FOTOGRIDS_PLUGIN_DIR . 'includes/diagnostics/class-error-store.php';
			foreach ( array( 1, 2, 3 ) as $n ) {
				\\FotoGrids\\Diagnostics\\Error_Store::record( array( 'type' => 'php', 'level' => 'warning', 'message' => '${php}', 'file' => 'includes/example.php', 'line' => 12 ) );
			}
			\\FotoGrids\\Diagnostics\\Error_Store::record( array( 'type' => 'js', 'level' => 'error', 'message' => '${js}' ) );
			\\FotoGrids\\Diagnostics\\Error_Store::flush();
		`);

			await page.goto(`${TOOLS}&tool=system-info`);
			await page.getByRole('tab', { name: 'Error Log' }).click();

			const panel = (title: string) =>
				page
					.locator('section')
					.filter({
						has: page.getByRole('heading', {
							name: title,
							exact: true,
						}),
					})
					.last();
			const phpPanel = panel('PHP error log');
			const jsPanel = panel('JavaScript error log');

			const phpRow = phpPanel.locator('.fg-system-info__error-row');
			await expect(phpRow).toHaveCount(1);
			await expect(phpRow).toContainText(php);
			await expect(
				phpRow.locator('.fg-system-info__error-times')
			).toHaveText('3');
			await expect(
				jsPanel.locator('.fg-system-info__error-row')
			).toContainText(js);

			await phpPanel.getByRole('button', { name: 'Clear log' }).click();
			const confirm = page
				.getByRole('dialog')
				.filter({ hasText: 'Clear this log?' });
			await confirm.getByRole('button', { name: 'Cancel' }).click();
			await expect(phpRow).toHaveCount(1);

			const cleared = page.waitForResponse(
				(r) =>
					decodeURIComponent(r.url()).includes(
						'system-info/errors'
					) && 'GET' !== r.request().method()
			);
			await phpPanel.getByRole('button', { name: 'Clear log' }).click();
			await confirm.getByRole('button', { name: 'Clear log' }).click();
			expect((await cleared).status()).toBe(200);

			await expect(phpPanel).toContainText(
				'No FotoGrids PHP errors recorded.'
			);
			await expect(
				jsPanel.locator('.fg-system-info__error-row')
			).toContainText(js);
			const stored = readErrorLog() ?? '';
			expect(stored).not.toContain(php);
			expect(stored).toContain(js);
		}
	);
});

test.describe('TOOL-08', () => {
	test.beforeAll(() => {
		mkdirSync(path.dirname(MU_PLUGIN), { recursive: true });
		writeFileSync(
			MU_PLUGIN,
			`<?php
add_action( 'fotogrids/tools/init', function () {
	class FG_E2E_Locked_Tool extends \\FotoGrids\\Tools\\Abstract_Tool {
		public function get_id(): string { return 'fg-e2e-locked'; }
		public function get_label(): string { return 'E2E Locked Tool'; }
		public function get_description(): string { return 'Needs a higher plan.'; }
		public function get_icon(): string { return 'lock'; }
		public function get_tier_required(): string { return 'pro'; }
		public function init(): void {}
	}
	class FG_E2E_Soon_Tool extends \\FotoGrids\\Tools\\Abstract_Tool {
		public function get_id(): string { return 'fg-e2e-soon'; }
		public function get_label(): string { return 'E2E Soon Tool'; }
		public function get_description(): string { return 'Not built yet.'; }
		public function get_icon(): string { return 'clock'; }
		public function is_available(): bool { return false; }
		public function init(): void {}
	}
	\\FotoGrids\\Tools\\Tools_Registry::register( new FG_E2E_Locked_Tool() );
	\\FotoGrids\\Tools\\Tools_Registry::register( new FG_E2E_Soon_Tool() );
}, 20 );
`
		);
	});

	test.afterAll(() => {
		rmSync(MU_PLUGIN, { force: true });
	});

	function card(page: Page, label: string) {
		return page.locator('.fg-tool-card').filter({
			has: page.locator('.fg-tool-card__title', { hasText: label }),
		});
	}

	/**
	 * TOOL-08. A tool that needs a higher plan or is not built yet is shown
	 * with its badge but is not a link, and clicking it opens nothing; a free,
	 * available tool beside it opens.
	 */
	test(
		'TOOL-08: locked and coming-soon tool cards cannot be opened',
		{ tag: '@admin' },
		async ({ page }) => {
			await page.goto(TOOLS);

			const locked = card(page, 'E2E Locked Tool');
			const soon = card(page, 'E2E Soon Tool');
			await expect(locked).toHaveClass(/fg-tool-card--locked/);
			await expect(
				locked.locator('.fg-tool-card__tier-badge')
			).toHaveText('pro');
			await expect(soon).toHaveClass(/fg-tool-card--unavailable/);
			await expect(soon.locator('.fg-tool-card__soon-badge')).toHaveText(
				'Coming soon'
			);

			for (const unavailable of [locked, soon]) {
				expect(await unavailable.evaluate((el) => el.tagName)).toBe(
					'DIV'
				);
				await expect(unavailable).not.toHaveAttribute('href', /./);
				await unavailable.click();
				await expect(page).not.toHaveURL(/[?&]tool=/);
				await expect(
					page.locator('.fg-tools-page--grid')
				).toBeVisible();
			}

			const open = card(page, 'System Info');
			expect(await open.evaluate((el) => el.tagName)).toBe('A');
			await open.click();
			await expect(page).toHaveURL(/[?&]tool=system-info/);
		}
	);
});
