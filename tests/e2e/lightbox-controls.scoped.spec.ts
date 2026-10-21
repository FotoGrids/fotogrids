import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * How a visitor drives the full lightbox: closing it, the keyboard, focus,
 * the thumbnail strip, auto-progress and zoom.
 *
 * scoped: each test renders a gallery it created.
 */

/** Settings every test starts from: dots to read the index, no auto-advance. */
const BASE = {
	layout: 'grid',
	lightbox_show_dots: true,
	lightbox_auto_progress: false,
};

async function openOn(
	page: Page,
	settings: Record<string, unknown>,
	items?: number[]
): Promise<{ gallery: GalleryRender; lightbox: Lightbox }> {
	const { id, url } = galleryPage({ ...BASE, ...settings }, items);
	const gallery = new GalleryRender(page, id);
	const lightbox = new Lightbox(page);

	await page.goto(url);
	await gallery.waitFor();
	await lightbox.openFrom(gallery);

	return { gallery, lightbox };
}

/** LB-02: arrows step, Home and End jump to the ends. */
test(
	'LB-02: the arrow keys step through items, Home and End jump to the first and last',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { lightbox } = await openOn(page, {});

		// A key pressed while the crossfade runs is dropped, so each press
		// waits for the previous step to settle.
		const step = async (key: string, expected: number) => {
			await page.waitForTimeout(600);
			await page.keyboard.press(key);
			await expect
				.poll(() => lightbox.index(), { message: key })
				.toBe(expected);
		};

		await step('ArrowRight', 1);
		await step('ArrowRight', 2);
		await step('ArrowLeft', 1);
		await step('End', 4);
		await step('Home', 0);
		await step('ArrowLeft', 4);
	}
);

/**
 * LB-03: focus enters the dialog on open, and Tab never reaches the page
 * behind it. A modal dialog may hand focus to the browser between laps, which
 * leaves no element focused; the next Tab comes back into the dialog.
 */
test(
	'LB-03: focus moves into the lightbox on open and Tab and Shift+Tab never reach the page behind',
	{ tag: '@lightbox' },
	async ({ page }) => {
		await openOn(page, { lightbox_fullscreen: true });

		const where = () =>
			page.locator('body').evaluate((body) => {
				const active = body.ownerDocument.activeElement;
				if (!active || active === body) {
					return 'none';
				}
				return active.closest('dialog.fg-lightbox') ? 'dialog' : 'page';
			});

		expect(await where(), 'focus on open').toBe('dialog');

		for (const key of ['Tab', 'Shift+Tab']) {
			const visited: string[] = [];
			for (let n = 0; n < 25; n++) {
				await page.keyboard.press(key);
				visited.push(await where());
			}
			expect(visited, key).not.toContain('page');
			expect(
				visited.filter((stop) => 'dialog' === stop).length,
				key
			).toBeGreaterThan(20);
		}
	}
);

/** Where the strip sits against the stage image. */
function stripSide(lightbox: Lightbox) {
	return lightbox.dialog().evaluate((dialog) => {
		const strip = dialog
			.querySelector('.fg-lb-thumbs')!
			.getBoundingClientRect();
		const image = dialog
			.querySelector('.fg-lb-media-wrap')!
			.getBoundingClientRect();
		if (strip.top >= image.bottom - 1) {
			return 'bottom';
		}
		if (strip.bottom <= image.top + 1) {
			return 'top';
		}
		if (strip.right <= image.left + 1) {
			return 'left';
		}
		if (strip.left >= image.right - 1) {
			return 'right';
		}
		return 'overlapping';
	});
}

/** LB-04: the strip goes where it is told, at the size and spacing set. */
test(
	'LB-04: the thumbnail strip sits on the chosen side, at the chosen size and spacing, and navigates',
	{ tag: '@lightbox' },
	async ({ page }) => {
		for (const location of ['bottom', 'top', 'left', 'right'] as const) {
			const { lightbox } = await openOn(page, {
				lightbox_thumbnail_strip_location: location,
			});
			await expect(lightbox.thumbs()).toHaveCount(5);
			expect(await stripSide(lightbox), location).toBe(location);
		}

		const sized = async (size: string) => {
			const { lightbox } = await openOn(page, {
				lightbox_thumbnail_strip_location: 'bottom',
				lightbox_thumbnail_size: size,
				lightbox_thumbnail_spacing: 17,
			});
			// The first thumb is active, and the active one is scaled up.
			const box = await lightbox.thumbs().nth(2).boundingBox();
			const next = await lightbox.thumbs().nth(3).boundingBox();
			return {
				lightbox,
				height: box!.height,
				gap: Math.round(next!.x - (box!.x + box!.width)),
			};
		};

		const small = await sized('small');
		const large = await sized('large');
		expect(large.height).toBeGreaterThan(small.height);
		expect(large.gap).toBe(17);

		await large.lightbox.thumbs().nth(3).click();
		await expect.poll(() => large.lightbox.index()).toBe(3);
		await expect(large.lightbox.thumbs().nth(3)).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		const none = await openOn(page, {
			lightbox_thumbnail_strip_location: 'none',
		});
		await expect(
			none.lightbox.dialog().locator('.fg-lb-thumbs')
		).toBeHidden();
	}
);

