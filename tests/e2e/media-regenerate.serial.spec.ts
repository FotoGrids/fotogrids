import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { firstItem } from './support/fixtures';
import { storageStateFor, wpCli, wpEval } from './support/roles';
import {
	attachmentMeta,
	cloneAttachment,
	deleteAttachments,
} from './support/media';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Settings > Media and Tools > Regenerate Thumbnails, together: a size change
 * reaches existing uploads once they are regenerated.
 *
 * Serial: the Media settings are site-wide, and Regenerate All walks every
 * gallery image. The settings are put back.
 */

test.describe.configure({ mode: 'serial' });

const OPTION = 'fotogrids_media_settings';
const TOOL =
	'/wp-admin/admin.php?page=fotogrids-tools&tool=regenerate-thumbnails';
const REGENERATE = '/admin/tools/regenerate-thumbnails/regenerate';

let saved = '';
const created: number[] = [];
const galleries: number[] = [];

function readOption(): string {
	return execFileSync(wpCli(), ['option', 'get', OPTION, '--format=json'], {
		encoding: 'utf8',
	}).trim();
}

test.beforeAll(() => {
	saved = readOption();
});

test.afterAll(() => {
	execFileSync(wpCli(), ['option', 'update', OPTION, '--format=json'], {
		encoding: 'utf8',
		input: saved,
	});
	deleteAttachments(created);
	if (galleries.length) {
		wpEval(
			`foreach ( array( ${galleries.join(',')} ) as $id ) { wp_delete_post( $id, true ); }`
		);
	}
});

/** A gallery image of the spec's own, the newest attachment, so it heads the tool's list. */
function ownGalleryImage(label: string): number {
	const id = cloneAttachment(
		firstItem('F-exif'),
		`regen-${label}-${process.pid}.jpg`
	);
	created.push(id);
	galleries.push(galleryPage({}, [id]).id);
	return id;
}

function toolRow(page: Page, filename: string) {
	return page.locator('.fg-regenerate-thumbnails__table tbody tr').filter({
		has: page.locator('.fg-regenerate-thumbnails__file-name', {
			hasText: filename,
		}),
	});
}

function thumbnailStatus(page: Page, filename: string) {
	return toolRow(page, filename)
		.locator('.fg-regenerate-thumbnails__row-status')
		.filter({ hasText: 'Thumbnail' })
		.first();
}

/**
 * MED-02, TOOL-04. New thumbnail dimensions saved on the Media tab are written
 * to an existing upload when the tool regenerates it: the row shows the old
 * file, the Log tab shows the single-file run complete with the new size, and
 * the row and the file on disk follow.
 */
test(
	'MED-02, TOOL-04: regenerating one image writes the thumbnail size just saved',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		const item = ownGalleryImage('one');
		const filename = attachmentMeta(item).file.split('/').pop() ?? '';
		const width = 320 + (process.pid % 50);
		const height = 200;

		expect(attachmentMeta(item).sizes.fotogrids_thumbnail).toMatchObject({
			width: 400,
			height: 300,
		});

		await page.goto(
			'/wp-admin/admin.php?page=fotogrids-settings&tab=media'
		);
		await page.locator('#fg-thumb-width').fill(String(width));
		await page.locator('#fg-thumb-height').fill(String(height));
		await page.locator('#fg-thumb-height').blur();
		await expect
			.poll(() => JSON.parse(readOption()), { timeout: 15000 })
			.toMatchObject({
				thumbnail_width: width,
				thumbnail_height: height,
			});

		await page.goto(TOOL);
		await expect(thumbnailStatus(page, filename)).toContainText('400×300');

		const done = page.waitForResponse((r) =>
			decodeURIComponent(r.url()).includes(REGENERATE)
		);
		await toolRow(page, filename)
			.getByRole('button', { name: 'Regenerate', exact: true })
			.click();
		expect((await done).status()).toBe(200);

		const log = page.locator('.fg-regenerate-thumbnails__log');
		await expect(page.getByRole('tab', { name: 'Log' })).toBeVisible();
		await expect(
			page.locator('.fg-regenerate-thumbnails__progress-count')
		).toHaveText('1 / 1', { timeout: 30000 });
		await expect(
			page.locator('.fg-regenerate-thumbnails__progress-percent')
		).toHaveText('100%');
		const entry = log
			.locator('.fg-regenerate-thumbnails__log-entry')
			.filter({ hasText: filename });
		await expect(entry).toHaveCount(1);
		await expect(
			entry
				.locator('.fg-regenerate-thumbnails__log-size--ok')
				.filter({ hasText: 'FotoGrids Thumbnails' })
		).toContainText(`${width}×${height}`);

		await page.getByRole('tab', { name: 'Regenerate' }).click();
		await expect(thumbnailStatus(page, filename)).toContainText(
			`${width}×${height}`
		);

		const regenerated = attachmentMeta(item).sizes.fotogrids_thumbnail;
		expect(regenerated).toMatchObject({ width, height });
		expect(regenerated.file).toContain(`-${width}x${height}.`);
	}
);

/**
 * TOOL-04. Regenerate All works through the gallery images one request at a
 * time, newest first, counting progress against the total, and Cancel stops
 * the loop after the file in hand.
 */
test(
	'TOOL-04: Regenerate All loops one image at a time and Cancel stops it',
	{ tag: '@admin' },
	async ({ page }) => {
		const item = ownGalleryImage('all');
		const filename = attachmentMeta(item).file.split('/').pop() ?? '';
		const posted: number[] = [];

		// Hold every request after the first, so the loop is cancelled before it reaches a seeded image.
		let release: () => void = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route(
			/regenerate-thumbnails%2Fregenerate|regenerate-thumbnails\/regenerate/,
			async (route) => {
				posted.push(route.request().postDataJSON().attachment_id);
				if (posted.length > 1) {
					await held;
					await route.fulfill({
						json: {
							attachment_id: posted[1],
							sizes: {},
							source: {},
						},
					});
					return;
				}
				await route.continue();
			}
		);

		await page.goto(TOOL);
		await expect(toolRow(page, filename)).toHaveCount(1);
		await page.getByRole('button', { name: 'Regenerate All' }).click();

		const count = page.locator('.fg-regenerate-thumbnails__progress-count');
		await expect(count).toHaveText(/^1 \/ \d+$/, { timeout: 30000 });
		const total = Number((await count.textContent())?.split('/')[1]);
		expect(total).toBeGreaterThan(1);
		await expect(
			page.locator('.fg-regenerate-thumbnails__log-entry').first()
		).toContainText(filename);

		await page
			.locator('.fg-regenerate-thumbnails__log-header')
			.getByRole('button', { name: 'Cancel' })
			.click();
		release();

		await expect(
			page
				.locator('.fg-regenerate-thumbnails__log-header')
				.getByRole('button', { name: 'Cancel' })
		).toHaveCount(0);
		await expect(count).toHaveText(`2 / ${total}`);
		expect(posted[0]).toBe(item);
		expect(posted).toHaveLength(2);
	}
);
