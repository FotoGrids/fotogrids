import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';
import type { Locator, Page } from '@playwright/test';

/**
 * What an album takes from its own settings: the cover each tile shows, the
 * styling it shares with galleries, its view count, and the render cache it
 * does not use.
 *
 * scoped: each test makes its own galleries and albums.
 */

const five = (): number[] => fixture<number[]>('F-small', 'items');

const TILE = '.fg-item img';

function albumEl(page: Page, id: number) {
	return page.locator(`[data-fg-album-id="${id}"]`);
}

/** The attachment's file name, which every size of it carries in its URL. */
function stem(attachmentId: number): string {
	return wpEval(
		`echo pathinfo( get_attached_file( ${attachmentId} ), PATHINFO_FILENAME );`
	).trim();
}

function setMeta(postId: number, key: string, value: number): void {
	wpEval(`update_post_meta( ${postId}, '${key}', ${value} );`);
}

/**
 * ALB-03. Each tile's cover is the gallery's Featured / Share image if it has
 * one, otherwise its post thumbnail while that is still one of its items,
 * otherwise its first item. Albums are rendered fresh on every request, so
 * each step reads the change straight away.
 */
test.describe('the cover a tile shows', () => {
	test(
		'ALB-03: the first item, then the post thumbnail, then the Featured image',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const [first, second, third] = five();
			const gallery = galleryPage({ layout: 'grid' }, [first, second]).id;
			const { id, url } = album([gallery]);
			const cover = albumEl(page, id).locator(TILE);

			await page.goto(url);
			await expect(cover).toHaveAttribute('src', new RegExp(stem(first)));

			setMeta(gallery, '_thumbnail_id', second);
			await page.goto(url);
			await expect(
				cover,
				'the post thumbnail was passed over'
			).toHaveAttribute('src', new RegExp(stem(second)));

			// The Featured image need not be one of the gallery's items.
			setMeta(gallery, 'fotogrids_featured_image_id', third);
			await page.goto(url);
			await expect(
				cover,
				'the Featured image was passed over'
			).toHaveAttribute('src', new RegExp(stem(third)));
		}
	);

	test(
		'ALB-03: a post thumbnail that is no longer an item is passed over',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const [first, second, removed] = five();
			const gallery = galleryPage({ layout: 'grid' }, [first, second]).id;
			setMeta(gallery, '_thumbnail_id', removed);
			const { id, url } = album([gallery]);

			await page.goto(url);
			await expect(albumEl(page, id).locator(TILE)).toHaveAttribute(
				'src',
				new RegExp(stem(first))
			);
		}
	);
});

/**
 * ALB-14. The same settings on a gallery and on an album. The album keeps the
 * styling a tile shares with an item and leaves out the modules that only make
 * sense for a gallery's items. The gallery is the control: it shows both of
 * those modules are on.
 */
