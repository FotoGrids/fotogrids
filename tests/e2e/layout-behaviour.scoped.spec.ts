import { test, expect } from './support/test';
import {
	galleryPage,
	multiGalleryPage,
	setSettings,
} from './support/collections';
import { fixture, twelveItems } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';

/**
 * The four layouts that do something of their own with the item list: Single
 * Item shows one, Featured Item shows one plus a grid, Instant Photos tilts
 * each tile, and two embeds on one page must not read each other's variables.
 *
 * scoped: each test renders its own galleries and reads them.
 */

const FIVE = fixture<number[]>('F-small', 'items');

/**
 * LAY-04. Single Item renders one item, chosen by the sorter. The count the
 * gallery actually holds survives the slice: the lightbox spans the whole
 * gallery, and it is told how many items to expect.
 */
test.describe('Single Item', () => {
	test(
		'LAY-04: renders one item out of a gallery of five',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage({ layout: 'single-item' }, FIVE);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			await expect(gallery.items()).toHaveCount(1);

			// Without Animate Images there is nothing for JS to cycle, so the
			// track is not offered as a root for it.
			await expect(
				gallery.root.locator('.fg-single-item-track')
			).toHaveCount(1);
			expect(
				await gallery.root
					.locator('.fg-single-item-track')
					.getAttribute('data-fg-items-root')
			).toBeNull();
		}
	);

	test(
		'LAY-04: the lightbox is told the pre-slice count',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'single-item',
					item_click_behavior: 'lightbox',
					lightbox_scope: 'gallery',
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			await expect(gallery.items()).toHaveCount(1);
			expect(await gallery.attr('lightbox-extended')).toBe('true');
			expect(await gallery.attr('total-items')).toBe(String(FIVE.length));
		}
	);

	test(
		'LAY-05: Animate Images keeps every item and stamps the timer',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'single-item',
					single_item_auto_progress: true,
					single_item_auto_progress_delay: 3,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			await expect(gallery.items()).toHaveCount(FIVE.length);
			expect(await gallery.attr('si-auto-progress')).toBe('1');
			expect(await gallery.attr('si-delay')).toBe('3');

			// The indicator, its position and hover pausing have no catalog keys
			// yet, so the layout reads them at their defaults. Asserted so adding
			// the controls arrives to a row that already describes the contract.
			expect(await gallery.attr('si-progress-style')).toBe('none');
			expect(await gallery.attr('si-progress-bar-loc')).toBe('bottom');
			expect(await gallery.attr('si-pause-on-hover')).toBe('0');

			// The deck hands JS every item hidden and the stage then owns
			// visibility through `fg-is-active`, so exactly one is active and the
			// hidden class is gone from all of them.
			await expect(
				gallery.root.locator('.fg-item.fg-is-active')
			).toHaveCount(1);
			await expect(
				gallery.root.locator('.fg-item.fg-item-hidden')
			).toHaveCount(0);
		}
	);

	test(
		'LAY-05: a delay below one second is raised to one',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'single-item',
					single_item_auto_progress: true,
					single_item_auto_progress_delay: 0,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			expect(await gallery.attr('si-delay')).toBe('1');
		}
	);
});

/**
 * LAY-09, LAY-10 and LAY-12. Featured Item shows one large image plus a grid of
 * N, where N is one of three allowed counts that also decide the grid's shape.
 */
