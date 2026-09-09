import { test, expect, Page } from '@playwright/test';

/**
 * Autosave is on by default, so the Add New screen has to stay inert until the
 * gallery actually exists: wp_update_post() promotes an auto-draft to a draft,
 * which would leave a gallery behind for anyone who types a title and leaves.
 *
 * Serial: these share one WordPress site and assert on the gallery list.
 */

const GALLERY_LIST = '/wp-admin/edit.php?post_type=fotogrids_gallery';
const GALLERY_NEW = '/wp-admin/post-new.php?post_type=fotogrids_gallery';

// Comfortably past ajax-save.js's 2s autosave debounce.
const PAST_DEBOUNCE = 6000;

test.describe.configure({ mode: 'serial' });

async function loginAsAdmin(page: Page) {
	await page.goto('/wp-login.php');
	await page.fill('#user_login', process.env.WP_ADMIN_USER ?? 'admin');
	await page.fill('#user_pass', process.env.WP_ADMIN_PASS ?? 'password');
	await page.click('#wp-submit');
	await page.waitForURL(/\/wp-admin\//, { timeout: 30000 });
}

/**
 * Titles and statuses of every gallery in the list, so a failure names what
 * appeared rather than just reporting a count.
 */
async function galleryRows(page: Page): Promise<string[]> {
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

test('opening Add New and waiting creates nothing', async ({ page }) => {
	await loginAsAdmin(page);
	const before = await galleryRows(page);

	await openAddNew(page);
	await page.waitForTimeout(PAST_DEBOUNCE);

	expect(await galleryRows(page)).toEqual(before);
});

test('typing a title on Add New creates nothing', async ({ page }) => {
	await loginAsAdmin(page);
	const before = await galleryRows(page);

	await openAddNew(page);
	const title = page.locator('#title');
	await title.fill('Autosave should ignore me');
	await title.blur();
	await page.waitForTimeout(PAST_DEBOUNCE);

	expect(await galleryRows(page)).toEqual(before);
});

test('an unsaved gallery still warns about unsaved changes', async ({
	page,
}) => {
	await loginAsAdmin(page);
	await openAddNew(page);

	const title = page.locator('#title');
	await title.fill('Still unsaved');
	await title.blur();

	await expect(page.locator('#fotogrids-unsaved-changes')).toBeVisible({
		timeout: 15000,
	});
});
