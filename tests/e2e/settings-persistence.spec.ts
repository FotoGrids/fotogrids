import { test, expect, Page } from '@playwright/test';

/**
 * Saving one settings tab must not disturb another, and a setting turned off
 * must read as off everywhere it is shown.
 *
 * The Defaults tab persists through a WordPress Settings API form posted to
 * options.php. options.php writes every option registered to the posted
 * option group, passing null for any the form does not carry, so a group with
 * more than one member silently resets its other options on every save.
 *
 * Serial: these share one WordPress site and one set of options.
 */

const SETTINGS = '/wp-admin/admin.php?page=fotogrids-settings';
const GALLERY_NEW = '/wp-admin/post-new.php?post_type=fotogrids_gallery';
const ADVANCED_REST = '/fotogrids/v1/admin/advanced-settings';

// The editor's own autosave switch, in the settings panel's docs strip.
const EDITOR_TOGGLE =
	'.fotogrids-settings-docs-strip__autosave button[role="switch"]';

test.describe.configure({ mode: 'serial' });

async function loginAsAdmin(page: Page) {
	await page.goto('/wp-login.php');
	await page.fill('#user_login', process.env.WP_ADMIN_USER ?? 'admin');
	await page.fill('#user_pass', process.env.WP_ADMIN_PASS ?? 'password');
	await page.click('#wp-submit');
	await page.waitForURL(/\/wp-admin\//, { timeout: 30000 });
}

/**
 * Open the Advanced tab and wait for its REST read, so assertions see the
 * settled values rather than the first-paint seed.
 */
async function openAdvanced(page: Page) {
	const read = page.waitForResponse(
		(r) =>
			decodeURIComponent(r.url()).includes(ADVANCED_REST) &&
			r.request().method() === 'GET',
		{ timeout: 30000 }
	);
	await page.goto(`${SETTINGS}&tab=advanced`);
	await read;
}

async function toggleState(page: Page, id: string) {
	const toggle = page.locator(`#${id}`);
	await expect(toggle).toBeVisible({ timeout: 15000 });
	return toggle.getAttribute('aria-checked');
}

/** Set Autosave from the Advanced tab and wait for the write to land. */
async function setAutosave(page: Page, on: boolean) {
	await openAdvanced(page);
	const toggle = page.locator('#fotogrids_autosave');
	await expect(toggle).toBeVisible({ timeout: 15000 });

	if ((await toggle.getAttribute('aria-checked')) !== String(on)) {
		const write = page.waitForResponse(
			(r) =>
				decodeURIComponent(r.url()).includes(ADVANCED_REST) &&
				r.request().method() === 'POST',
			{ timeout: 30000 }
		);
		await toggle.click();
		await page.getByRole('button', { name: /save changes/i }).click();
		await write;
	}

	await expect(toggle).toHaveAttribute('aria-checked', String(on));
}

test.describe('settings persistence', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test('autosave defaults to on', async ({ page }) => {
		await openAdvanced(page);
		expect(await toggleState(page, 'fotogrids_autosave')).toBe('true');
	});

	/**
	 * wp_localize_script casts every scalar to a string, so the option reaches
	 * the browser as '1' or '' and never as a boolean. A check that reads ''
	 * as "unset, therefore on" leaves the editor's switch stuck on while the
	 * setting is off. That is what this pins down.
	 */
	test('turning autosave off is reflected in the editor', async ({
		page,
	}) => {
		await setAutosave(page, false);

		await page.goto(GALLERY_NEW);
		const editorToggle = page.locator(EDITOR_TOGGLE);
		await expect(editorToggle).toBeVisible({ timeout: 15000 });
		await expect(editorToggle).toHaveAttribute('aria-checked', 'false');

		await setAutosave(page, true);

		await page.goto(GALLERY_NEW);
		await expect(page.locator(EDITOR_TOGGLE)).toHaveAttribute(
			'aria-checked',
			'true'
		);
	});

	test('saving gallery defaults leaves the advanced settings alone', async ({
		page,
	}) => {
		await openAdvanced(page);
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
		await saveDefaults.click();
		await page.waitForURL(/options\.php|page=fotogrids-settings/, {
			timeout: 30000,
		});

		await openAdvanced(page);
		expect(await toggleState(page, 'fotogrids_autosave')).toBe(
			autosaveBefore
		);
		expect(await toggleState(page, 'fotogrids_allow_google_fonts')).toBe(
			fontsBefore
		);
	});
});
