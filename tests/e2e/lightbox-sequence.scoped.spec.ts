import type { Page, Request } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, multiGalleryPage } from './support/collections';
import { fixture, twelveItems } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * Which items the full lightbox walks through, and in what order: lazy slides
 * on a long gallery, random order, inline video, Single Item scope, two
 * galleries on one page, and the item view it records for each slide.
 *
 * scoped: each test renders galleries it created; item view pings are
 * answered in the browser and never reach the site.
 */

const BASE = {
	layout: 'grid',
	lightbox_variant: 'full',
	lightbox_show_dots: true,
	lightbox_auto_progress: false,
};

/** The lightbox's stage image alt, which F-large numbers. */
function stageAlt(lightbox: Lightbox): Promise<string | null> {
	return lightbox.image().getAttribute('alt');
}

/**
 * LB-10: a long paginated gallery fetches every slide the page lacks, with no
 * range fetched twice and none skipped, so the item past the page boundary
 * and the last item are both reachable.
 */
test(
	'LB-10: a 60-item paginated gallery fetches each missing slide once and reaches every item',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { id, url } = galleryPage(
			{
				...BASE,
				pagination_type: 'paginated',
				pagination_method: 'load_more',
				items_per_page: { desktop: 12, tablet: 12, mobile: 12 },
			},
			fixture<number[]>('F-large', 'items')
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		const ranges: Array<[number, number]> = [];
		page.on('request', (request: Request) => {
			if (request.url().includes('gallery/lightbox/slides')) {
				const body = request.postDataJSON() ?? {};
				ranges.push([Number(body.offset), Number(body.limit)]);
			}
		});

		await page.goto(url);
		await gallery.waitFor();
		await expect(gallery.items()).toHaveCount(12);

		await lightbox.openFrom(gallery, 11);
		await expect.poll(() => ranges.length).toBeGreaterThan(0);
		await page.waitForTimeout(1000);

		const fetched = ranges
			.flatMap(([offset, limit]) =>
				Array.from({ length: limit }, (_, n) => offset + n)
			)
			.sort((a, b) => a - b);
		expect(fetched).toEqual(Array.from({ length: 48 }, (_, n) => 12 + n));

		await lightbox.goNext();
		expect(await lightbox.index()).toBe(12);
		await expect.poll(() => stageAlt(lightbox)).toBe('Item 13 of sixty');

		await page.waitForTimeout(600);
		await page.keyboard.press('End');
		await expect.poll(() => lightbox.index()).toBe(59);
		await expect.poll(() => stageAlt(lightbox)).toBe('Item 60 of sixty');
	}
);

/** The full-size URL of each trigger, in page order. */
function triggerOrder(gallery: GalleryRender): Promise<string[]> {
	return gallery
		.triggers()
		.evaluateAll((links) =>
			links.map((link) => (link as HTMLAnchorElement).href)
		);
}

/** LB-17: in a random gallery the lightbox walks the order the grid shows. */
test(
	'LB-17: a randomly sorted gallery opens the lightbox in the order the grid shows',
	{ tag: '@lightbox' },
	async ({ page }) => {
		for (const mode of ['refetch', 'uncached']) {
			const { id, url } = galleryPage(
				{
					...BASE,
					default_sort_order: 'random',
					random_mode: mode,
				},
				twelveItems()
			);
			const gallery = new GalleryRender(page, id);
			const lightbox = new Lightbox(page);

			await page.goto(url);
			await gallery.waitFor();
			await expect(
				gallery.root.locator('.fg-random-pending')
			).toHaveCount(0);
			await page.waitForTimeout(1000);
			const order = await triggerOrder(gallery);
			expect(order, mode).toHaveLength(12);

			await lightbox.openFrom(gallery, 0);
			for (let index = 0; index < 4; index++) {
				expect(await lightbox.index(), mode).toBe(index);
				await expect(
					lightbox.image(),
					`${mode} #${index}`
				).toHaveAttribute('src', order[index]);
				// A step taken during the crossfade is dropped.
				await page.waitForTimeout(600);
				await lightbox.goNext();
			}
		}
	}
);

