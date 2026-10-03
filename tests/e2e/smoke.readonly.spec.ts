import { test, expect } from './support/test';

/**
 * Smoke E2E: proves the WordPress site is up and the plugin loaded without a
 * fatal. Grow this into real flows (insert a gallery, open the Lightbox,
 * navigate items, admin gallery builder) as features stabilise.
 */

test('WordPress front page loads', { tag: '@always' }, async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.status()).toBeLessThan(400);
});

test('admin login page renders', { tag: '@always' }, async ({ page }) => {
	await page.goto('/wp-login.php');
	await expect(page.locator('#loginform')).toBeVisible();
});
