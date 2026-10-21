import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { GalleryEditor, PAST_DEBOUNCE } from './support/gallery-editor';
import { storageStateFor, wpEval } from './support/roles';
import { fixture } from './support/fixtures';
import { nextAjaxSave, recordToasts, toasts } from './support/save-pipeline';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The gallery editor's items metabox: adding items through the media frame,
 * reordering, featuring and removing them, and the Preview tab.
 *
 * Scoped: each test edits a gallery it created.
 */

test.describe.configure({ timeout: 90_000 });

/** A gallery's stored item ids, in order. */
function storedItems(id: number): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( ${id} ) );`
		)
	);
}

function thumbnailId(id: number): number {
	return Number(wpEval(`echo (int) get_post_thumbnail_id( ${id} );`));
}

/** The open media frame. */
function mediaFrame(page: Page): Locator {
	return page.locator('.media-modal:visible');
}

async function openAddOption(page: Page, label: string): Promise<void> {
	await new GalleryEditor(page).addNewMenu().click();
	await page.locator('.fotogrids-add-option', { hasText: label }).click();
	await expect(mediaFrame(page)).toBeVisible();
}

async function closeMediaFrame(page: Page): Promise<void> {
	await mediaFrame(page).locator('.media-modal-close').click();
	await expect(mediaFrame(page)).toHaveCount(0);
}

/** The router tab the frame is showing. */
function activeRouterTab(page: Page): Locator {
	return mediaFrame(page).locator('.media-router [aria-selected="true"]');
}

/** A new gallery built from the Media Library and published lists its items in the order picked. */
test(
	'GAL-01: a gallery built from the Media Library and published keeps its items in order',
	{ tag: ['@critical', '@admin'] },
	async ({ page }) => {
		const picked = fixture<number[]>('F-small', 'items')
			.slice(0, 3)
			.reverse();
		const editor = new GalleryEditor(page);

		await editor.openNew();
		await editor.title().fill(`From library ${Date.now()}-${process.pid}`);
		await page
			.locator('.fotogrids-noitems-add-block--action', {
				hasText: 'Add items from library',
			})
			.click();

		const frame = mediaFrame(page);
		await expect(frame.locator('.media-frame-title')).toHaveText(
			'Select Items for Gallery'
		);
		await frame.locator('#media-search-input').fill('Small');
		for (const id of picked) {
			const tile = frame.locator(`li.attachment[data-id="${id}"]`);
			await tile.click({ modifiers: ['ControlOrMeta'] });
			await expect(tile).toHaveAttribute('aria-checked', 'true');
		}
		await frame.getByRole('button', { name: 'Add to Gallery' }).click();

		await expect(editor.items()).toHaveCount(3);
		expect((await editor.itemOrder()).map(Number)).toEqual(picked);

		await Promise.all([
			page.waitForURL(/post\.php\?post=\d+&action=edit/),
			editor.publishButton().click(),
		]);
		const id = Number(new URL(page.url()).searchParams.get('post'));
		adopt(id);

		expect(wpEval(`echo get_post_status( ${id} );`)).toBe('publish');
		expect(storedItems(id)).toEqual(picked);
		const shortcode = page.locator('#fotogrids_gallery_shortcode');
		await expect(
			shortcode.locator('.fotogrids-shortcode-input')
		).toHaveValue(`[fotogrids_gallery id="${id}"]`);
		await expect(shortcode).not.toContainText(
			'Publish to display on the frontend.'
		);
		expect((await editor.itemOrder()).map(Number)).toEqual(picked);
	}
);

/**
 * The media frame remembers its last tab; Upload and From Library each force
 * their own tab regardless.
 */
test(
	'GAL-02, GAL-03: Upload opens the frame on Upload and From Library on the Media Library',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const { id } = galleryPage();
		await new GalleryEditor(page).open(id);

		await openAddOption(page, 'From Library');
		await expect(activeRouterTab(page)).toHaveText('Media Library');
		await closeMediaFrame(page);

		await openAddOption(page, 'Upload');
		await expect(activeRouterTab(page)).toHaveText('Upload files');
		await expect(
			mediaFrame(page).getByRole('heading', {
				name: 'Drop files to upload',
			})
		).toBeVisible();
		await closeMediaFrame(page);

		await openAddOption(page, 'From Library');
		await expect(activeRouterTab(page)).toHaveText('Media Library');
		await expect(
			mediaFrame(page).locator('li.attachment').first()
		).toBeVisible();
		await closeMediaFrame(page);

		await openAddOption(page, 'Upload');
		await expect(activeRouterTab(page)).toHaveText('Upload files');
	}
);

/** An empty gallery offers the drop area and the three other ways to add items. */
test(
	'GAL-15: an empty gallery shows the upload area and three add paths',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const { id } = galleryPage({}, []);
		await new GalleryEditor(page).open(id);

		const blocks = page.locator(
			'.fotogrids-noitems-add-grid > .fotogrids-noitems-add-block'
		);
		await expect(page.locator('#fotogrids-items-container')).toContainText(
			'No items yet added.'
		);
		await expect(blocks).toHaveCount(4);
		await expect(
			blocks.nth(0).locator('.fotogrids-upload-area input[type="file"]')
		).toHaveCount(1);
		await expect(blocks.nth(1)).toContainText('Add items from library');
		await expect(blocks.nth(2)).toContainText('Add a video embed');
		await expect(blocks.nth(3)).toContainText('Add from other sources');
		await expect(page.locator('#fotogrids-items-grid')).toHaveCount(0);
	}
);

/** Dragging a tile shows a placeholder, and the order left in the grid is the order saved. */
test(
	'GAL-10: dragging an item reorders the grid and the saved list',
	{ tag: ['@critical', '@admin'] },
	async ({ page }) => {
		const ids = fixture<number[]>('F-small', 'items');
		const { id } = galleryPage({}, ids);
		const editor = new GalleryEditor(page);
		await editor.open(id);
		await expect(editor.items()).toHaveCount(ids.length);

		const source = editor.item(ids[0]);
		const target = editor.item(ids[3]);
		const box = await target.boundingBox();
		await source.hover();
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
			steps: 10,
		});
		await expect(
			page.locator('#fotogrids-items-grid .fotogrids-item-placeholder')
		).toHaveCount(1);
		await page.mouse.move(
			box.x + box.width / 2 + 4,
			box.y + box.height / 2,
			{ steps: 2 }
		);
		const saved = nextAjaxSave(page, PAST_DEBOUNCE * 3);
		await page.mouse.up();

		await expect(
			page.locator('#fotogrids-items-grid .fotogrids-item-placeholder')
		).toHaveCount(0);
		await expect
			.poll(async () => (await editor.itemOrder())[0])
			.toBe(String(ids[1]));
		const expected = (await editor.itemOrder()).map(Number);
		expect([...expected].sort()).toEqual([...ids].sort());
		expect(expected.indexOf(ids[0])).toBeGreaterThan(1);
		const hidden = await page
			.locator('input[name="fotogrids_gallery_items[]"]')
			.evaluateAll((inputs) =>
				inputs.map((input) => Number((input as HTMLInputElement).value))
			);
		expect(hidden).toEqual(expected);

		await saved;
		expect(storedItems(id)).toEqual(expected);
		await editor.open(id);
		expect((await editor.itemOrder()).map(Number)).toEqual(expected);
	}
);

/** The star sets the gallery's featured image, and pressing it again clears it. */
test(
	'GAL-11, GAL-12: starring an item features it, starring it again clears it',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const ids = fixture<number[]>('F-small', 'items');
		const { id } = galleryPage({}, ids);
		const editor = new GalleryEditor(page);
		const featured = (body: string | null) =>
			page.waitForResponse(
				(response) =>
					response
						.url()
						.includes(
							`/fotogrids/v1/gallery/${id}/featured-item`
						) &&
					'POST' === response.request().method() &&
					(null === body || response.request().postData() === body),
				{ timeout: 30000 }
			);
		await editor.open(id);
		await recordToasts(page);
		expect(thumbnailId(id)).toBe(0);

		let sent = featured(JSON.stringify({ item_id: ids[2] }));
		await editor.toggleFeatured(ids[2]);
		expect((await sent).ok()).toBe(true);
		expect(await editor.isFeatured(ids[2])).toBe(true);
		expect(thumbnailId(id)).toBe(ids[2]);

		sent = featured(JSON.stringify({ item_id: ids[4] }));
		await editor.toggleFeatured(ids[4]);
		await sent;
		expect(await editor.isFeatured(ids[2])).toBe(false);
		expect(thumbnailId(id)).toBe(ids[4]);

		sent = featured(JSON.stringify({ item_id: null }));
		await editor.toggleFeatured(ids[4]);
		expect((await sent).ok()).toBe(true);
		expect(await editor.isFeatured(ids[4])).toBe(false);
		expect(thumbnailId(id)).toBe(0);

		expect(await toasts(page)).toEqual([
			'success: Featured item set',
			'success: Featured item set',
			'success: Featured item cleared',
		]);
		await editor.open(id);
		for (const item of ids) {
			expect(await editor.isFeatured(item)).toBe(false);
		}
	}
);

/** Removing a tile drops it from the saved list and leaves the attachment alone. */
test(
	'GAL-13: removing an item drops it from the saved list only',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const ids = fixture<number[]>('F-small', 'items');
		const { id } = galleryPage({}, ids);
		const editor = new GalleryEditor(page);
		await editor.open(id);

		const saved = nextAjaxSave(page, PAST_DEBOUNCE * 3);
		await editor.removeItem(ids[1]).click();
		await expect(editor.item(ids[1])).toHaveCount(0);
		await expect(editor.items()).toHaveCount(ids.length - 1);
		await saved;

		const remaining = ids.filter((item) => item !== ids[1]);
		expect(storedItems(id)).toEqual(remaining);
		expect(wpEval(`echo get_post_type( ${ids[1]} );`)).toBe('attachment');
		await editor.open(id);
		expect((await editor.itemOrder()).map(Number)).toEqual(remaining);
	}
);

/** The Preview tab renders the gallery in the metabox, and a reload comes back to it. */
test(
	'GAL-16: the Preview tab renders the gallery and survives a reload',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const ids = fixture<number[]>('F-small', 'items');
		const { id } = galleryPage({}, ids);
		const editor = new GalleryEditor(page);
		const previewTab = page.locator('.fotogrids-gallery-tab', {
			hasText: 'Preview Gallery',
		});
		const preview = editor
			.metabox()
			.locator('.fotogrids-gallery-tab-content--active');
		await editor.open(id);

		await previewTab.click();
		await expect(previewTab).toHaveClass(/fotogrids-gallery-tab--active/);
		await expect(page).toHaveURL(/[?&]fg-items-tab=preview/);
		await expect(
			preview.locator(`[data-fg-gallery-id="${id}"] .fg-item`).first()
		).toBeVisible({ timeout: 20000 });

		await page.reload();
		await expect(previewTab).toHaveClass(/fotogrids-gallery-tab--active/);
		await expect(
			preview.locator(`[data-fg-gallery-id="${id}"] .fg-item`).first()
		).toBeVisible({ timeout: 20000 });
		await expect(editor.addNewMenu()).toHaveCount(0);

		await page
			.locator('.fotogrids-gallery-tab', { hasText: 'Manage Items' })
			.click();
		await expect(page).toHaveURL(/[?&]fg-items-tab=manage/);
		await expect(editor.items()).toHaveCount(ids.length);
	}
);
