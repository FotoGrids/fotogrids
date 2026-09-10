import { expect, Page } from '@playwright/test';

/**
 * Sign in to wp-admin.
 *
 * WordPress bounces back to wp-login.php when the test cookie has not landed
 * yet, which shows up as a navigation that never reaches wp-admin. Retry the
 * submit rather than failing the test on it.
 */
export async function loginAsAdmin(page: Page, attempts = 3) {
	const user = process.env.WP_ADMIN_USER ?? 'admin';
	const pass = process.env.WP_ADMIN_PASS ?? 'password';

	for (let attempt = 1; attempt <= attempts; attempt++) {
		await page.goto('/wp-admin/');

		if (!page.url().includes('wp-login.php')) {
			await expect(page.locator('body.wp-admin')).toBeVisible({
				timeout: 15000,
			});
			return;
		}

		await page.fill('#user_login', user);
		await page.fill('#user_pass', pass);
		await page.click('#wp-submit');

		try {
			await page.waitForURL(/\/wp-admin\//, { timeout: 15000 });
			await expect(page.locator('body.wp-admin')).toBeVisible({
				timeout: 15000,
			});
			return;
		} catch (e) {
			if (attempt === attempts) {
				throw e;
			}
		}
	}
}
