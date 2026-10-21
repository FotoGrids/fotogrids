import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import {
	ADMIN,
	ScratchSite,
	scratchSitesAvailable,
} from './support/scratch-site';

/**
 * Plugin settings that depend on the server around them: wp-config.php
 * constants, and whether Freemius can be reached.
 *
 * Each test builds a WordPress of its own, since both change things every
 * other spec relies on.
 */

test.describe.configure({ mode: 'serial' });

test.skip(
	!scratchSitesAvailable(),
	'needs the ci-mode harness, which can build a scratch WordPress'
);

let site: ScratchSite;

test.beforeEach(async ({}, testInfo) => {
	testInfo.setTimeout(300_000);
	site = await new ScratchSite(`psetenv_${testInfo.testId}`).create();
	site.wp('transient', 'delete', 'fotogrids_activation_redirect');
});

test.afterEach(() => {
	site?.destroy();
});

async function logIn(page: Page): Promise<void> {
	await page.goto(`${site.url}/wp-login.php`);
	await page.waitForLoadState('networkidle');
	await page.fill('#user_login', ADMIN.user);
	await page.fill('#user_pass', ADMIN.pass);
	await page.click('#wp-submit');
	await page.waitForURL(/wp-admin/);
}

async function openTab(page: Page, tab: string, rest: string): Promise<void> {
	const read = page.waitForResponse(
		(r) =>
			decodeURIComponent(r.url()).includes(rest) &&
			'GET' === r.request().method(),
		{ timeout: 30_000 }
	);
	await page.goto(
		`${site.url}/wp-admin/admin.php?page=fotogrids-settings&tab=${tab}`
	);
	await read;
}

function channel(page: Page, slug: string) {
	return page.locator(`#fotogrids_debug_channel_${slug}`);
}

function channelRow(page: Page, slug: string) {
	return page
		.locator('.fotogrids-sidebar-layout__panel__row')
		.filter({ has: channel(page, slug) });
}

/** A channel constant locks its row in the state it names, and with WP_DEBUG off every row is locked. */
test(
	'PSET-21: debug channels follow WP_DEBUG and their wp-config constants',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		const DEBUG_ROUTE = '/admin/maintenance/debug-channels';
		site.wp('config', 'set', 'FOTOGRIDS_DEBUG_EDIT_GATE', 'true', '--raw');
		site.wp(
			'config',
			'set',
			'FOTOGRIDS_DEBUG_MODULE_REGISTRY',
			'false',
			'--raw'
		);
		await logIn(page);

		await openTab(page, 'maintenance', DEBUG_ROUTE);
		await expect(channel(page, 'catalog')).toBeEnabled();
		await expect(channel(page, 'catalog')).toHaveAttribute(
			'aria-checked',
			'false'
		);

		await expect(channel(page, 'edit_gate')).toBeDisabled();
		await expect(channel(page, 'edit_gate')).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(channelRow(page, 'edit_gate')).toContainText(
			'Locked on by FOTOGRIDS_DEBUG_EDIT_GATE in wp-config.php'
		);

		await expect(channel(page, 'module_registry')).toBeDisabled();
		await expect(channel(page, 'module_registry')).toHaveAttribute(
			'aria-checked',
			'false'
		);
		await expect(channelRow(page, 'module_registry')).toContainText(
			'Locked off by FOTOGRIDS_DEBUG_MODULE_REGISTRY in wp-config.php'
		);

		await expect(channelRow(page, 'catalog')).toContainText(
			'FOTOGRIDS_DEBUG_CATALOG'
		);
		await expect(channelRow(page, 'catalog')).not.toContainText('Locked');

		site.wp('config', 'set', 'WP_DEBUG', 'false', '--raw');

		// The server's opcache can hold the old wp-config.php for a moment.
		const lights = page.locator('.fotogrids-status-lights');
		await expect
			.poll(
				async () => {
					await openTab(page, 'maintenance', DEBUG_ROUTE);
					return lights.textContent();
				},
				{ timeout: 30_000 }
			)
			.toContain('Not used');

		const toggles = page.locator('[id^="fotogrids_debug_channel_"]');
		await expect(toggles.first()).toBeVisible();
		const count = await toggles.count();
		expect(count).toBeGreaterThan(2);
		for (let i = 0; i < count; i++) {
			await expect(
				toggles.nth(i),
				`channel ${i} is still switchable`
			).toBeDisabled();
		}

		await expect(lights).toContainText('WP_DEBUG');
		await expect(lights).toContainText('Off');
		await expect(lights).toContainText('Not used');

		expect(site.phpErrors()).toEqual([]);
	}
);

/** Answers every Freemius request as a host that cannot be resolved, while the switch option is set. */
const UNREACHABLE = `<?php
add_filter( 'pre_http_request', function ( $pre, $args, $url ) {
	if ( get_option( 'fs_test_unreachable' ) && false !== strpos( (string) wp_parse_url( $url, PHP_URL_HOST ), 'freemius.com' ) ) {
		return new WP_Error( 'http_request_failed', 'cURL error 6: Could not resolve host: api.freemius.com' );
	}
	return $pre;
}, 5, 3 );
`;

/** With Freemius unreachable, switching usage data off and on still saves promptly and stores the choice. */
test(
	'PSET-14: the Advanced tab saves usage data while Freemius cannot be reached',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		const ADVANCED = '/admin/advanced-settings';
		const muPlugins = path.join(site.dir, 'wp-content', 'mu-plugins');
		mkdirSync(muPlugins, { recursive: true });
		copyFileSync(
			path.resolve('tests/harness/freemius-api.php'),
			path.join(muPlugins, 'freemius-api.php')
		);
		writeFileSync(
			path.join(muPlugins, 'freemius-unreachable.php'),
			UNREACHABLE
		);
		await logIn(page);

		// Opted in while Freemius answers, so switching off has an account to update.
		await openTab(page, 'advanced', ADVANCED);
		const toggle = page.locator('#fotogrids_share_statistics');
		const flip = async (on: boolean): Promise<number> => {
			await expect(toggle).toHaveAttribute('aria-checked', String(!on));
			const started = Date.now();
			const write = page.waitForResponse(
				(r) =>
					decodeURIComponent(r.url()).includes(ADVANCED) &&
					'POST' === r.request().method(),
				{ timeout: 60_000 }
			);
			await toggle.click();
			expect((await write).status()).toBe(200);
			await expect(
				page.locator('.fotogrids-save-bar__message').first()
			).toHaveText(/All changes saved/);
			return Date.now() - started;
		};

		await flip(true);
		await expect
			.poll(() =>
				site.wp(
					'eval',
					"echo (int) freemius( 'fotogrids' )->is_registered();"
				)
			)
			.toBe('1');

		site.wp('option', 'update', 'fs_test_unreachable', '1');
		await openTab(page, 'advanced', ADVANCED);

		const off = await flip(false);
		expect(off, 'switching off waited on Freemius').toBeLessThan(15_000);
		expect(site.wp('option', 'get', 'fotogrids_share_statistics')).toBe(
			'0'
		);

		await openTab(page, 'advanced', ADVANCED);
		const on = await flip(true);
		expect(on, 'switching on waited on Freemius').toBeLessThan(15_000);
		expect(site.wp('option', 'get', 'fotogrids_share_statistics')).toBe(
			'1'
		);

		await openTab(page, 'advanced', ADVANCED);
		await expect(toggle).toHaveAttribute('aria-checked', 'true');

		expect(site.phpErrors()).toEqual([]);
	}
);
