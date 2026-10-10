import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import type { Locator } from '@playwright/test';

/**
 * The two layouts whose chrome is the navigation — Slider and Image Viewer —
 * and what every layout does with a gallery too large to show at once.
 *
 * scoped: each test renders its own gallery and reads it.
 */

const FIVE = fixture<number[]>('F-small', 'items');
const SIXTY = fixture<number[]>('F-large', 'items');

const DESKTOP = { width: 1280, height: 900 };

/** The counter reads "n / total", so it says which slide is showing. */
async function slide(gallery: GalleryRender): Promise<string> {
	return (
		await gallery.root.locator('[data-fg-carousel-counter]').innerText()
	).trim();
}

/**
 * Wait until the scroller stops moving.
 *
 * A key press starts an animation and a debounced scroll listener then reads
 * the position back. Asserting while both are running reads a moving target,
 * so each row waits for the scroll to settle and then looks once.
 */
async function settled(scroller: Locator): Promise<number> {
	let last = -1;

	for (let i = 0; i < 60; i++) {
		const now = await scroller.evaluate((element) => element.scrollLeft);
		if (now === last) {
			return now;
		}
		last = now;
		// Longer than the listener's own debounce, so a settled scroller reads
		// the same twice rather than between two frames of an animation.
		await scroller.page().waitForTimeout(120);
	}

	throw new Error('the slider never stopped scrolling');
}

test.describe('Slider', () => {
	/** Every piece of chrome the settings can turn on, and what turns it off. */
	test(
		'LAY-06: the chrome is the one the settings asked for',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'slider',
					layout_show_arrows: true,
					layout_show_bullets: true,
					layout_show_counter: true,
					layout_thumbnails_show: true,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.setViewportSize(DESKTOP);
			await page.goto(url);
			await gallery.waitFor();

			await expect(
				gallery.root.locator('.fg-carousel-arrow')
			).toHaveCount(2);
			await expect(
				gallery.root.locator('.fg-carousel-bullet')
			).toHaveCount(FIVE.length);
			await expect(
				gallery.root.locator('.fg-carousel-counter')
			).toHaveCount(1);
			await expect(
				gallery.root.locator('.fg-carousel-thumb')
			).toHaveCount(FIVE.length);
		}
	);

	test(
		'LAY-06: every piece of chrome can be turned off',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'slider',
					layout_show_arrows: false,
					layout_show_bullets: false,
					layout_show_counter: false,
					layout_thumbnails_show: false,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.setViewportSize(DESKTOP);
			await page.goto(url);
			await gallery.waitFor();

			await expect(
				gallery.root.locator('.fg-carousel-arrow')
			).toHaveCount(0);
			await expect(
				gallery.root.locator('.fg-carousel-bullet')
			).toHaveCount(0);
			await expect(
				gallery.root.locator('.fg-carousel-counter')
			).toHaveCount(0);
			await expect(
				gallery.root.locator('.fg-carousel-thumb')
			).toHaveCount(0);

			// The items are still all there; only the navigation went.
			await expect(gallery.items()).toHaveCount(FIVE.length);
		}
	);

	test(
		'LAY-06: the settings reach the wrapper as the attributes JS reads',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'slider',
					layout_loop: false,
					layout_autoplay: true,
					layout_autoplay_delay: 7000,
					layout_transition: 'none',
					layout_transition_duration: 'custom',
					layout_transition_duration_custom: 900,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			expect(await gallery.attr('loop')).toBe('0');
			expect(await gallery.attr('autoplay')).toBe('1');
			expect(await gallery.attr('autoplay-delay')).toBe('7000');
			expect(await gallery.attr('transition')).toBe('none');
			expect(await gallery.attr('transition-duration')).toBe('custom');
			expect(await gallery.attr('transition-duration-custom')).toBe(
				'900'
			);
		}
	);

	/**
	 * LAY-06. The handler is on the document and checks that focus is inside the
	 * gallery, so the keys only steer a slider the visitor is actually in.
	 */
	test(
		'LAY-06: arrows, Home and End move the slider',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'slider',
					layout_show_counter: true,
					layout_loop: false,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.setViewportSize(DESKTOP);
			await page.goto(url);
			await gallery.waitFor();

			const scroller = gallery.root.locator('.fg-carousel-track-wrapper');

			await expect(
				gallery.root.locator('[data-fg-carousel-counter]')
			).toBeVisible();
			expect(await slide(gallery)).toBe(`1 / ${FIVE.length}`);

			await gallery.root.focus();

			const last = `${FIVE.length} / ${FIVE.length}`;
			const moves = [
				{ key: 'ArrowRight', at: `2 / ${FIVE.length}` },
				{ key: 'ArrowLeft', at: `1 / ${FIVE.length}` },
				{ key: 'End', at: last },
				{ key: 'Home', at: `1 / ${FIVE.length}` },
			] as const;

			for (const move of moves) {
				await page.keyboard.press(move.key);
				await settled(scroller);

				expect(await slide(gallery), `after ${move.key}`).toBe(move.at);
			}
		}
	);

	test(
		'LAY-06: the keys do nothing while focus is elsewhere',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'slider',
					layout_show_counter: true,
					layout_loop: false,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.setViewportSize(DESKTOP);
			await page.goto(url);
			await gallery.waitFor();

			const scroller = gallery.root.locator('.fg-carousel-track-wrapper');

			await page.locator('body').click({ position: { x: 2, y: 2 } });
			await page.keyboard.press('End');
			await settled(scroller);

			expect(await slide(gallery)).toBe(`1 / ${FIVE.length}`);
		}
	);

	/**
	 * LAY-07. Reduced motion does not stop the slider; it stops the animation.
	 * The scroll jumps to the destination instead of travelling there, which a
	 * long custom duration makes measurable.
	 */
	test(
		'LAY-07: reduced motion lands the slide instead of animating it',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'slider',
					layout_show_counter: true,
					layout_loop: false,
					layout_transition: 'horizontal',
					layout_transition_duration: 'custom',
					layout_transition_duration_custom: 3000,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);
			const scroller = gallery.root.locator('.fg-carousel-track-wrapper');

			/** Where the scroller sits a fraction into a three-second animation. */
			async function offsetEarly(): Promise<{
				at: number;
				slide: number;
			}> {
				await page.goto(url);
				await gallery.waitFor();
				await gallery.root.focus();
				await page.keyboard.press('ArrowRight');

				// Long enough to have started, far too early to have finished.
				await page.waitForTimeout(150);

				return scroller.evaluate((element) => ({
					at: element.scrollLeft,
					slide: element.clientWidth,
				}));
			}

			await page.setViewportSize(DESKTOP);

			await page.emulateMedia({ reducedMotion: 'reduce' });
			const jumped = await offsetEarly();

			await page.emulateMedia({ reducedMotion: 'no-preference' });
			const animating = await offsetEarly();

			// Arrived, rather than merely further along than the animation: a
			// comparison between two small numbers would hold whether or not
			// reduced motion was honoured at all.
			expect(
				jumped.at,
				'reduced motion animated instead of jumping'
			).toBe(jumped.slide);
			expect(
				animating.at,
				'the animation was already over, so this cannot tell the two apart'
			).toBeLessThan(animating.slide / 4);
		}
	);
});

