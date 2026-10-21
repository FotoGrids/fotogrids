import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor } from './support/roles';

/**
 * The editor offers Lightbox Contents only where it means something.
 *
 * scoped: opens only galleries it created, and saves nothing.
 */

test.use({ storageState: storageStateFor('administrator') });

/** LB-22: the scope choice exists only for the Single Item layout. */
test(
	'LB-22: Lightbox Contents is offered for Single Item and not for other layouts',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const editor = new GalleryEditor(page);
		const panel = new CollectionSettings(page);

		for (const [layout, offered] of [
			['single-item', true],
			['grid', false],
			['masonry', false],
		] as const) {
			const { id } = galleryPage({
				layout,
				item_click_behavior: 'lightbox',
			});
			await editor.open(id);
			await panel.openTab('Lightbox');
			await panel.openSubtab(/^\s*Layout & Styling\s*$/);
			await expect(panel.field('lightbox_theme')).toBeVisible();

			if (offered) {
				await expect(
					panel.field('lightbox_scope'),
					layout
				).toBeVisible();
				await expect(panel.field('lightbox_scope')).toContainText(
					'Whole Gallery'
				);
			} else {
				await expect(panel.field('lightbox_scope'), layout).toHaveCount(
					0
				);
			}
		}
	}
);
