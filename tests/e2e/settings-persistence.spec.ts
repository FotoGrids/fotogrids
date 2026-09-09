import { test, expect, Page } from '@playwright/test';

/**
 * Saving one settings tab must not disturb another.
 *
 * The Defaults tab persists through a WordPress Settings API form posted to
 * options.php. options.php writes every option registered to the posted
 * option group, passing null for any the form does not carry, so a group with
 * more than one member silently resets its other options on every save. These
 * tests pin the behaviour that keeps Autosave (and its neighbours) alive.
 */

const SETTINGS = '/wp-admin/admin.php?page=fotogrids-settings';

async function loginAsAdmin(page: Page) {
	await page.goto('/wp-login.php');
	await page.fill('#user_login', process.env.WP_ADMIN_USER ?? 'admin');
	await page.fill('#user_pass', process.env.WP_ADMIN_PASS ?? 'password');
	await Promise.all([page.waitForNavigation(), page.click('#wp-submit')]);
	await expect(page.locator('#wpadminbar')).toBeVisible();
}

async function toggleState(page: Page, id: string) {
	const toggle = page.locator(`#${id}`);
	await expect(toggle).toBeVisible({ timeout: 15000 });
	return toggle.getAttribute('aria-checked');
}

test.describe('settings persistence', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test('autosave defaults to on', async ({ page }) => {
		await page.goto(`${SETTINGS}&tab=advanced`);
		expect(await toggleState(page, 'fotogrids_autosave')).toBe('true');
	});

	test('saving gallery defaults leaves the advanced settings alone', async ({
		page,
	}) => {
		await page.goto(`${SETTINGS}&tab=advanced`);
		const autosaveBefore = await toggleState(page, 'fotogrids_autosave');
		const fontsBefore = await toggleState(
			page,
			'fotogrids_allow_google_fonts'
		);

		await page.goto(`${SETTINGS}&tab=defaults`);
		const saveDefaults = page.getByRole('button', {
			name: /save defaults/i,
		});
		await expect(saveDefaults).toBeVisible({ timeout: 15000 });
		await Promise.all([page.waitForNavigation(), saveDefaults.click()]);

		await page.goto(`${SETTINGS}&tab=advanced`);
		expect(await toggleState(page, 'fotogrids_autosave')).toBe(
			autosaveBefore
		);
		expect(await toggleState(page, 'fotogrids_allow_google_fonts')).toBe(
			fontsBefore
		);
	});
});