/** LB-18: an inline video plays in place; images still open the lightbox. */
test(
	'LB-18: with inline playback, videos carry no lightbox trigger and play in place',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const images = fixture<number[]>('F-mixed', 'images');
		const youtube = fixture<number>('F-mixed', 'youtube');
		const { id, url } = galleryPage(
			{
				...BASE,
				item_click_behavior: 'lightbox',
				video_playback_mode: 'inline',
			},
			[images[0], youtube, images[1]]
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.items()).toHaveCount(3);
		const video = gallery.items().nth(1);
		await expect(video.locator('[data-fg-lightbox-trigger]')).toHaveCount(
			0
		);
		await expect(gallery.triggers()).toHaveCount(2);

		await video.locator('.fg-video').click();
		await expect(video.locator('iframe')).toHaveAttribute(
			'src',
			/youtube(-nocookie)?\.com\/embed\//
		);
		await expect(lightbox.dialog()).toHaveCount(0);

		await lightbox.openFrom(gallery, 1);
		await expect(lightbox.image()).toHaveAttribute(
			'src',
			(await gallery.triggers().nth(1).getAttribute('href')) as string
		);
	}
);

/** LB-22: on Single Item, scope decides whether the lightbox spans the gallery. */
test(
	'LB-22: Single Item opens a one-item lightbox with Single scope and the whole gallery with Gallery scope',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const five = fixture<number[]>('F-small', 'items');

		for (const [scope, count] of [
			['single', 1],
			['gallery', 5],
		] as const) {
			const { id, url } = galleryPage(
				{ ...BASE, layout: 'single-item', lightbox_scope: scope },
				five
			);
			const gallery = new GalleryRender(page, id);
			const lightbox = new Lightbox(page);

			await page.goto(url);
			await gallery.waitFor();
			await expect(gallery.items()).toHaveCount(1);
			await lightbox.openFrom(gallery);

			if (1 === count) {
				await expect(lightbox.next(), scope).toBeHidden();
				await expect(lightbox.dots(), scope).toHaveCount(0);
			} else {
				await expect(lightbox.dots(), scope).toHaveCount(count);
				await lightbox.goNext();
				expect(await lightbox.index()).toBe(1);
			}
		}
	}
);

/** Answer item view pings in the browser and record the ids they name. */
async function recordItemViews(page: Page): Promise<number[]> {
	const views: number[] = [];
	await page.route('**/fotogrids/v1/stats/view*', async (route) => {
		const body = route.request().postDataJSON() ?? {};
		if ('item' === body.object_type) {
			views.push(Number(body.object_id));
		}
		await route.fulfill({ status: 200, json: { success: true } });
	});
	return views;
}

/** LB-23: one item view per slide shown, never a duplicate. */
test(
	'LB-23: the lightbox records exactly one item view for each slide it shows',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const items = fixture<number[]>('F-small', 'items');
		const views = await recordItemViews(page);
		const { id, url } = galleryPage(BASE, items);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();

		await lightbox.openFrom(gallery, 2);
		await expect.poll(() => views).toEqual([items[2]]);

		await lightbox.goNext();
		await expect.poll(() => views).toEqual([items[2], items[3]]);

		// A step taken during the crossfade is dropped.
		await page.waitForTimeout(600);
		await lightbox.goPrev();
		await page.waitForTimeout(1000);
		expect(views).toEqual([items[2], items[3], items[2]]);
	}
);

/** LB-25: each gallery on a page opens its own sequence. */
test(
	'LB-25: with two galleries on a page, each opens the lightbox on its own items',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const small = fixture<number[]>('F-small', 'items');
		const tagged = fixture<number[]>('F-tagged', 'items').slice(0, 3);
		const first = galleryPage(BASE, small).id;
		const second = galleryPage(BASE, tagged).id;
		const { url } = multiGalleryPage([first, second]);
		const a = new GalleryRender(page, first);
		const b = new GalleryRender(page, second);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await a.waitFor();
		await b.waitFor();

		const bOrder = await triggerOrder(b);
		await lightbox.openFrom(b, 1);
		await expect(lightbox.dots()).toHaveCount(3);
		expect(await lightbox.index()).toBe(1);
		await expect(lightbox.image()).toHaveAttribute('src', bOrder[1]);
		await lightbox.close();

		const aOrder = await triggerOrder(a);
		await lightbox.openFrom(a, 3);
		await expect(lightbox.dots()).toHaveCount(5);
		expect(await lightbox.index()).toBe(3);
		await expect(lightbox.image()).toHaveAttribute('src', aOrder[3]);
	}
);
