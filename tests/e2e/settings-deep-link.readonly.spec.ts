import { test, expect } from './support/test';
import { storageStateFor } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * A plugin settings link that names a field opens that field.
 *
 * Readonly: the tests open screens and save nothing.
 */

/** The named field is scrolled into view, focused and outlined briefly. */
test(
	'SET-17: ?tab=&field= opens the tab, focuses the field and flashes it',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 500 });
		await page.goto(
			'/wp-admin/admin.php?page=fotogrids-settings&tab=media&field=fg-masonry-width'
		);

		const field = page.locator('#fg-masonry-width');
		await expect(field).toBeFocused({ timeout: 20000 });
		await expect(field).toBeInViewport();
		await expect
			.poll(() => field.evaluate((element) => element.style.boxShadow))
			.toContain('rgba(0, 123, 255, 0.3)');

		// The outline is a flash, not a state.
		await expect
			.poll(() => field.evaluate((element) => element.style.boxShadow), {
				timeout: 5000,
			})
			.toBe('');
	}
);

/** A Defaults link with a subtab opens that subtab. */
test(
	'SET-17: ?tab=defaults&subtab=album opens Album Defaults',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		await page.goto(
			'/wp-admin/admin.php?page=fotogrids-settings&tab=defaults&subtab=album'
		);

		await expect(
			page.getByRole('tab', { name: 'Album Defaults', exact: true })
		).toHaveAttribute('aria-selected', 'true', { timeout: 20000 });
		await expect(
			page
				.locator('.fotogrids-settings-tab__label')
				.filter({ hasText: /^Navigation$/ })
		).toBeVisible();
	}
);

/** Moving to another tab drops the field from the address, so a reload does not jump back. */
test(
	'SET-17: switching tabs drops the field from the address',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		await page.goto(
			'/wp-admin/admin.php?page=fotogrids-settings&tab=media&field=fg-masonry-width'
		);
		await expect(page.locator('#fg-masonry-width')).toBeFocused({
			timeout: 20000,
		});

		await page
			.locator('.fotogrids-sidebar-tabs')
			.getByText('Advanced', { exact: true })
			.first()
			.click();
		await expect
			.poll(() => new URL(page.url()).searchParams.get('tab'))
			.toBe('advanced');
		expect(new URL(page.url()).searchParams.get('field')).toBeNull();
	}
);
