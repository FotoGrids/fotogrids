import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor, wpEval } from './support/roles';
import { fixture } from './support/fixtures';
import { recordToasts, toasts } from './support/save-pipeline';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Adding YouTube and Vimeo embeds from the gallery editor. The two resolve
 * tests fetch real oEmbed metadata, so they need the network.
 *
 * Scoped: each test edits a gallery it created, and removes the embeds it added.
 */

test.describe.configure({ timeout: 90_000 });

const VIDEOS = [
	{
		row: 'GAL-07',
		source: 'YouTube',
		itemType: 'video_youtube',
		url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
		videoId: 'aqz-KE-bpKQ',
	},
	{
		row: 'GAL-08',
		source: 'Vimeo',
		itemType: 'video_vimeo',
		url: 'https://vimeo.com/1084537',
		videoId: '1084537',
	},
];

function storedItems(id: number): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( ${id} ) );`
		)
	);
}

function embedDialog(page: Page): Locator {
	return page.getByRole('dialog', { name: 'Add a video embed' });
}

async function openEmbedModal(page: Page, source: string): Promise<Locator> {
	await new GalleryEditor(page).addNewMenu().click();
	await page
		.locator('.fotogrids-add-option', { hasText: 'Video Embed' })
		.click();
	const dialog = embedDialog(page);
	await expect(dialog).toBeVisible();
	await dialog
		.locator('.fg-button-group__button', { hasText: source })
		.click();
	return dialog;
}

for (const video of VIDEOS) {
	/** The link resolves to a title and thumbnail, and Add puts a video tile in the grid and the gallery. */
	test(
		`${video.row}: a ${video.source} link resolves and is added as a video item`,
		{ tag: ['@admin'] },
		async ({ page }) => {
			const ids = fixture<number[]>('F-small', 'items').slice(0, 2);
			const { id } = galleryPage({}, ids);
			const editor = new GalleryEditor(page);
			await editor.open(id);
			await recordToasts(page);

			const dialog = await openEmbedModal(page, video.source);
			const resolved = page.waitForResponse(
				(response) =>
					response
						.url()
						.includes('/fotogrids/v1/items/resolve-embed') &&
					'POST' === response.request().method()
			);
			await dialog.locator('#fg-embed-url').fill(video.url);
			await dialog.locator('#fg-embed-url').press('Enter');
			const meta = await (await resolved).json();

			expect(meta.video_id).toBe(video.videoId);
			expect(meta.title).not.toBe('');
			expect(meta.thumbnail_url).toMatch(/^https:\/\//);
			await expect(dialog.locator('#fg-embed-caption')).toHaveValue(
				meta.title
			);
			await expect(
				dialog.locator('.fotogrids-item-preview img')
			).toHaveAttribute('src', meta.thumbnail_url);

			const created = page.waitForResponse(
				(response) =>
					response.url().includes('/fotogrids/v1/items/embed') &&
					'POST' === response.request().method()
			);
			await dialog
				.getByRole('button', { name: 'Add to Gallery' })
				.click();
			const embed = await (await created).json();
			await expect(dialog).toBeHidden();

			const tile = editor.item(embed.id);
			await expect(tile).toHaveAttribute(
				'data-item-type',
				video.itemType
			);
			await expect(
				tile.locator('.fotogrids-item-video-badge')
			).toBeVisible();
			await expect(tile.locator('img')).toHaveAttribute(
				'src',
				meta.thumbnail_url
			);
			expect(storedItems(id)).toEqual([...ids, embed.id]);
			expect(await toasts(page)).toEqual(
				expect.arrayContaining([
					'success: Video loaded successfully.',
					'success: Video added to gallery.',
				])
			);

			const removed = page.waitForResponse(
				(response) =>
					response
						.url()
						.includes(`/fotogrids/v1/items/embed/${embed.id}`) &&
					'DELETE' === response.request().method()
			);
			await editor.removeItem(embed.id).click();
			expect((await removed).ok()).toBe(true);
			await expect(tile).toHaveCount(0);
		}
	);
}

/** A link that is not a video of the chosen source is refused before any request is sent. */
test(
	'GAL-09: a link for the wrong source is refused with a message',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const resolves: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('resolve-embed')) {
				resolves.push(request.url());
			}
		});
		await new GalleryEditor(page).open(id);

		let dialog = await openEmbedModal(page, 'YouTube');
		await dialog.locator('#fg-embed-url').fill('https://vimeo.com/1084537');
		await dialog.locator('#fg-embed-url').press('Enter');
		await expect(dialog).toContainText('Please enter a valid YouTube URL.');
		await expect(
			dialog.getByRole('button', { name: 'Add to Gallery' })
		).toBeDisabled();

		await dialog
			.locator('.fg-button-group__button', { hasText: 'Vimeo' })
			.click();
		await dialog
			.locator('#fg-embed-url')
			.fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
		await dialog.locator('#fg-embed-url').press('Enter');
		await expect(dialog).toContainText('Please enter a valid Vimeo URL.');
		await expect(
			dialog.getByRole('button', { name: 'Add to Gallery' })
		).toBeDisabled();

		expect(resolves).toEqual([]);
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await page.getByRole('button', { name: 'Discard changes' }).click();
		dialog = embedDialog(page);
		await expect(dialog).toBeHidden();
	}
);

test.describe('with the lookup failing', () => {
	test.use({
		allowConsoleErrors: 'the metadata lookup is answered with a 500',
	});

	/**
	 * When the metadata lookup fails, the modal says so and still offers the
	 * video, built from the id in the link.
	 */
	test(
		'GAL-09: a failed metadata lookup still lets the video be added',
		{ tag: ['@admin'] },
		async ({ page }) => {
			const { id } = galleryPage();
			await new GalleryEditor(page).open(id);
			await page.route('**/fotogrids/v1/items/resolve-embed**', (route) =>
				route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: '{}',
				})
			);

			const dialog = await openEmbedModal(page, 'YouTube');
			await dialog
				.locator('#fg-embed-url')
				.fill('https://youtu.be/aqz-KE-bpKQ');
			await dialog.locator('#fg-embed-url').press('Enter');

			await expect(dialog).toContainText(
				'Video found but metadata could not be fetched.'
			);
			await expect(dialog.locator('.fotogrids-file-info')).toContainText(
				'aqz-KE-bpKQ'
			);
			await expect(
				dialog.getByRole('button', { name: 'Add to Gallery' })
			).toBeEnabled();
		}
	);
});
