import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

/**
 * Autosave is on by default, so the Add New screen has to stay inert until the
 * gallery actually exists: wp_update_post() promotes an auto-draft to a draft,
 * which would leave a gallery behind for anyone who changes a setting and
 * walks away.
 *
 * These drive FotoGrids' own change channel, `fotogrids:setting_changed`, the
 * event every settings panel and the item grid dispatch. They deliberately do
 * not blur the title: WordPress core auto-saves a new post on title blur all
 * by itself (wp-admin/js/post.js, "Auto save new posts after a title is
 * typed"), which would mask what is being tested here.
 *
 * Serial: these share one WordPress site and assert on the gallery list.
 */

const GALLERY_LIST = '/wp-admin/edit.php?post_type=fotogrids_gallery';
const GALLERY_NEW = '/wp-admin/post-new.php?post_type=fotogrids_gallery';

// Comfortably past ajax-save.js's 2s autosave debounce.
const PAST_DEBOUNCE = 6000;

test.describe.configure({ mode: 'serial' });

/**
 * Titles of every gallery in the list, so a failure names what appeared
 * rather than just reporting a count.
 */
async function galleryTitles(page: Page): Promise<string[]> {
	await page.goto(GALLERY_LIST);
	await expect(page.locator('#the-list')).toBeVisible({ timeout: 15000 });
	return page
		.locator('#the-list tr.type-fotogrids_gallery .row-title')
		.allTextContents();
}

async function openAddNew(page: Page) {
	await page.goto(GALLERY_NEW);
	await expect(page.locator('#title')).toBeVisible({ timeout: 15000 });
	// Autosave must see the screen as a collection that does not exist yet.
	await expect(page.locator('#original_post_status')).toHaveValue(
		'auto-draft'
	);
}

async function changeAFotoGridsSetting(page: Page) {
	await page.evaluate(() => {
		document.dispatchEvent(
			new CustomEvent('fotogrids:setting_changed', {
				detail: { source: 'e2e' },
			})
		);
	});
}

test('opening Add New and waiting creates nothing', async ({ page }) => {
	await loginAsAdmin(page);
	const before = await galleryTitles(page);

	await openAddNew(page);
	await page.waitForTimeout(PAST_DEBOUNCE);

	expect(await galleryTitles(page)).toEqual(before);
});

test('a settings change on Add New creates nothing', async ({ page }) => {
	await loginAsAdmin(page);
	const before = await galleryTitles(page);

	await openAddNew(page);
	// Deliberately no title: WordPress core auto-saves a new post on title
	// blur, which would create the draft this test is watching for.
	await changeAFotoGridsSetting(page);
	await page.waitForTimeout(PAST_DEBOUNCE);

	expect(await galleryTitles(page)).toEqual(before);
});

test('an unsaved gallery still warns about unsaved changes', async ({
	page,
}) => {
	await loginAsAdmin(page);
	await openAddNew(page);

	await changeAFotoGridsSetting(page);

	await expect(page.locator('#fotogrids-unsaved-changes')).toBeVisible({
		timeout: 15000,
	});
});