test.describe('Featured Item', () => {
	const SHAPES = [
		{ count: 4, cols: '2', rows: '2' },
		{ count: 6, cols: '3', rows: '2' },
		{ count: 9, cols: '3', rows: '3' },
	] as const;

	for (const { count, cols, rows } of SHAPES) {
		test(
			`LAY-09: a thumb count of ${count} makes a ${cols}x${rows} grid`,
			{
				tag: '@layout',
			},
			async ({ page }) => {
				const items = twelveItems();
				const { id, url } = galleryPage(
					{ layout: 'featured-item', featured_thumbs_count: count },
					items
				);
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				expect(await gallery.attr('featured-thumbs-count')).toBe(
					String(count)
				);
				expect(await gallery.cssVar('featured-grid-cols')).toBe(cols);
				expect(await gallery.cssVar('featured-grid-rows')).toBe(rows);

				// The featured image is rendered outside the grid, so the grid
				// holds the next N in order.
				await expect(
					gallery.root.locator('.fg-featured-grid .fg-item')
				).toHaveCount(count);
				await expect(
					gallery.root.locator('.fg-featured-main .fg-item')
				).toHaveCount(1);
			}
		);
	}

	test(
		'LAY-09: a count nothing allows falls back to six',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{ layout: 'featured-item', featured_thumbs_count: 7 },
				twelveItems()
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			expect(await gallery.attr('featured-thumbs-count')).toBe('6');
			await expect(
				gallery.root.locator('.fg-featured-grid .fg-item')
			).toHaveCount(6);
		}
	);

	/**
	 * LAY-10. "Show all" appears only when the gallery holds more than the
	 * featured image plus its grid, so five items with a grid of four is the
	 * boundary: exactly inline, and no button.
	 */
	test(
		'LAY-10: no Show all at exactly one plus the grid count',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{ layout: 'featured-item', featured_thumbs_count: 4 },
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			await expect(
				gallery.root.locator('.fg-featured-grid .fg-item')
			).toHaveCount(4);
			await expect(
				gallery.root.locator('[data-fg-show-all]')
			).toHaveCount(0);
		}
	);

	test(
		'LAY-10: one item past the boundary brings it back',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = twelveItems().slice(0, 6);
			const { id, url } = galleryPage(
				{ layout: 'featured-item', featured_thumbs_count: 4 },
				items
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			await expect(
				gallery.root.locator('[data-fg-show-all]')
			).toHaveCount(1);
		}
	);

	/**
	 * LAY-12. Every other layout stamps the lightbox-extended markers only when
	 * `lightbox_scope` is the whole gallery. Featured Item renders a fraction of
	 * the gallery inline whatever the scope says, so its lightbox always spans
	 * the lot and the markers go on regardless.
	 */
	for (const scope of ['gallery', 'item']) {
		test(
			`LAY-12: the lightbox spans the gallery with scope "${scope}"`,
			{
				tag: '@layout',
			},
			async ({ page }) => {
				const items = twelveItems();
				const { id, url } = galleryPage(
					{
						layout: 'featured-item',
						featured_thumbs_count: 4,
						item_click_behavior: 'lightbox',
						lightbox_scope: scope,
					},
					items
				);
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				expect(await gallery.attr('lightbox-extended')).toBe('true');
				expect(await gallery.attr('total-items')).toBe(
					String(items.length)
				);
			}
		);

		test(
			`LAY-12: grid renders no such markers with scope "${scope}"`,
			{
				tag: '@layout',
			},
			async ({ page }) => {
				const items = twelveItems();
				const { id, url } = galleryPage(
					{
						layout: 'grid',
						item_click_behavior: 'lightbox',
						lightbox_scope: scope,
					},
					items
				);
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				// Grid shows every item inline, so there is nothing to fetch -
				// except with scope=gallery, where pagination may still extend it.
				if ('item' === scope) {
					expect(await gallery.attr('lightbox-extended')).toBeNull();
				}
			}
		);
	}
});

/**
 * LAY-13 and LAY-14. Instant Photos tilts each tile by an angle seeded from the
 * gallery and the item, so the same tile lands at the same angle on every
 * render. A baseline would catch a change of angle; only two loads catch an
 * angle that is not stable.
 */
