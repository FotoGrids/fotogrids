import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { copyItems, deleteItems } from './support/item-copies';

/**
 * What an item does when it is clicked or hovered: image zoom, the four click
 * behaviours, and the sequence index the client navigates by.
 *
 * scoped: each test renders galleries it created; the item copies it links are
 * its own and are deleted afterwards.
 */

/** F-mixed's two images and its uploaded video. */
function mixed(): { images: number[]; video: number } {
	return {
		images: fixture<number[]>('F-mixed', 'images'),
		video: fixture<number>('F-mixed', 'video'),
	};
}

/** DEC-11: inline zoom marks only image items and paints a lens on hover. */
test(
	'DEC-11: inline zoom gives each image its full-size source and shows a lens on hover',
	{ tag: '@visual' },
	async ({ page }) => {
		const { images, video } = mixed();
		const { id, url } = galleryPage(
			{
				layout: 'grid',
				item_click_behavior: 'nothing',
				interactions_zoom: true,
				interactions_zoom_style: 'inline',
			},
			[...images, video]
		);
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute(
			'data-fg-zoom-style',
			'inline'
		);
		expect(await gallery.attr('zoom-mode')).toBeNull();
		await expect(page.locator('#fotogrids-lightbox-mini-css')).toHaveCount(
			0
		);

		const items = gallery.items();
		await expect(items).toHaveCount(3);
		for (const index of [0, 1]) {
			const full = await items
				.nth(index)
				.locator('.fg-item-media img')
				.getAttribute('data-fg-full-src');
			expect(full).toBeTruthy();
			await expect(items.nth(index)).toHaveAttribute(
				'data-fg-zoom-full',
				full as string
			);
		}
		await expect(items.nth(2).locator('.fg-video, video')).not.toHaveCount(
			0
		);
		expect(await items.nth(2).getAttribute('data-fg-zoom-full')).toBeNull();

		const media = items.first().locator('.fg-item-media');
		await media.hover();
		await page.mouse.move(5, 5);
		await media.hover();
		await expect(media.locator('.fg-zoom-lens.is-active')).toBeVisible();
	}
);

/** DEC-12: popover zoom loads the mini overlay and opens it on click. */
test(
	'DEC-12: popover zoom on click loads the mini overlay and opens the full image in it',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'nothing',
			interactions_zoom: true,
			interactions_zoom_style: 'popover',
			interactions_zoom_mode: 'click',
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute(
			'data-fg-zoom-style',
			'popover'
		);
		await expect(gallery.root).toHaveAttribute(
			'data-fg-zoom-mode',
			'click'
		);
		await expect(page.locator('#fotogrids-lightbox-mini-css')).toHaveCount(
			1
		);
		await expect(page.locator('#fotogrids-lightbox-mini-js')).toHaveCount(
			1
		);

		const item = gallery.items().nth(1);
		const full = await item.getAttribute('data-fg-zoom-full');
		await item.locator('.fg-item-media').click();

		const overlay = page.locator('.fg-lb-mini');
		await expect(overlay).toBeVisible();
		await expect(overlay.locator('img')).toHaveAttribute(
			'src',
			full as string
		);
	}
);

/** DEC-12: hover mode opens the popover after the configured delay. */
test(
	'DEC-12: popover zoom on hover opens after the configured delay',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'nothing',
			interactions_zoom: true,
			interactions_zoom_style: 'popover',
			interactions_zoom_mode: 'hover',
			interactions_zoom_hover_delay: 1500,
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute(
			'data-fg-zoom-mode',
			'hover'
		);
		expect(await gallery.cssVar('zoom-hover-delay')).toBe('1500ms');

		const overlay = page.locator('.fg-lb-mini');
		await gallery.items().first().locator('.fg-item-media').hover();
		await page.waitForTimeout(700);
		await expect(overlay).toHaveCount(0);
		await expect(overlay).toBeVisible({ timeout: 5000 });
	}
);

/** DEC-14: a direct link wraps the whole figure, caption included. */
test(
	'DEC-14: Direct to image wraps media and caption in one link to the full image',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'direct',
			caption_placement: 'bottom',
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute('data-fg-click', 'direct');
		const item = gallery.items().first();
		const link = item.locator(':scope > a[data-fg-direct]');
		await expect(link).toHaveCount(1);
		await expect(link.locator('.fg-item-media')).toHaveCount(1);
		await expect(link.locator('figcaption')).toHaveCount(1);

		const full = await item
			.locator('.fg-item-media img')
			.getAttribute('data-fg-full-src');
		await expect(link).toHaveAttribute('href', full as string);

		await item.locator('.fg-caption-title').click();
		await page.waitForURL(full as string);
	}
);

/**
 * DEC-15: the lightbox trigger wraps only the media; the caption sits beside
 * it, and a click on it still opens the lightbox on that item.
 */
test(
	'DEC-15: the lightbox trigger wraps the media only, and the caption still opens the lightbox',
	{ tag: ['@visual', '@lightbox'] },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'lightbox',
			caption_placement: 'bottom',
			lightbox_show_dots: true,
		});
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();

		const item = gallery.items().nth(2);
		const trigger = item.locator(':scope > a[data-fg-lightbox-trigger]');
		await expect(trigger).toHaveCount(1);
		await expect(trigger.locator('.fg-item-media')).toHaveCount(1);
		await expect(trigger.locator('figcaption')).toHaveCount(0);
		await expect(item.locator(':scope > figcaption')).toHaveCount(1);

		await item.locator('.fg-caption-title').click();
		await expect(lightbox.dialog()).toBeVisible();
		expect(await lightbox.index()).toBe(2);
	}
);

