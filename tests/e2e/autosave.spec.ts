import { test, expect, Page } from '@playwright/test';

/**
 * Autosave is on by default, so the Add New screen has to stay inert until the
 * gallery actually exists: wp_update_post() promotes an auto-draft to a draft,
 * which would leave a gallery behind for anyone who types a title and leaves.
 */

const GALLERY_LIST = '/wp-admin/edit.php?post_type=fotogrids_gallery';
const GALLERY_NEW = '/wp-admin/post-new.php?post_type=fotogrids_gallery';

async function loginAsAdmin(page: Page) {
	await page.goto('/wp-login.php');
	await page.fill('#user_login', process.env.WP_ADMIN_USER ?? 'admin');
	await page.fill('#user_pass', process.env.WP_ADMIN_PASS ?? 'password');
	await Promise.all([page.waitForNavigation(), page.click('#wp-submit')]);
	await expect(page.locator('#wpadminbar')).toBeVisible();
}

async function galleryCount(page: Page) {
	await page.goto(GALLERY_LIST);
	await expect(page.locator('#the-list')).toBeVisible();
	return page.locator('#the-list tr.type-fotogrids_gallery').count();
}

test('typing a title on Add New does not create a gallery', async ({
	page,
}) => {
	await loginAsAdmin(page);
	const before = await galleryCount(page);

	await page.goto(GALLERY_NEW);
	const title = page.locator('#title');
	await expect(title).toBeVisible({ timeout: 15000 });
	await title.fill('Autosave should ignore me');
	await title.blur();

	// Comfortably past the 2s autosave debounce.
	await page.waitForTimeout(5000);

	expect(await galleryCount(page)).toBe(before);
});

test('an unsaved gallery still warns about unsaved changes', async ({
	page,
}) => {
	await loginAsAdmin(page);
	await page.goto(GALLERY_NEW);

	const title = page.locator('#title');
	await expect(title).toBeVisible({ timeout: 15000 });
	await title.fill('Still unsaved');
	await title.blur();
	await page.waitForTimeout(3000);

	await expect(page.locator('#fotogrids-unsaved-changes')).toBeVisible();
});