test.describe('Instant Photos', () => {
	async function rotations(
		page: import('@playwright/test').Page,
		id: number
	) {
		const gallery = new GalleryRender(page, id);
		await gallery.waitFor();

		return gallery
			.items()
			.evaluateAll((items) =>
				items.map((item) =>
					getComputedStyle(item)
						.getPropertyValue('--fg-rotation')
						.trim()
				)
			);
	}

	test(
		'LAY-13: the same gallery tilts the same way twice',
		{ tag: '@layout' },
		async ({ page }) => {
			// The cache is off on purpose: keyed on the gallery, it would replay the
			// first render's HTML and this row would pass on a seed that is not
			// stable at all.
			const { id, url } = galleryPage(
				{
					layout: 'instant-photos',
					instant_photo_max_rotation: {
						desktop: 12,
						tablet: 12,
						mobile: 12,
					},
					enable_cache: false,
				},
				FIVE
			);

			await page.goto(url);
			const first = await rotations(page, id);

			await page.goto(url);
			const second = await rotations(page, id);

			expect(first).toHaveLength(FIVE.length);
			expect(second).toEqual(first);

			// A seed that produced one angle for every tile would be stable and
			// useless, so the row also needs the angles to differ.
			expect(
				new Set(first).size,
				'every tile got the same angle'
			).toBeGreaterThan(1);
		}
	);

	test(
		'LAY-13: a maximum rotation of zero leaves every tile straight',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'instant-photos',
					instant_photo_max_rotation: {
						desktop: 0,
						tablet: 0,
						mobile: 0,
					},
				},
				FIVE
			);

			await page.goto(url);

			expect(await rotations(page, id)).toEqual(
				Array(FIVE.length).fill('0deg')
			);
		}
	);

	test(
		'LAY-14: the sticker is only offered when the tile is not elevated',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'instant-photos',
					instant_photo_elevation: true,
					instant_photo_sticker: true,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			await expect(
				gallery.root.locator('.fg-instant-photo--elevated')
			).toHaveCount(FIVE.length);
			await expect(
				gallery.root.locator('.fg-instant-photo--stickered'),
				'elevation and the sticker both applied'
			).toHaveCount(0);

			setSettings(id, {
				layout: 'instant-photos',
				instant_photo_elevation: false,
				instant_photo_sticker: true,
			});

			await page.goto(url);
			await gallery.waitFor();

			await expect(
				gallery.root.locator('.fg-instant-photo--elevated')
			).toHaveCount(0);
			await expect(
				gallery.root.locator('.fg-instant-photo--stickered')
			).toHaveCount(FIVE.length);
		}
	);
});

/**
 * LAY-22 and LAY-23. Instance ids come from a request-scoped counter, so two
 * embeds on one page are distinct even when they are the same gallery. The
 * reason it matters is the style variables: they are written per instance, and
 * one embed reading the other's column count is the failure this catches.
 */
test.describe('two embeds on one page', () => {
	test(
		'LAY-22: two galleries keep their own instance and their own columns',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const three = galleryPage({
				layout: 'grid',
				columns: { desktop: 3, tablet: 3, mobile: 1 },
			});
			const one = galleryPage({
				layout: 'grid',
				columns: { desktop: 1, tablet: 1, mobile: 1 },
			});
			const { url } = multiGalleryPage([three.id, one.id]);

			await page.setViewportSize({ width: 1280, height: 900 });
			await page.goto(url);

			const first = new GalleryRender(page, three.id);
			const second = new GalleryRender(page, one.id);
			await first.waitFor();
			await second.waitFor();

			const ids = [
				await first.root.getAttribute('id'),
				await second.root.getAttribute('id'),
			];
			expect(ids[0]).toMatch(new RegExp(`^fg-${three.id}-\\d+$`));
			expect(ids[1]).toMatch(new RegExp(`^fg-${one.id}-\\d+$`));
			expect(ids[0]).not.toBe(ids[1]);

			expect(await first.cssVar('cols')).toBe('3');
			expect(await second.cssVar('cols')).toBe('1');
		}
	);

	/**
	 * LAY-23. The counter is per request, not per gallery, so a second embed of
	 * the same gallery is a second instance. The cache is left off here: it is
	 * keyed on the gallery and its settings, so with it on the second embed
	 * replays the first's HTML, instance id included.
	 */
	test(
		'LAY-23: the same gallery twice gets two instances',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id } = galleryPage({ layout: 'grid', enable_cache: false });
			const { url } = multiGalleryPage([id, id]);

			await page.goto(url);

			const wrappers = page.locator(`[data-fg-gallery-id="${id}"]`);
			await expect(wrappers).toHaveCount(2);

			const ids = await wrappers.evaluateAll((nodes) =>
				nodes.map((node) => node.id)
			);
			expect(new Set(ids).size, 'both embeds answer to the same id').toBe(
				2
			);
			for (const instance of ids) {
				expect(instance).toMatch(new RegExp(`^fg-${id}-\\d+$`));
			}

			// Both are real renders, not one render and an empty shell.
			expect(await wrappers.nth(0).locator('.fg-item').count()).toBe(
				await wrappers.nth(1).locator('.fg-item').count()
			);
		}
	);
});