test.describe('external links', () => {
	let copies: number[] = [];

	test.beforeAll(() => {
		copies = copyItems(fixture<number[]>('F-small', 'items')[0], [
			{
				title: 'Global',
				meta: {
					external_url: 'https://example.com/global',
					link_target: 'global',
				},
			},
			{ title: 'No link' },
			{
				title: 'Blank',
				meta: {
					external_url: 'https://example.com/blank',
					link_target: '_blank',
				},
			},
			{
				title: 'Self',
				meta: {
					external_url: 'https://example.com/self',
					link_target: '_self',
				},
			},
		]);
	});

	test.afterAll(() => deleteItems(copies));

	/** One item's external anchor, or null when it is unwrapped. */
	async function anchorOf(gallery: GalleryRender, index: number) {
		const link = gallery.items().nth(index).locator(':scope > a');
		if (0 === (await link.count())) {
			return null;
		}

		return {
			href: await link.getAttribute('href'),
			target: await link.getAttribute('target'),
			rel: await link.getAttribute('rel'),
			external: await link.getAttribute('data-fg-external'),
		};
	}

	/** DEC-16: only items that have an external URL become links. */
	test(
		'DEC-16: External link wraps items that have a URL and leaves the rest unwrapped',
		{ tag: '@visual' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{ layout: 'grid', item_click_behavior: 'external' },
				copies
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			await expect(gallery.root).toHaveAttribute(
				'data-fg-click',
				'external'
			);
			expect(await anchorOf(gallery, 0)).toMatchObject({
				href: 'https://example.com/global',
				external: '',
			});
			expect(await anchorOf(gallery, 1)).toBeNull();
			await expect(gallery.items().nth(1).locator('a')).toHaveCount(0);
			expect((await anchorOf(gallery, 2))?.href).toBe(
				'https://example.com/blank'
			);
			expect((await anchorOf(gallery, 3))?.href).toBe(
				'https://example.com/self'
			);
		}
	);

	/**
	 * DEC-17: an item's own target wins; `global` follows the gallery's, and a
	 * new tab always gets noopener noreferrer.
	 */
	test(
		'DEC-17: the link target follows the item, then the gallery, and a new tab is noopener',
		{ tag: '@visual' },
		async ({ page }) => {
			const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' };
			const SAME_TAB = { target: '_self', rel: null };

			for (const [gallerySetting, globalItem] of [
				[undefined, SAME_TAB],
				['_self', SAME_TAB],
				['_blank', NEW_TAB],
			] as const) {
				const { id, url } = galleryPage(
					{
						layout: 'grid',
						item_click_behavior: 'external',
						...(gallerySetting
							? { external_link_target: gallerySetting }
							: {}),
					},
					copies
				);
				const gallery = new GalleryRender(page, id);
				const label = `gallery target ${gallerySetting ?? 'unset'}`;

				await page.goto(url);
				await gallery.waitFor();

				expect(await anchorOf(gallery, 0), label).toMatchObject(
					globalItem
				);
				expect(await anchorOf(gallery, 2), label).toMatchObject(
					NEW_TAB
				);
				expect(await anchorOf(gallery, 3), label).toMatchObject(
					SAME_TAB
				);
			}
		}
	);
});

/** DEC-18: with no click behaviour, no item is a link or a lightbox trigger. */
test(
	'DEC-18: Nothing leaves every item unwrapped and the lightbox off',
	{ tag: ['@visual', '@lightbox'] },
	async ({ page }) => {
		const { images, video } = mixed();
		const { id, url } = galleryPage(
			{ layout: 'grid', item_click_behavior: 'nothing' },
			[...images, video]
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.items()).toHaveCount(3);
		await expect(gallery.root.locator('.fg-item a')).toHaveCount(0);
		await expect(gallery.triggers()).toHaveCount(0);
		expect(await gallery.attr('lightbox-variant')).toBeNull();

		await gallery.items().first().click();
		await page.waitForTimeout(500);
		await expect(lightbox.dialog()).toHaveCount(0);
	}
);

/**
 * DEC-19: every item carries its place in the whole gallery, so the second
 * page continues from the first instead of restarting at 0.
 */
test(
	'DEC-19: each grid item carries its index in the full order, across Load More pages',
	{ tag: '@layout' },
	async ({ page }) => {
		const large = fixture<number[]>('F-large', 'items');
		// A manual order unlike the upload order.
		const order = [...large.slice(0, 24)].reverse();
		const { id, url } = galleryPage(
			{
				layout: 'grid',
				pagination_type: 'paginated',
				pagination_method: 'load_more',
				items_per_page: { desktop: 10, tablet: 10, mobile: 10 },
			},
			order
		);
		const gallery = new GalleryRender(page, id);

		const stamped = () =>
			gallery
				.items()
				.evaluateAll((figures) =>
					figures.map((figure) => [
						Number(figure.getAttribute('data-fg-sequence-index')),
						Number(
							figure
								.querySelector('[data-fg-item-id]')
								?.getAttribute('data-fg-item-id')
						),
					])
				);
		const expected = (count: number) =>
			order.slice(0, count).map((item, index) => [index, item]);

		await page.goto(url);
		await gallery.waitFor();
		await expect(gallery.items()).toHaveCount(10);
		expect(await stamped()).toEqual(expected(10));

		await page.locator('[data-fg-pagination-trigger="load-more"]').click();
		await expect(gallery.items()).toHaveCount(20);
		expect(await stamped()).toEqual(expected(20));
	}
);
