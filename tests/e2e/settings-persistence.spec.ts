import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

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

/** A POST to the advanced-settings endpoint, however it was triggered. */
function advancedWrite(page: Page) {
	return page.waitForResponse(
		(r) =>
			decodeURIComponent(r.url()).includes(ADVANCED_REST) &&
			r.request().method() === 'POST',
		{ timeout: 30000 }
	);
}

/** Set Autosave from the Advanced tab and wait for the write to land. */
async function setAutosave(page: Page, on: boolean) {
	await openAdvanced(page);
	const toggle = page.locator('#fotogrids_autosave');
	await expect(toggle).toBeVisible({ timeout: 15000 });

	if ((await toggle.getAttribute('aria-checked')) !== String(on)) {
		const write = advancedWrite(page);
		await toggle.click();
		// Pressing Save is harmless when autosave would have fired anyway, and
		// makes this helper deterministic in both states.
		const save = page.getByRole('button', { name: /save changes/i });
		if (await save.isEnabled()) {
			await save.click();
		}
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

	/**
	 * The point of the setting: a change on a settings screen writes itself,
	 * with no Save click.
	 */
	test('a settings change saves itself when autosave is on', async ({
		page,
	}) => {
		await setAutosave(page, true);

		await openAdvanced(page);
		const fonts = page.locator('#fotogrids_allow_google_fonts');
		const before = await fonts.getAttribute('aria-checked');

		const write = advancedWrite(page);
		await fonts.click();
		await write;

		await openAdvanced(page);
		expect(
			await toggleState(page, 'fotogrids_allow_google_fonts')
		).not.toBe(before);

		// Put it back, again without touching Save.
		const restore = advancedWrite(page);
		await page.locator('#fotogrids_allow_google_fonts').click();
		await restore;
	});

	test('a settings change waits for Save when autosave is off', async ({
		page,
	}) => {
		await setAutosave(page, false);

		await openAdvanced(page);
		const fonts = page.locator('#fotogrids_allow_google_fonts');
		const before = await fonts.getAttribute('aria-checked');
		await fonts.click();
		// Comfortably past the 2s debounce, so a stray autosave would have run.
		await page.waitForTimeout(6000);

		await openAdvanced(page);
		expect(await toggleState(page, 'fotogrids_allow_google_fonts')).toBe(
			before
		);

		await setAutosave(page, true);
	});

	test('the defaults tab saves over REST, not through options.php', async ({
		page,
	}) => {
		await page.goto(`${SETTINGS}&tab=defaults`);
		await expect(page.locator('.fotogrids-save-bar')).toBeVisible({
			timeout: 20000,
		});
		await expect(page.locator('form[action="options.php"]')).toHaveCount(0);
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
		await expect(saveDefaults).toBeVisible({ timeout: 20000 });

		await openAdvanced(page);
		expect(await toggleState(page, 'fotogrids_autosave')).toBe(
			autosaveBefore
		);
		expect(await toggleState(page, 'fotogrids_allow_google_fonts')).toBe(
			fontsBefore
		);
	});
});