/**
 * LAY-08. The Image Viewer's chrome is one bar: arrows that are always there,
 * no bullets, no thumbnail strip. The slider stamps `show-arrows` and
 * `show-bullets` because it can hide them; the viewer has no such attributes.
 */
test.describe('Image Viewer', () => {
	test(
		'LAY-08: the arrows are not a setting',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'image-viewer',
					layout_show_arrows: false,
					layout_show_bullets: true,
				},
				FIVE
			);
			const gallery = new GalleryRender(page, id);

			await page.setViewportSize(DESKTOP);
			await page.goto(url);
			await gallery.waitFor();

			expect(await gallery.attr('show-arrows')).toBeNull();
			expect(await gallery.attr('show-bullets')).toBeNull();

			await expect(
				gallery.root.locator('.fg-viewer-arrow'),
				'the arrows are the navigation, so turning them off cannot apply'
			).toHaveCount(2);
			await expect(
				gallery.root.locator('.fg-carousel-bullet')
			).toHaveCount(0);
			await expect(
				gallery.root.locator('.fg-carousel-thumb')
			).toHaveCount(0);
		}
	);

	/**
	 * The title goes to the control bar, so the item carries it on an attribute
	 * and renders no figcaption. Grid is the contrast: same gallery, same
	 * caption settings, a real figcaption.
	 */
	test(
		'LAY-08: the caption title travels on the item, not in a figcaption',
		{
			tag: ['@layout', '@settings'],
		},
		async ({ page }) => {
			const settings = {
				caption_hide_title: false,
				caption_hide_description: false,
			};

			const grid = galleryPage({ layout: 'grid', ...settings }, FIVE);
			const gridRender = new GalleryRender(page, grid.id);

			await page.goto(grid.url);
			await gridRender.waitFor();

			const gridCaption = gridRender.root
				.locator('figcaption.fg-caption')
				.first();
			await expect(gridCaption).toBeAttached();
			const title = (
				await gridCaption.locator('.fg-caption-title').innerText()
			).trim();
			expect(
				title,
				'the fixture has no caption title, so this proves nothing'
			).not.toBe('');

			const viewer = galleryPage(
				{ layout: 'image-viewer', ...settings },
				FIVE
			);
			const viewerRender = new GalleryRender(page, viewer.id);

			await page.goto(viewer.url);
			await viewerRender.waitFor();

			await expect(viewerRender.root.locator('figcaption')).toHaveCount(
				0
			);
			expect(
				await viewerRender
					.items()
					.first()
					.getAttribute('data-fg-caption-title')
			).toBe(title);
		}
	);
});

/**
 * LAY-27. Sixty items, and each layout's own answer to "how many at once".
 * The paginating layouts cut to the page size; the two that are their own
 * navigation show the lot; Single Item shows one; Featured Item shows one plus
 * its grid.
 */
test.describe('a gallery of sixty', () => {
	const EXPECTED = [
		{ layout: 'grid', items: 12 },
		{ layout: 'masonry', items: 12 },
		{ layout: 'justified', items: 12 },
		{ layout: 'instant-photos', items: 12 },
		{ layout: 'slider', items: 60 },
		{ layout: 'image-viewer', items: 60 },
		{ layout: 'single-item', items: 1 },
		{ layout: 'featured-item', items: 7 },
	] as const;

	for (const { layout, items } of EXPECTED) {
		test(
			`LAY-27: ${layout} renders ${items} of sixty`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { id, url } = galleryPage({ layout }, SIXTY);
				const gallery = new GalleryRender(page, id);

				await page.setViewportSize(DESKTOP);
				await page.goto(url);
				await gallery.waitFor();

				await expect(gallery.items()).toHaveCount(items);
			}
		);
	}

	test(
		'LAY-27: the page size is what cuts the paginating layouts',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'grid',
					items_per_page: { desktop: 20, tablet: 20, mobile: 20 },
				},
				SIXTY
			);
			const gallery = new GalleryRender(page, id);

			await page.setViewportSize(DESKTOP);
			await page.goto(url);
			await gallery.waitFor();

			await expect(gallery.items()).toHaveCount(20);
		}
	);
});
