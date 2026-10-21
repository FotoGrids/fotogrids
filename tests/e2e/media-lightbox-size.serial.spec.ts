import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { firstItem } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { SettingsPage } from './support/settings-page';
import { storageStateFor, wpCli, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Settings > Media > Lightbox image decides the file the lightbox shows.
 *
 * Serial: rewrites the site's image sizes. The option is put back and the
 * uploaded image deleted afterwards.
 */

test.describe.configure({ mode: 'serial' });

const OPTION = 'fotogrids_media_settings';
const REST = '/fotogrids/v1/admin/media-settings';

let savedOption: string | null = null;
let uploaded = 0;

function wp(args: string[], input?: string): string {
	return execFileSync(wpCli(), args, {
		encoding: 'utf8',
		input,
		stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
	}).trim();
}

test.beforeAll(() => {
	try {
		savedOption = wp(['option', 'get', OPTION, '--format=json']);
	} catch {
		savedOption = null;
	}
});

test.afterAll(() => {
	if (null === savedOption) {
		try {
			wp(['option', 'delete', OPTION]);
		} catch {
			// Already absent.
		}
	} else {
		wp(['option', 'update', OPTION, '--format=json'], savedOption);
	}
	if (uploaded) {
		wp(['post', 'delete', String(uploaded), '--force']);
	}
});

/** A width saved on the Media tab is the width of the image the lightbox opens. */
test(
	'PSET-06: the lightbox shows the image size set on the Media tab',
	{ tag: ['@settings', '@lightbox'] },
	async ({ page }, testInfo) => {
		testInfo.setTimeout(90_000);
		const settings = new SettingsPage(page);
		const read = settings.read(REST);
		await settings.open('media');
		await read;

		await page.locator('#fg-full-width').fill('800');
		await page.locator('#fg-full-height').fill('0');
		const write = settings.write(REST);
		if (await settings.saveButton().isEnabled()) {
			await settings.saveButton().click();
		}
		expect((await write).ok()).toBe(true);

		// A new upload is cut to the sizes registered when it arrives.
		const source = wpEval(
			`echo get_attached_file( ${firstItem('F-small')} );`
		).trim();
		uploaded = Number(
			wp([
				'media',
				'import',
				source,
				'--user=admin',
				`--title=Lightbox size ${process.pid}`,
				'--porcelain',
			])
		);
		expect(uploaded).toBeGreaterThan(0);
		const size = JSON.parse(
			wpEval(
				`echo wp_json_encode( wp_get_attachment_image_src( ${uploaded}, 'fotogrids_full' ) );`
			)
		) as [string, number, number, boolean];
		expect(size[1], 'the upload was not cut to the saved width').toBe(800);

		const { id, url } = galleryPage(
			{
				layout: 'grid',
				item_click_behavior: 'lightbox',
				lightbox_variant: 'full',
				full_image_size: 'fotogrids_full',
			},
			[uploaded]
		);
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.goto(url);
		const gallery = new GalleryRender(page, id);
		await gallery.waitFor();

		const lightbox = new Lightbox(page);
		await lightbox.openFrom(gallery, 0);
		const image = lightbox.image();
		await expect(image).toBeVisible();
		await expect
			.poll(() =>
				image.evaluate(
					(element: HTMLImageElement) =>
						element.complete && element.naturalWidth
				)
			)
			.toBe(800);
		expect(
			await image.evaluate(
				(element: HTMLImageElement) => element.currentSrc
			)
		).toBe(size[0]);
		expect(await image.getAttribute('src')).toBe(size[0]);
	}
);
