import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

/**
 * The fotogridsAdmin payload is inlined into the HTML of every FotoGrids admin
 * screen, so anything placed in it is readable by anyone who can see that page:
 * a screen share, a recorded support session, a saved bug report, a proxy log.
 * It must never carry credential material from the wp_users row.
 */

const ADMIN_PAGES = [
	'/wp-admin/admin.php?page=fotogrids-dashboard',
	'/wp-admin/admin.php?page=fotogrids-settings',
	'/wp-admin/edit.php?post_type=fotogrids_gallery',
];

const CREDENTIAL_FIELDS = [
	'user_pass',
	'user_activation_key',
	'user_email',
	'user_login',
];

test.describe('FotoGrids admin payload', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	for (const path of ADMIN_PAGES) {
		test(`carries no credential fields on ${path}`, async ({ page }) => {
			await page.goto(path);

			const payload = await page.evaluate(() => {
				const global = (window as unknown as Record<string, unknown>)
					.fotogridsAdmin;

				return global === undefined ? null : JSON.stringify(global);
			});

			expect(payload, 'fotogridsAdmin was not localized').not.toBeNull();

			for (const field of CREDENTIAL_FIELDS) {
				expect(payload, `${field} is exposed in fotogridsAdmin`).not.toContain(
					field
				);
			}
		});
	}
});
