import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { firstItem } from './support/fixtures';
import { wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';
import { copyItems, deleteItems } from './support/item-copies';

/**
 * A watermarked gallery serves the watermarked variant of each image it has
 * one for, on every path the render writes an image URL to.
 *
 * serial: turns the site-wide watermark on, and restores it afterwards.
 */

test.describe.configure({ mode: 'serial' });

const OPTIONS = [
	'fotogrids_watermark_settings',
	'fotogrids_watermark_config_hash',
];

let saved = '';
let copy = 0;
let variants: string[] = [];

test.beforeAll(() => {
	saved = wpEval(`
		echo base64_encode( serialize( array(
			get_option( '${OPTIONS[0]}', null ),
			get_option( '${OPTIONS[1]}', null ),
		) ) );
	`).trim();

	// F-exif is large enough to have every Lightbox size of its own.
	copy = copyItems(firstItem('F-exif'), [{ title: 'Watermarked' }])[0];

	variants = JSON.parse(
		wpEval(`
			update_option( 'fotogrids_watermark_settings', array(
				'enable_watermark'   => true,
				'watermark_apply_to' => 'both',
				'watermark_text'     => 'FG watermark test',
			) );
			\\FotoGrids\\Watermark\\Watermark_Generator::generate_for_attachment( ${copy} );
			echo wp_json_encode( array_values( wp_list_pluck(
				\\FotoGrids\\Watermark\\Watermark_Generator::get_variants( ${copy} ),
				'file'
			) ) );
		`).trim()
	);
});

test.afterAll(() => {
	if (copy) {
		wpEval(
			`\\FotoGrids\\Watermark\\Watermark_Generator::delete_for_attachment( ${copy} );`
		);
		deleteItems([copy]);
	}

	wpEval(`
		$previous = unserialize( base64_decode( '${saved}' ) );
		foreach ( array( '${OPTIONS[0]}', '${OPTIONS[1]}' ) as $n => $name ) {
			if ( null === $previous[ $n ] ) {
				delete_option( $name );
			} else {
				update_option( $name, $previous[ $n ] );
			}
		}
	`);
});

/** The file name a URL points at. */
const file = (url: string) => url.split('?')[0].split('/').pop() as string;

/** Every image URL the first item carries, by where it is written. */
function urls(gallery: GalleryRender) {
	return gallery
		.items()
		.first()
		.locator('.fg-item-media img')
		.evaluate((img) => ({
			src: img.getAttribute('src') ?? '',
			thumb: img.getAttribute('data-fg-thumb-src') ?? '',
			full: img.getAttribute('data-fg-full-src') ?? '',
			srcset: (img.getAttribute('srcset') ?? '')
				.split(',')
				.map((candidate) => candidate.trim().split(/\s+/)[0])
				.filter(Boolean),
		}));
}

/**
 * DEC-20: `src`, `data-fg-full-src` and each srcset candidate that has a
 * watermarked variant all point at it; a gallery opted out keeps the clean
 * files.
 */
test(
	'DEC-20: a watermarked gallery writes the watermarked variant to src, full-src and srcset',
	{ tag: '@visual' },
	async ({ page }) => {
		expect(
			variants.length,
			'variants were generated'
		).toBeGreaterThanOrEqual(4);

		for (const layout of ['grid', 'masonry']) {
			const { id, url } = galleryPage({ layout }, [copy]);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();
			const seen = await urls(gallery);

			expect(variants, `${layout} src`).toContain(file(seen.src));
			expect(seen.thumb, layout).toBe(seen.src);
			expect(variants, `${layout} full`).toContain(file(seen.full));

			const marked = seen.srcset.filter((candidate) =>
				variants.includes(file(candidate))
			);
			expect(marked.length, `${layout} srcset`).toBeGreaterThanOrEqual(4);
			for (const candidate of seen.srcset) {
				const wm = file(candidate).replace(/(\.[a-z]+)$/i, '-fgwm$1');
				expect(
					variants.includes(wm),
					`${layout}: ${file(candidate)} has a watermarked variant but is served clean`
				).toBe(false);
			}
		}

		const { id, url } = galleryPage(
			{ layout: 'grid', watermark_apply_to_collection: false },
			[copy]
		);
		const optedOut = new GalleryRender(page, id);
		await page.goto(url);
		await optedOut.waitFor();
		const clean = await urls(optedOut);
		for (const value of [clean.src, clean.full, ...clean.srcset]) {
			expect(variants, 'opted out').not.toContain(file(value));
		}
	}
);
