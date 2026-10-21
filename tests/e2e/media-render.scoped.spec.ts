import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { fixture, firstItem } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { GalleryEditor } from './support/gallery-editor';
import { apiAs, storageStateFor, wpEval } from './support/roles';
import {
	attachmentMeta,
	cloneAttachment,
	deleteAttachments,
	sizePath,
} from './support/media';

/**
 * Which image file a gallery shows, and what it does with the files it has.
 *
 * Scoped: every gallery and attachment here is the spec's own. The custom size
 * registry is site-wide, but only entries for these galleries are touched.
 */

const created: number[] = [];

test.afterAll(() => {
	deleteAttachments(created);
});

function own(id: number): number {
	created.push(id);
	return id;
}

function basename(url: string | null): string {
	return decodeURIComponent((url ?? '').split('?')[0].split('/').pop() ?? '');
}

/** The file a size of an attachment lives in. */
function sizeFile(id: number, size: string): string {
	return 'full' === size
		? basename(attachmentMeta(id).file)
		: attachmentMeta(id).sizes[size].file;
}

/** The thumbnail file a gallery rendered for one item. */
async function shownFile(
	page: Page,
	settings: Settings,
	item: number
): Promise<string> {
	const { id, url } = galleryPage(settings, [item]);
	const gallery = new GalleryRender(page, id);

	await page.goto(url);
	await gallery.waitFor();

	return basename(
		await gallery.root
			.locator(`img[data-id="${item}"]`)
			.first()
			.getAttribute('src')
	);
}

/**
 * MED-05. Masonry and Justified show the layout's own proportional size, which
 * the Media settings' Masonry width and Justified height control.
 */
test(
	'MED-05: masonry and justified render their own layout sizes',
	{ tag: '@layout' },
	async ({ page }) => {
		const item = fixture<number[]>('F-small', 'items')[0];

		expect(await shownFile(page, { layout: 'masonry' }, item)).toBe(
			sizeFile(item, 'fotogrids_masonry')
		);
		expect(await shownFile(page, { layout: 'justified' }, item)).toBe(
			sizeFile(item, 'fotogrids_justified')
		);
		expect(await shownFile(page, { layout: 'grid' }, item)).toBe(
			sizeFile(item, 'fotogrids_thumbnail')
		);
	}
);

/**
 * MED-12. A layout that needs its size (masonry, justified, image viewer) wins
 * over the size the user picked; one that only prefers it (single item,
 * slider) uses it only while the user left the default.
 */
test(
	'MED-12: a mandatory layout size overrides the pick, a preferred one only the default',
	{ tag: '@layout' },
	async ({ page }) => {
		const item = firstItem('F-exif');
		const large = sizeFile(item, 'large');
		const full = sizeFile(item, 'fotogrids_full');

		const cases: Array<[string, string, string]> = [
			['grid', 'large', large],
			['masonry', 'large', sizeFile(item, 'fotogrids_masonry')],
			['justified', 'large', sizeFile(item, 'fotogrids_justified')],
			['image-viewer', 'large', full],
			['single-item', 'large', large],
			['single-item', 'fotogrids_thumbnail', full],
			['slider', 'large', large],
			['slider', 'fotogrids_thumbnail', full],
		];

		for (const [layout, size, expected] of cases) {
			expect(
				await shownFile(page, { layout, thumbnail_size: size }, item),
				`${layout} / ${size}`
			).toBe(expected);
		}
	}
);

test.describe('MED-06', () => {
	/**
	 * MED-06. The hidden half-width companion is what the Lightbox loads on a
	 * phone; a desktop gets the full Lightbox size.
	 */
	for (const [viewport, size] of [
		[{ width: 390, height: 844 }, 'fotogrids_full_mobile'],
		[{ width: 1280, height: 800 }, 'fotogrids_full'],
	] as const) {
		test(
			`MED-06: the Lightbox on a ${viewport.width}px screen loads ${size}`,
			{ tag: '@lightbox' },
			async ({ page }) => {
				const item = firstItem('F-exif');
				const { id, url } = galleryPage(
					{ layout: 'grid', lightbox_variant: 'full' },
					[item]
				);
				const gallery = new GalleryRender(page, id);
				const lightbox = new Lightbox(page);

				await page.setViewportSize(viewport);
				await page.goto(url);
				await gallery.waitFor();
				await lightbox.openFrom(gallery);

				expect(basename(await lightbox.currentSrc())).toBe(
					sizeFile(item, size)
				);
			}
		);
	}
});

