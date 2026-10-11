import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';

/**
 * LAY-11. A gallery still listing attachments that are no longer in the Media
 * Library.
 *
 * The shortcode short-circuits a gallery with no item ids at all, so the
 * layouts' own empty-list guards are only reachable this way: the ids are
 * there, and nothing loads behind them. It is also what a site looks like after
 * someone clears images out of the Media Library, so what matters is that the
 * page survives.
 *
 * Ids that were never attachments reach the same state as deleted ones without
 * taking a real attachment away from the rest of the suite.
 *
 * scoped: each test renders its own gallery.
 */

const GONE = [999_901, 999_902, 999_903];

const LAYOUTS = [
	'grid',
	'masonry',
	'justified',
	'instant-photos',
	'slider',
	'image-viewer',
	'single-item',
	'featured-item',
] as const;

for (const layout of LAYOUTS) {
	test(
		`LAY-11: ${layout} renders an empty gallery, not a broken page`,
		{
			tag: '@layout',
		},
		async ({ page }) => {
			// The cache is keyed on the gallery and its items, so it is left off to
			// keep the row reading this render rather than a replay.
			const { id, url } = galleryPage(
				{ layout, enable_cache: false },
				GONE
			);

			const response = await page.goto(url);
			expect(response?.status()).toBe(200);

			const gallery = new GalleryRender(page, id);
			await expect(
				gallery.root,
				'the wrapper went with the items'
			).toBeAttached();
			expect(await gallery.layout()).toBe(layout);
			await expect(gallery.items()).toHaveCount(0);

			// An empty render, not an error: the visitor is told nothing, and the
			// rest of the page is unaffected.
			await expect(page.locator('.fotogrids-error')).toHaveCount(0);
		}
	);
}
