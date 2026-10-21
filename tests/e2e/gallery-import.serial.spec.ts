import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The gallery editor's From Folder and From ZIP imports.
 *
 * Serial: the folder imports write into the uploads folder and the Media
 * Library. Every file and attachment a test adds is removed afterwards.
 */

test.describe.configure({ mode: 'serial', timeout: 120_000 });

const SOURCE_ATTACHMENT = 8;

function uploadsDir(): string {
	return wpEval('echo wp_get_upload_dir()["basedir"];').trim();
}

function sourceImage(): string {
	return wpEval(`echo get_attached_file( ${SOURCE_ATTACHMENT} );`).trim();
}

function storedItems(id: number): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( ${id} ) );`
		)
	);
}

function deleteAttachments(ids: number[]): void {
	if (ids.length) {
		wpEval(
			`foreach ( array( ${ids.join(',')} ) as $id ) { wp_delete_attachment( $id, true ); }`
		);
	}
}

async function openFolderModal(page: Page): Promise<Locator> {
	await new GalleryEditor(page).addNewMenu().click();
	await page
		.locator('.fotogrids-add-option', { hasText: 'From Folder' })
		.click();
	const dialog = page.getByRole('dialog', {
		name: 'Add images from a folder',
	});
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe('from a folder on the server', () => {
	const name = `fg-e2e-folder-${process.pid}-${Date.now()}`;
	const COUNT = 101;
	let folder: string;
	let added: number[] = [];

	test.beforeAll(() => {
		folder = path.join(uploadsDir(), name);
		mkdirSync(folder, { recursive: true });
		const image = sourceImage();
		for (let i = 1; i <= COUNT; i++) {
			copyFileSync(
				image,
				path.join(folder, `photo-${String(i).padStart(3, '0')}.jpg`)
			);
		}
	});

	test.afterAll(() => {
		deleteAttachments(added);
		rmSync(folder, { recursive: true, force: true });
	});

	/**
	 * The browser walks into a folder, pages it with Load more, selects with
	 * Select all, and imports the chosen files as Media Library attachments.
	 * Imported files lose their New badge.
	 */
	test(
		'GAL-04: a server folder is browsed, selected and imported as attachments',
		{ tag: ['@admin'] },
		async ({ page }) => {
			const items = [SOURCE_ATTACHMENT];
			const { id } = galleryPage({}, items);
			const editor = new GalleryEditor(page);
			await editor.open(id);

			let dialog = await openFolderModal(page);
			await dialog
				.locator('.fg-upload-folder-list__item', { hasText: name })
				.click();
			await expect(
				dialog.locator('.fg-upload-folder-crumbs')
			).toContainText(name);
			await expect(
				dialog.locator('.fg-upload-folder-browser__count')
			).toHaveText(`100 / ${COUNT}`);
			await expect(dialog.locator('.fg-upload-folder-tile')).toHaveCount(
				100
			);

			await dialog.getByRole('button', { name: 'Load more' }).click();
			await expect(
				dialog.locator('.fg-upload-folder-browser__count')
			).toHaveText(`${COUNT} / ${COUNT}`);
			await expect(
				dialog.getByRole('button', { name: 'Load more' })
			).toHaveCount(0);
			await expect(
				dialog.locator('.fg-upload-folder-tile__badge')
			).toHaveCount(COUNT);

			const selectAll = dialog.getByLabel('Select all');
			await selectAll.check();
			await expect(
				dialog.locator(
					'.fg-upload-folder-tile__button[aria-pressed="true"]'
				)
			).toHaveCount(COUNT);
			await expect(
				dialog.getByRole('button', {
					name: `Add to Gallery (${COUNT})`,
				})
			).toBeVisible();
			await selectAll.uncheck();
			await expect(
				dialog.locator(
					'.fg-upload-folder-tile__button[aria-pressed="true"]'
				)
			).toHaveCount(0);

			const tiles = dialog.locator('.fg-upload-folder-tile__button');
			await tiles.nth(0).click();
			await tiles.nth(1).click();
			await dialog
				.getByRole('button', { name: 'Add to Gallery (2)' })
				.click();
			await expect(dialog).toBeHidden({ timeout: 60000 });
			await expect(editor.items()).toHaveCount(3);

			added = (await editor.itemOrder()).map(Number).slice(1);
			const files = JSON.parse(
				wpEval(`
				echo wp_json_encode( array_map( function ( $id ) {
					return array( get_post_type( $id ), get_post_meta( $id, '_wp_attached_file', true ) );
				}, array( ${added.join(',')} ) ) );
			`)
			);
			expect(files).toEqual([
				['attachment', `${name}/photo-001.jpg`],
				['attachment', `${name}/photo-002.jpg`],
			]);

			await page.keyboard.press('Control+s');
			await expect
				.poll(() => storedItems(id))
				.toEqual([...items, ...added]);

			dialog = await openFolderModal(page);
			await dialog
				.locator('.fg-upload-folder-list__item', { hasText: name })
				.click();
			await expect(
				dialog.locator('.fg-upload-folder-tile__badge')
			).toHaveCount(100 - 2);
			await expect(
				dialog
					.locator('.fg-upload-folder-tile')
					.nth(0)
					.locator('.fg-upload-folder-tile__badge')
			).toHaveCount(0);
		}
	);
});

test.describe('from a folder on this computer', () => {
	let local: string;
	let added: number[] = [];

	test.beforeAll(() => {
		local = mkdtempSync(path.join(os.tmpdir(), 'fg-e2e-local-'));
		const image = sourceImage();
		mkdirSync(path.join(local, 'nested'));
		copyFileSync(image, path.join(local, 'top-a.jpg'));
		copyFileSync(image, path.join(local, 'top-b.jpg'));
		copyFileSync(image, path.join(local, 'nested', 'inner-c.jpg'));
		writeFileSync(path.join(local, 'notes.txt'), 'not an image');
	});

	test.afterAll(() => {
		deleteAttachments(added);
		rmSync(local, { recursive: true, force: true });
	});

	/** Every image in the picked folder and its sub-folders is uploaded and added. */
	test(
		'GAL-05: a folder from this computer uploads every image, sub-folders included',
		{ tag: ['@admin'] },
		async ({ page }) => {
			const { id } = galleryPage({}, []);
			const editor = new GalleryEditor(page);
			await editor.open(id);

			const dialog = await openFolderModal(page);
			await dialog.getByRole('tab', { name: 'From my computer' }).click();
			await dialog
				.locator('#fotogrids-folder-upload-input')
				.setInputFiles(local);
			await expect(
				dialog.locator('.fg-upload-folder-local__summary')
			).toContainText('3 images ready to upload');

			await dialog.getByRole('button', { name: 'Upload & Add' }).click();
			await expect(dialog).toBeHidden({ timeout: 60000 });
			await expect(editor.items()).toHaveCount(3);

			added = (await editor.itemOrder()).map(Number);
			const titles = JSON.parse(
				wpEval(
					`echo wp_json_encode( array_map( 'get_post_type', array( ${added.join(',')} ) ) );`
				)
			);
			expect(titles).toEqual(['attachment', 'attachment', 'attachment']);
			await page.keyboard.press('Control+s');
			await expect
				.poll(() => storedItems(id).sort())
				.toEqual([...added].sort());
		}
	);
});

test.describe('from a ZIP file', () => {
	let dir: string;

	test.beforeAll(() => {
		dir = mkdtempSync(path.join(os.tmpdir(), 'fg-e2e-zip-'));
	});

	test.afterAll(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	async function openZipModal(page: Page): Promise<Locator> {
		await new GalleryEditor(page).addNewMenu().click();
		await page
			.locator('.fotogrids-add-option', { hasText: 'From ZIP' })
			.click();
		const dialog = page.getByRole('dialog', {
			name: 'Add images from a ZIP file',
		});
		await expect(dialog).toBeVisible();
		return dialog;
	}

	/** A file that is not a ZIP is refused in the modal and by the endpoint. */
	test(
		'GAL-06: a file that is not a ZIP archive is refused',
		{ tag: ['@admin'] },
		async ({ page }) => {
			const { id } = galleryPage();
			const fake = path.join(dir, 'photos.txt');
			writeFileSync(fake, 'PK not really');
			const editor = new GalleryEditor(page);
			await editor.open(id);

			const dialog = await openZipModal(page);
			await dialog
				.locator('#fotogrids-zip-upload-input')
				.setInputFiles(fake);
			await expect(dialog).toContainText(
				'That file is not a ZIP archive.'
			);
			await expect(
				dialog.getByRole('button', { name: 'Upload & Add' })
			).toBeDisabled();

			const nonce = await page.evaluate(
				() =>
					(window as unknown as { wpApiSettings: { nonce: string } })
						.wpApiSettings.nonce
			);
			const response = await page.request.post(
				'/index.php?rest_route=/fotogrids/v1/media/import/zip',
				{
					headers: { 'X-WP-Nonce': nonce },
					multipart: {
						gallery_id: String(id),
						file: {
							name: 'photos.txt',
							mimeType: 'text/plain',
							buffer: Buffer.from('PK not really'),
						},
					},
				}
			);
			expect(response.status()).toBe(400);
			expect((await response.json()).message).toBe(
				'That file is not a ZIP archive.'
			);
			expect(storedItems(id)).toHaveLength(5);
		}
	);

	test.describe('over the upload limit', () => {
		test.use({
			allowConsoleErrors:
				'the endpoint answers the oversized upload with a 400',
		});

		/**
		 * The drop zone names the site's upload limit, and an archive over it is
		 * refused with an error and adds nothing.
		 */
		test(
			'GAL-06: an archive over the upload limit is refused',
			{ tag: ['@admin'] },
			async ({ page }) => {
				const { id } = galleryPage();
				const limits = JSON.parse(
					wpEval(
						`echo wp_json_encode( array( wp_max_upload_size(), size_format( wp_max_upload_size() ), wp_convert_hr_to_bytes( ini_get( 'post_max_size' ) ) ) );`
					)
				);
				const [max, label, postMax] = limits as [
					number,
					string,
					number,
				];
				test.skip(
					max + 1024 * 1024 >= postMax,
					'post_max_size leaves no room for an over-limit file'
				);
				const big = path.join(dir, 'too-big.zip');
				writeFileSync(big, Buffer.alloc(max + 512 * 1024, 1));
				const editor = new GalleryEditor(page);
				await editor.open(id);

				const dialog = await openZipModal(page);
				await expect(dialog).toContainText(
					`Maximum upload size: ${label}`
				);
				await dialog
					.locator('#fotogrids-zip-upload-input')
					.setInputFiles(big);
				await dialog
					.getByRole('button', { name: 'Upload & Add' })
					.click();

				const error = dialog.locator('.fotogrids-upload-area__error');
				await expect(error).toBeVisible({ timeout: 30000 });
				await expect(dialog).toBeVisible();
				await expect(editor.items()).toHaveCount(5);
				expect(storedItems(id)).toHaveLength(5);
			}
		);
	});
});
