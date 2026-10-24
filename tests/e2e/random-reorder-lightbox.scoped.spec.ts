import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { twelveItems } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * LB-17, reorder mode: a gallery shuffled in the browser opens the lightbox on
 * the clicked item and walks the order the grid shows.
 *
 * scoped: each test renders galleries it created.
 */

const BASE = {
	layout: 'grid',
	lightbox_variant: 'full',
	lightbox_show_dots: true,
	lightbox_auto_progress: false,
	default_sort_order: 'random',
	random_mode: 'reorder',
};

const ONE_PAGE = {
	pagination_type: 'paginated',
	pagination_method: 'load_more',
	items_per_page: { desktop: 12, tablet: 12, mobile: 12 },
};

/** The full-size URL of each trigger, in page order. */
function triggerOrder(gallery: GalleryRender): Promise<string[]> {
	return gallery
		.triggers()
		.evaluateAll((links) =>
			links.map((link) => (link as HTMLAnchorElement).href)
		);
}

/** Asserts the stage shows the grid's item at `index`. */
async function expectStage(
	lightbox: Lightbox,
	order: string[],
	index: number
): Promise<void> {
	await expect.poll(() => lightbox.index()).toBe(index);
	await expect(lightbox.image(), `#${index}`).toHaveAttribute(
		'src',
		order[index]
	);
}

/** Opens the gallery's page and returns its triggers' order once settled. */
async function settledOrder(
	gallery: GalleryRender,
	url: string,
	count: number
): Promise<string[]> {
	await gallery.root.page().goto(url);
	await gallery.waitFor();
	await expect(gallery.triggers()).toHaveCount(count);
	return triggerOrder(gallery);
}

test(
	'LB-17: reorder - the first item opens slide 1 and Next follows the grid',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { id, url } = galleryPage(
			{ ...BASE, ...ONE_PAGE },
			twelveItems()
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		const order = await settledOrder(gallery, url, 12);

		await lightbox.openFrom(gallery, 0);
		for (let index = 0; index < 12; index++) {
			await expectStage(lightbox, order, index);
			if (index < 11) {
				// A step taken during the crossfade is dropped.
				await page.waitForTimeout(600);
				await lightbox.goNext();
			}
		}
	}
);

test(
	'LB-17: reorder - an item mid-grid opens on itself and Previous and Next reach its neighbours',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { id, url } = galleryPage(
			{ ...BASE, ...ONE_PAGE },
			twelveItems()
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		const order = await settledOrder(gallery, url, 12);

		await lightbox.openFrom(gallery, 5);
		await expectStage(lightbox, order, 5);

		await page.waitForTimeout(600);
		await lightbox.goPrev();
		await expectStage(lightbox, order, 4);

		await page.waitForTimeout(600);
		await lightbox.goNext();
		await page.waitForTimeout(600);
		await lightbox.goNext();
		await expectStage(lightbox, order, 6);
	}
);

test(
	'LB-17: reorder - after Load More the lightbox crosses into the new batch in grid order',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { id, url } = galleryPage(
			{
				...BASE,
				pagination_type: 'paginated',
				pagination_method: 'load_more',
				items_per_page: { desktop: 6, tablet: 6, mobile: 6 },
			},
			twelveItems()
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await settledOrder(gallery, url, 6);
		await gallery.root
			.locator('[data-fg-pagination-trigger="load-more"]')
			.click();
		await expect(gallery.triggers()).toHaveCount(12);
		const order = await triggerOrder(gallery);

		await lightbox.openFrom(gallery, 4);
		for (let index = 4; index < 9; index++) {
			await expectStage(lightbox, order, index);
			if (index < 8) {
				await page.waitForTimeout(600);
				await lightbox.goNext();
			}
		}
	}
);

test(
	'LB-17: reorder - with every item shown and no pagination, the lightbox follows the grid',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { id, url } = galleryPage(
			{ ...BASE, pagination_type: 'show_all' },
			twelveItems()
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		const order = await settledOrder(gallery, url, 12);

		await lightbox.openFrom(gallery, 3);
		for (let index = 3; index < 7; index++) {
			await expectStage(lightbox, order, index);
			if (index < 6) {
				await page.waitForTimeout(600);
				await lightbox.goNext();
			}
		}
	}
);