test.describe('settings an album shares with a gallery', () => {
	const SETTINGS = {
		layout: 'grid',
		border_enabled: true,
		border_width: { desktop: 4, tablet: 4, mobile: 4 },
		border_color: '#ff0000',
		item_spacing: { desktop: 28, tablet: 28, mobile: 28 },
		caption_placement: 'overlay',
		caption_visibility: 'always',
		item_click_behavior: 'lightbox',
		interactions_zoom: true,
	};

	test(
		'ALB-14: the border, spacing and captions apply to the tiles',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const gallery = galleryPage(
				{ layout: 'grid' },
				five().slice(0, 2)
			).id;
			wpEval(
				`wp_update_post( array( 'ID' => ${gallery}, 'post_title' => 'Harbour at dusk' ) );`
			);
			const { id, url } = album([gallery], SETTINGS);

			await page.goto(url);

			const root = albumEl(page, id);
			const tile = root.locator('.fg-item').first();

			await expect(root).toHaveAttribute('data-fg-border', 'solid');
			await expect(root).toHaveAttribute('data-fg-caption', 'overlay');

			const vars = await root.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					gap: style.getPropertyValue('--fg-gap').trim(),
					width: style.getPropertyValue('--fg-border-w').trim(),
					color: style.getPropertyValue('--fg-border-color').trim(),
				};
			});
			expect(vars).toEqual({
				gap: '28px',
				width: '4px',
				color: '#ff0000',
			});

			// The caption is the gallery's title.
			await expect(tile.locator('.fg-caption-title')).toHaveText(
				'Harbour at dusk'
			);
		}
	);

	test(
		'ALB-14: the lightbox and the image zoom stay off the tiles',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const items = five().slice(0, 3);
			const control = galleryPage(SETTINGS, items);
			const { id, url } = album(
				[galleryPage({ layout: 'grid' }, items).id],
				SETTINGS
			);

			const GALLERY_ONLY = [
				'[data-fg-lightbox-variant]',
				'[data-fg-zoom-style]',
			];

			/** The wrapper itself, or anything inside it, matching a selector. */
			const carrying = (root: Locator, selector: string) =>
				Promise.all([
					root.and(page.locator(selector)).count(),
					root.locator(selector).count(),
				]).then(([self, inside]) => self + inside);

			await page.goto(control.url);
			const gallery = new GalleryRender(page, control.id).root;
			for (const selector of GALLERY_ONLY) {
				expect(
					await carrying(gallery, selector),
					`the control gallery has no ${selector}`
				).toBeGreaterThan(0);
			}

			await page.goto(url);
			const root = albumEl(page, id);
			await expect(root.locator('.fg-item')).toHaveCount(1);
			for (const selector of GALLERY_ONLY) {
				expect(
					await carrying(root, selector),
					`the album carries ${selector}`
				).toBe(0);
			}
		}
	);
});

/**
 * ALB-15. An album's wrapper reports its view under its own id. Its gallery id
 * is the 0 the runtime reads as "none", so a ping keyed on that would record
 * nothing.
 */
test(
	'ALB-15: an album view is counted against the album',
	{
		tag: '@layout',
	},
	async ({ page }) => {
		const { id, url } = album([
			galleryPage({ layout: 'grid' }, five().slice(0, 2)).id,
		]);

		const ping = page.waitForRequest(
			(request) =>
				request.method() === 'POST' &&
				request.url().includes('stats/view') &&
				(request.postDataJSON() ?? {}).object_type === 'album'
		);

		await page.goto(url);

		const request = await ping;
		expect(request.postDataJSON()).toEqual({
			object_type: 'album',
			object_id: id,
		});

		const response = await request.response();
		expect(response?.status()).toBe(200);

		const views = Number(
			wpEval(
				`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT views FROM {$wpdb->prefix}fotogrids_statistics WHERE object_type = 'album' AND object_id = %d", ${id} ) );`
			).trim()
		);
		expect(views).toBe(1);
	}
);

/**
 * ALB-16. With the cache on, a visitor's gallery render is stored and an
 * album's never is. The gallery is the control; the rename, made straight in
 * the database so no invalidation hook runs, shows the second album visit was
 * rendered fresh.
 */
test(
	'ALB-16: an album is never served from the render cache',
	{
		tag: ['@layout', '@cache'],
	},
	async ({ page }) => {
		const gallery = galleryPage(
			{ layout: 'grid', enable_cache: true },
			five().slice(0, 2)
		);
		const { id, url } = album([gallery.id], { enable_cache: true });

		const rows = (objectId: number) =>
			Number(
				wpEval(
					`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_id = %d", ${objectId} ) );`
				).trim()
			);

		await page.goto(gallery.url);
		expect(rows(gallery.id), 'the control gallery was not cached').toBe(1);

		await page.goto(url);
		const caption = albumEl(page, id).locator('.fg-caption-title');
		await expect(caption).toHaveCount(1);

		wpEval(
			`global $wpdb; $wpdb->update( $wpdb->posts, array( 'post_title' => 'Renamed underneath' ), array( 'ID' => ${gallery.id} ) ); clean_post_cache( ${gallery.id} );`
		);

		await page.goto(url);
		await expect(caption).toHaveText('Renamed underneath');
		expect(rows(id), 'the album render was stored').toBe(0);
	}
);