/**
 * MED-07, MED-08. A gallery's custom thumbnail size registers a slug named
 * after its dimensions, regenerating writes that file and the gallery shows it;
 * deleting the gallery drops the registry entry but leaves the file.
 */
test(
	'MED-07, MED-08: a gallery custom size is registered, generated, shown, and outlives the gallery on disk',
	{ tag: '@layout' },
	async ({ page, playwright }) => {
		const width = 300 + (process.pid % 200);
		const height = 211;
		const slug = `fotogrids_custom_${width}x${height}_crop`;
		const item = own(
			cloneAttachment(
				firstItem('F-single'),
				`custom-size-${process.pid}.jpg`
			)
		);

		const { id, url } = galleryPage(
			{
				layout: 'grid',
				thumbnail_size: 'custom',
				thumbnail_custom_size_width: width,
				thumbnail_custom_size_height: height,
				thumbnail_custom_size_crop: true,
			},
			[item]
		);

		const registry = () =>
			JSON.parse(
				wpEval(
					`echo wp_json_encode( get_option( 'fotogrids_custom_sizes', array() ) );`
				)
			) as Record<
				string,
				{
					width: number;
					height: number;
					crop: boolean;
					gallery_ids: number[];
				}
			>;

		expect(registry()[slug]).toMatchObject({ width, height, crop: true });
		expect(registry()[slug].gallery_ids).toContain(id);

		// The upload predates the size, so the gallery falls back until regenerated.
		expect(attachmentMeta(item).sizes[slug]).toBeUndefined();
		const admin = await apiAs(playwright, 'administrator');
		const response = await admin.context.post(
			`/index.php?rest_route=${encodeURIComponent('/fotogrids/v1/admin/tools/regenerate-thumbnails/regenerate')}`,
			{
				headers: { 'X-WP-Nonce': admin.nonce },
				data: { attachment_id: item },
			}
		);
		expect(response.status()).toBe(200);
		expect((await response.json()).sizes[slug]).toMatchObject({
			exists: true,
			width,
			height,
		});

		const file = sizePath(item, slug);
		const gallery = new GalleryRender(page, id);
		await page.goto(url);
		await gallery.waitFor();
		expect(
			basename(
				await gallery.root
					.locator(`img[data-id="${item}"]`)
					.getAttribute('src')
			)
		).toBe(basename(file));

		wpEval(`wp_delete_post( ${id}, true );`);

		expect(registry()[slug]).toBeUndefined();
		expect(
			wpEval(`echo file_exists( '${file}' ) ? 'yes' : 'no';`).trim()
		).toBe('yes');
	}
);

/**
 * MED-10. An image whose size has same-shaped siblings is wrapped in
 * `<picture>` with a `<source>` carrying its srcset; a cropped size with no
 * siblings, or an image with no subsizes at all, is a bare `<img>`.
 */
test(
	'MED-10: picture and source only when the image has a srcset',
	{ tag: '@layout' },
	async ({ page }) => {
		const sized = fixture<number[]>('F-small', 'items')[0];
		const bare = own(
			cloneAttachment(
				firstItem('F-single'),
				`no-subsizes-${process.pid}.jpg`,
				false
			)
		);

		const proportional = galleryPage(
			{ layout: 'grid', thumbnail_size: 'large' },
			[sized, bare]
		);
		const gallery = new GalleryRender(page, proportional.id);
		await page.goto(proportional.url);
		await gallery.waitFor();

		const picture = gallery.root.locator(
			`picture:has(img[data-id="${sized}"])`
		);
		await expect(picture).toHaveCount(1);
		const srcset = await picture.locator('img').getAttribute('srcset');
		expect(srcset).toContain(attachmentMeta(sized).sizes.large.file);
		expect(srcset).toContain(attachmentMeta(sized).sizes.medium.file);
		await expect(picture.locator('source')).toHaveAttribute(
			'srcset',
			srcset ?? ''
		);

		const plain = gallery.root.locator(`img[data-id="${bare}"]`);
		await expect(plain).toHaveCount(1);
		await expect(plain).not.toHaveAttribute('srcset', /./);
		await expect(
			gallery.root.locator(`picture:has(img[data-id="${bare}"])`)
		).toHaveCount(0);
		await expect(plain).toHaveJSProperty('complete', true);

		// The default 400x300 crop has no other 4:3 size to offer.
		const cropped = galleryPage({ layout: 'grid' }, [sized]);
		const croppedGallery = new GalleryRender(page, cropped.id);
		await page.goto(cropped.url);
		await croppedGallery.waitFor();
		await expect(
			croppedGallery.root.locator(`img[data-id="${sized}"]`)
		).not.toHaveAttribute('srcset', /./);
		await expect(croppedGallery.root.locator('picture')).toHaveCount(0);
	}
);