/** LB-08: the slideshow advances on its delay, in the chosen indicator. */
test(
	'LB-08: auto-progress advances after the delay, with a bar or a spinner',
	{ tag: '@lightbox' },
	async ({ page }) => {
		for (const [style, indicator] of [
			['bar', '.fg-lb-progress-bar'],
			['spinner', '.fg-lb-progress-ring-fill'],
		] as const) {
			const { lightbox } = await openOn(page, {
				lightbox_auto_progress: true,
				lightbox_auto_progress_delay: 1,
				lightbox_auto_progress_style: style,
				lightbox_auto_progress_pause_on: [],
			});
			await page.mouse.move(0, 0);

			await expect(
				lightbox.dialog().locator(indicator),
				style
			).toBeAttached();
			expect(await lightbox.index()).toBe(0);
			await expect
				.poll(() => lightbox.index(), { timeout: 4000 })
				.toBe(1);
			await expect
				.poll(() => lightbox.index(), { timeout: 4000 })
				.toBe(2);
		}
	}
);

/** LB-08: hovering the image holds the slideshow, leaving resumes it. */
test(
	'LB-08: auto-progress pauses while the image is hovered',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { lightbox } = await openOn(page, {
			lightbox_auto_progress: true,
			lightbox_auto_progress_delay: 1,
			lightbox_auto_progress_pause_on: ['image_hover'],
		});

		await lightbox.image().hover();
		await page.waitForTimeout(2500);
		expect(await lightbox.index()).toBe(0);

		await page.mouse.move(0, 0);
		await expect.poll(() => lightbox.index(), { timeout: 4000 }).toBe(1);
	}
);

/** LB-08: a manual step stops the slideshow when stop-on-interaction is on. */
test(
	'LB-08: navigating by hand stops auto-progress, unless stop on interaction is off',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const stopping = await openOn(page, {
			lightbox_auto_progress: true,
			lightbox_auto_progress_delay: 1,
			lightbox_auto_progress_pause_on: [],
			lightbox_auto_progress_stop_on_interaction: true,
		});
		await stopping.lightbox.goNext();
		await page.mouse.move(0, 0);
		await page.waitForTimeout(2500);
		expect(await stopping.lightbox.index()).toBe(1);

		const running = await openOn(page, {
			lightbox_auto_progress: true,
			lightbox_auto_progress_delay: 1,
			lightbox_auto_progress_pause_on: [],
			lightbox_auto_progress_stop_on_interaction: false,
		});
		await running.lightbox.goNext();
		await page.mouse.move(0, 0);
		await expect
			.poll(() => running.lightbox.index(), { timeout: 4000 })
			.toBe(2);
	}
);

/** The stage image's current scale, from its transform. */
function scaleOf(lightbox: Lightbox): Promise<number> {
	return lightbox.image().evaluate((img) => {
		const matrix = new DOMMatrixReadOnly(getComputedStyle(img).transform);
		return Math.round(matrix.a * 100) / 100;
	});
}

/** LB-09: each zoom trigger zooms the stage image, and only its own gesture. */
test(
	'LB-09: double-click, click and wheel zoom the image, each only under its own trigger',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const dbl = await openOn(page, {
			lightbox_zoom: true,
			lightbox_zoom_trigger: 'double_click',
			lightbox_zoom_beyond_original: true,
		});
		await dbl.lightbox.image().click();
		await page.waitForTimeout(400);
		expect(await scaleOf(dbl.lightbox), 'single click').toBe(1);
		await dbl.lightbox.image().dblclick();
		await expect.poll(() => scaleOf(dbl.lightbox)).toBeGreaterThan(1);

		const click = await openOn(page, {
			lightbox_zoom: true,
			lightbox_zoom_trigger: 'click',
			lightbox_zoom_beyond_original: true,
		});
		await click.lightbox.image().click();
		await expect.poll(() => scaleOf(click.lightbox)).toBeGreaterThan(1);

		const wheel = await openOn(page, {
			lightbox_zoom: true,
			lightbox_zoom_trigger: 'wheel_pinch',
			lightbox_zoom_beyond_original: true,
		});
		await wheel.lightbox.image().click();
		await page.waitForTimeout(400);
		expect(await scaleOf(wheel.lightbox), 'click under wheel').toBe(1);
		await wheel.lightbox.image().hover();
		await page.mouse.wheel(0, -400);
		await expect.poll(() => scaleOf(wheel.lightbox)).toBeGreaterThan(1);
	}
);
