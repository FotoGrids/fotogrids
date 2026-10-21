import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor } from './support/roles';

/**
 * The editor warns when click-to-zoom and the lightbox both claim an item's
 * click, and drops the warning once they no longer clash.
 *
 * scoped: each test edits only a gallery it created, and saves nothing.
 */

test.use({ storageState: storageStateFor('administrator') });

const CLASH = {
	layout: 'grid',
	item_click_behavior: 'lightbox',
	interactions_zoom: true,
	interactions_zoom_style: 'popover',
	interactions_zoom_mode: 'click',
};

async function openSubtab(
	panel: CollectionSettings,
	label: string
): Promise<void> {
	await panel.openTab('Interactions');
	await panel.openSubtab(new RegExp(`^\\s*${label}\\s*$`));
}

/** DEC-13: both notices show for the clash and go when the mode changes. */
test(
	'DEC-13: popover zoom on click with the lightbox shows the conflict notice, and Hover clears it',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage(CLASH);
		const editor = new GalleryEditor(page);
		const panel = new CollectionSettings(page);
		const zoomNotice = panel.field('zoom_item_click_conflict_notice');
		const clickNotice = panel.field('item_click_zoom_conflict_notice');

		await editor.open(id);

		await openSubtab(panel, 'Item Click Behavior');
		await expect(clickNotice).toBeVisible();

		await openSubtab(panel, 'Image Zoom');
		await expect(zoomNotice).toBeVisible();
		await expect(zoomNotice).toContainText(
			'Conflicts with Item Click Behavior'
		);

		await panel
			.field('interactions_zoom_mode')
			.getByRole('button', { name: 'Hover', exact: true })
			.click();
		await expect(zoomNotice).toHaveCount(0);

		await openSubtab(panel, 'Item Click Behavior');
		await expect(clickNotice).toHaveCount(0);
	}
);

/** DEC-13: no notice when only one of the two claims the click. */
test(
	'DEC-13: no conflict notice when zoom opens on hover or the click does not open the lightbox',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const editor = new GalleryEditor(page);
		const panel = new CollectionSettings(page);

		for (const settings of [
			{ ...CLASH, interactions_zoom_mode: 'hover' },
			{ ...CLASH, item_click_behavior: 'nothing' },
			{ ...CLASH, interactions_zoom_style: 'inline' },
		]) {
			const { id } = galleryPage(settings);
			await editor.open(id);
			await openSubtab(panel, 'Image Zoom');
			await expect(panel.field('interactions_zoom_style')).toBeVisible();
			await expect(
				panel.field('zoom_item_click_conflict_notice'),
				JSON.stringify(settings)
			).toHaveCount(0);
		}
	}
);