/**
 * MED-11. Embedded videos have no attachment, so their posters carry no srcset
 * or sizes and are never wrapped in `<picture>`, while an image beside them is. Read from the server's HTML,
 * so the remote posters are never fetched.
 */
test(
	'MED-11: embed items carry no srcset or sizes',
	{ tag: '@layout' },
	async ({ page, request }) => {
		const image = fixture<number[]>('F-mixed', 'images')[0];
		const embeds = [
			fixture<number>('F-mixed', 'youtube'),
			fixture<number>('F-mixed', 'vimeo'),
		];
		const { id, url } = galleryPage(
			{ layout: 'grid', thumbnail_size: 'large' },
			[image, ...embeds]
		);

		const html = await (await request.get(url)).text();
		const found = await page.evaluate(
			([markup, galleryId]) => {
				const doc = new DOMParser().parseFromString(
					markup as string,
					'text/html'
				);
				const root = doc.querySelector(
					`[data-fg-gallery-id="${galleryId}"]`
				);
				const posters = Array.from(
					root?.querySelectorAll('img.fg-video-poster') ?? []
				);
				return {
					posters: posters.length,
					withSrcset: posters.filter(
						(img) =>
							img.hasAttribute('srcset') ||
							img.hasAttribute('sizes')
					).length,
					inPicture: posters.filter((img) => img.closest('picture'))
						.length,
					imagePictures:
						root?.querySelectorAll(
							'picture img:not(.fg-video-poster)'
						).length ?? 0,
				};
			},
			[html, id]
		);

		// The Vimeo fixture has no thumbnail, so only YouTube has a poster image.
		expect(found).toEqual({
			posters: 1,
			withSrcset: 0,
			inPicture: 0,
			imagePictures: 1,
		});
	}
);

const INFO_PANEL: Settings = {
	layout: 'grid',
	lightbox_variant: 'full',
	lightbox_info_panel_enabled: true,
	lightbox_info_blocks: JSON.stringify([
		'title',
		'credit',
		'exif',
		'file_info',
	]),
	exif_fields: JSON.stringify(['camera', 'aperture', 'iso']),
	display_exif: true,
	lightbox_credit_source: 'xmp',
};

function isItemRequest(url: string): boolean {
	return decodeURIComponent(url).includes('/fotogrids/v1/lightbox/item/');
}

/**
 * MED-14. With XMP Rights as the credit source, the Lightbox credit comes from
 * the XMP packet of the preserved original; WordPress strips it from the
 * `-scaled` copy it serves.
 */
test(
	'MED-14: the XMP credit is read from the original file',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const item = firstItem('F-exif');
		const { id, url } = galleryPage(INFO_PANEL, [item]);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		expect(wpEval(`echo get_attached_file( ${item} );`)).toContain(
			'-scaled'
		);

		await page.goto(url);
		await gallery.waitFor();
		const details = page.waitForResponse((response) =>
			isItemRequest(response.url())
		);
		await lightbox.openFrom(gallery);
		expect((await (await details).json()).credit).toBe(
			fixture<string>('F-exif', 'credit')
		);
		await expect(
			lightbox.dialog().locator('[data-fg-lb-block="credit"]')
		).toContainText(fixture<string>('F-exif', 'credit'));
	}
);

/**
 * MED-15. When the original and its `-scaled` copy are gone from local disk, as
 * after offloading, the gallery and Lightbox still work from the subsizes and
 * the EXIF and credit come back empty rather than failing.
 */
