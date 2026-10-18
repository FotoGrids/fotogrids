import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor } from './support/roles';

/**
 * What the justified settings tell the person configuring a gallery: Max Rows
 * says what it does in each display mode, and Last Row Hide explains that Show
 * All has no page ends for it to act on.
 */

test.describe.configure({ timeout: 120000 });

test.use({ storageState: storageStateFor('administrator') });

test(
	'MR-07: the Max Rows description covers Show All and paginated galleries',
	{ tag: ['@admin', '@settings', '@layout'] },
	async ({ page }) => {
		const { id } = galleryPage({ layout: 'justified' });
		const panel = new CollectionSettings(page);
		await new GalleryEditor(page).open(id);
		await panel.switchTab('layout');

		const field = panel.field('layout_justified_max_rows');
		await expect(field).toContainText(/Show All/i);
		await expect(field).toContainText(/per page/i);
	}
);

test(
	'LR-09: Show All with Last Row Hide shows a notice; a paginated gallery does not',
	{ tag: ['@admin', '@settings', '@layout'] },
	async ({ page }) => {
		const panel = new CollectionSettings(page);
		const notice = page.getByText(/Hide behaves like Keep Natural/i);

		const showAll = galleryPage({
			layout: 'justified',
			pagination_type: 'show_all',
			layout_justified_last_row: 'hide',
		});
		await new GalleryEditor(page).open(showAll.id);
		await panel.switchTab('layout');
		await expect(notice).toBeVisible();

		const paginated = galleryPage({
			layout: 'justified',
			pagination_type: 'paginated',
			layout_justified_last_row: 'hide',
		});
		await new GalleryEditor(page).open(paginated.id);
		await panel.switchTab('layout');
		await expect(notice).toBeHidden();
	}
);