test(
	'MED-15: an offloaded original leaves EXIF and credit empty, not broken',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const item = own(
			cloneAttachment(firstItem('F-exif'), `offloaded-${process.pid}.jpg`)
		);
		wpEval(`
		$scaled = get_attached_file( ${item} );
		$orig   = wp_get_original_image_path( ${item} );
		if ( $scaled === $orig ) { throw new Exception( 'expected a -scaled copy' ); }
		unlink( $scaled );
		unlink( $orig );
	`);

		const { id, url } = galleryPage(INFO_PANEL, [item]);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();
		await expect(
			gallery.root.locator(`img[data-id="${item}"]`)
		).toHaveJSProperty('complete', true);

		const details = page.waitForResponse((response) =>
			isItemRequest(response.url())
		);
		await lightbox.openFrom(gallery);
		const response = await details;
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.credit).toBe('');
		expect(body.exif).toBeNull();
		expect(
			await lightbox
				.image()
				.evaluate((img: HTMLImageElement) => img.naturalWidth)
		).toBeGreaterThan(0);
		await expect(
			lightbox.dialog().locator('[data-fg-lb-block="file_info"]')
		).toBeVisible();
		await expect(
			lightbox.dialog().locator('[data-fg-lb-block="exif"]')
		).toHaveCount(0);
		await expect(
			lightbox.dialog().locator('[data-fg-lb-block="credit"]')
		).toHaveCount(0);
	}
);

/** Every image in the gallery decoded, as loaded files rather than broken ones. */
async function allDecoded(gallery: GalleryRender): Promise<number[]> {
	await expect
		.poll(() =>
			gallery.root
				.locator('img')
				.evaluateAll((imgs) =>
					imgs.every((img) => (img as HTMLImageElement).complete)
				)
		)
		.toBe(true);

	return gallery.root
		.locator('img')
		.evaluateAll((imgs) =>
			imgs.map((img) => (img as HTMLImageElement).naturalWidth)
		);
}

/**
 * MED-16. An 8000x6000 JPEG and a 40MB PNG render from their subsizes, never
 * the original, and open in the Lightbox at the Lightbox size.
 */
test(
	'MED-16: very large uploads render from their subsizes',
	{ tag: '@layout' },
	async ({ page }) => {
		const large = fixture<number>('F-huge', 'large');
		const heavy = fixture<number>('F-huge', 'heavy');
		const { id, url } = galleryPage(
			{ layout: 'grid', lightbox_variant: 'full' },
			[large, heavy]
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();

		for (const item of [large, heavy]) {
			expect(
				basename(
					await gallery.root
						.locator(`img[data-id="${item}"]`)
						.getAttribute('src')
				)
			).toBe(sizeFile(item, 'fotogrids_thumbnail'));
		}
		expect((await allDecoded(gallery)).every((width) => width > 0)).toBe(
			true
		);

		await lightbox.openFrom(gallery);
		expect(basename(await lightbox.currentSrc())).toBe(
			sizeFile(large, 'fotogrids_full')
		);
	}
);

/**
 * MED-17. A PDF in a gallery is shown as a labelled placeholder tile, not a
 * broken image, and the images beside it render as usual.
 */
test(
	'MED-17: a non-image attachment renders as a placeholder',
	{ tag: '@layout' },
	async ({ page }) => {
		const image = fixture<number[]>('F-small', 'items')[0];
		const pdf = own(
			Number(
				wpEval(`
				$up = wp_upload_bits( 'fg-e2e-${process.pid}.pdf', null, "%PDF-1.4\\n%%EOF\\n" );
				echo wp_insert_attachment( array( 'post_mime_type' => 'application/pdf', 'post_title' => 'A PDF item', 'post_status' => 'inherit' ), $up['file'] );
			`).trim()
			)
		);
		const { id, url } = galleryPage({ layout: 'grid' }, [image, pdf]);
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.items()).toHaveCount(2);
		await expect(
			gallery.root.locator(
				'.fg-item-placeholder[role="img"][aria-label="A PDF item"]'
			)
		).toHaveCount(1);
		await expect(gallery.root.locator('img')).toHaveCount(1);
		expect(await allDecoded(gallery)).toEqual([expect.any(Number)]);
		expect((await allDecoded(gallery))[0]).toBeGreaterThan(0);
	}
);

/**
 * MED-18. Filenames with spaces, non-Latin scripts and an uppercase extension
 * render, and every srcset candidate WordPress built for them resolves.
 */
test(
	'MED-18: odd filenames render and their srcset candidates resolve',
	{ tag: '@layout' },
	async ({ page, request }) => {
		const upper = own(
			cloneAttachment(
				firstItem('F-single'),
				`Upper Case ${process.pid}.JPG`
			)
		);
		const items = [...fixture<number[]>('F-cjk', 'items'), upper];
		const { id, url } = galleryPage(
			{ layout: 'grid', lightbox_variant: 'full' },
			items
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		expect(basename(attachmentMeta(upper).file)).toMatch(/\.JPG$/);

		await page.goto(url);
		await gallery.waitFor();
		const widths = await allDecoded(gallery);
		expect(widths).toHaveLength(items.length);
		expect(widths.every((width) => width > 0)).toBe(true);

		const candidates = (
			await gallery.root
				.locator('img[srcset]')
				.evaluateAll((imgs) =>
					imgs.flatMap((img) =>
						(img.getAttribute('srcset') ?? '')
							.split(',')
							.map((c) => c.trim().split(' ')[0])
					)
				)
		).filter(Boolean);
		expect(candidates.length).toBeGreaterThan(items.length);
		for (const candidate of candidates) {
			expect((await request.get(candidate)).status(), candidate).toBe(
				200
			);
		}

		await lightbox.openFrom(gallery, items.length - 1);
		expect(
			await lightbox
				.image()
				.evaluate((img: HTMLImageElement) => img.naturalWidth)
		).toBeGreaterThan(0);
	}
);

test.describe('MED-19', () => {
	test.use({ storageState: storageStateFor('administrator') });

	/**
	 * MED-19. The Item Edit modal's Media tab badges each size by what is on
	 * disk: a deleted file, a size never generated, a source too small for it.
	 */
	test(
		'MED-19: the Media tab badges missing, ungenerated and too-small sizes',
		{ tag: '@admin' },
		async ({ page }) => {
			// F-single is 1200x800: too small for fotogrids_full and the 1536/2048 sizes.
			const item = own(
				cloneAttachment(
					firstItem('F-single'),
					`media-tab-${process.pid}.jpg`
				)
			);
			wpEval(`
			$m = wp_get_attachment_metadata( ${item} );
			unlink( trailingslashit( dirname( get_attached_file( ${item} ) ) ) . $m['sizes']['fotogrids_masonry']['file'] );
			unset( $m['sizes']['medium'] );
			wp_update_attachment_metadata( ${item}, $m );
		`);
			const { id } = galleryPage({}, [item]);
			const editor = new GalleryEditor(page);

			const generated = Number(
				wpEval(`
				$m = wp_get_attachment_metadata( ${item} );
				$dir = trailingslashit( dirname( get_attached_file( ${item} ) ) );
				echo 1 + count( array_filter( $m['sizes'], fn( $s ) => file_exists( $dir . $s['file'] ) ) );
			`)
			);

			await editor.open(id);
			await editor.item(item).hover();
			await editor.editItem(item).click();
			await expect(page.locator('#fotogrids-item-title')).toBeVisible();
			await page
				.locator('.fg-modal')
				.getByRole('tab', { name: 'Media' })
				.click();

			const size = (slug: string) =>
				page.locator('.fotogrids-item-edit-media-size', {
					has: page.locator('code', {
						hasText: new RegExp(`^${slug}$`),
					}),
				});

			await expect(
				size('fotogrids_masonry').locator(
					'.fotogrids-item-edit-media-size__badge'
				)
			).toHaveText('File missing');
			await expect(
				size('medium').locator('.fotogrids-item-edit-media-size__badge')
			).toHaveText('Not generated');
			await expect(
				size('fotogrids_full').locator(
					'.fotogrids-item-edit-media-size__badge'
				)
			).toHaveText('Source too small');
			await expect(
				size('fotogrids_thumbnail').locator(
					'.fotogrids-item-edit-media-size__badge'
				)
			).toHaveCount(0);

			// The original plus every subsize whose file is on disk; at 1200x800,
			// masonry and justified share one file, so both lost it.
			await expect(
				size('fotogrids_justified').locator(
					'.fotogrids-item-edit-media-size__badge'
				)
			).toHaveText('File missing');
			// The total follows the modal's own rows, since other specs may
			// register a size meanwhile.
			const total = await page
				.locator('.fotogrids-item-edit-media-size')
				.count();
			await expect(
				page.locator('.fotogrids-item-edit-media-sizes__summary')
			).toHaveText(`${generated} of ${total} sizes available`);
		}
	);
});
