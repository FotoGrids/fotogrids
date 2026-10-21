import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';

/**
 * The two lightbox variants besides the full one: the Mini viewer and the
 * Grid overlay.
 *
 * scoped: each test renders a gallery it created.
 */

const MINI = {
	layout: 'grid',
	item_click_behavior: 'lightbox',
	lightbox_variant: 'mini',
};

function mini(page: Page) {
	const overlay = page.locator('.fg-lb-mv');
	return {
		overlay,
		image: overlay.locator('.fg-lb-mv-image'),
		next: overlay.locator('.fg-lb-mv-next'),
		prev: overlay.locator('.fg-lb-mv-prev'),
		close: overlay.locator('.fg-lb-mv-close'),
		bullets: overlay.locator('.fg-lb-mv-bullet'),
		backdrop: overlay.locator('.fg-lb-mv-backdrop'),
		current: overlay.locator('.fg-lb-mv-bullet[aria-current="true"]'),
	};
}

/** The full-size URL of each item, in page order. */
function fullSources(gallery: GalleryRender): Promise<string[]> {
	return gallery
		.triggers()
		.evaluateAll((links) =>
			links.map((link) => (link as HTMLAnchorElement).href)
		);
}

/**
 * LB-19 / LB-21: the Mini viewer opens on the clicked item, steps with its
 * arrows and bullets, and closes from its button, its backdrop and Escape.
 */
test(
	'LB-19 / LB-21: the Mini viewer opens on the clicked item, navigates by arrow and bullet, and closes three ways',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			...MINI,
			lightbox_mini_show_arrows: true,
			lightbox_mini_show_bullets: true,
			lightbox_mini_show_close: true,
			lightbox_mini_show_overlay: true,
		});
		const gallery = new GalleryRender(page, id);
		const mv = mini(page);

		await page.goto(url);
		await gallery.waitFor();
		await expect(gallery.root).toHaveAttribute(
			'data-fg-lightbox-variant',
			'mini'
		);
		const sources = await fullSources(gallery);

		await gallery.items().nth(1).click();
		await expect(mv.overlay).toBeVisible();
		await expect(page.locator('dialog.fg-lightbox')).toHaveCount(0);
		await expect(mv.image).toHaveAttribute('src', sources[1]);
		await expect(mv.bullets).toHaveCount(5);
		await expect(mv.current).toHaveAttribute('aria-label', /2/);

		await mv.next.click();
		await expect(mv.image).toHaveAttribute('src', sources[2]);
		await mv.prev.click();
		await mv.prev.click();
		await expect(mv.image).toHaveAttribute('src', sources[0]);
		await mv.prev.click();
		await expect(mv.image).toHaveAttribute('src', sources[4]);
		await mv.bullets.nth(3).click();
		await expect(mv.image).toHaveAttribute('src', sources[3]);

		await mv.close.click();
		await expect(mv.overlay).toHaveCount(0);

		await gallery.items().first().click();
		await expect(mv.overlay).toBeVisible();
		await mv.backdrop.click({ position: { x: 5, y: 5 } });
		await expect(mv.overlay).toHaveCount(0);

		await gallery.items().first().click();
		await expect(mv.overlay).toBeVisible();
		await page.keyboard.press('ArrowRight');
		await expect(mv.image).toHaveAttribute('src', sources[1]);
		await page.keyboard.press('Escape');
		await expect(mv.overlay).toHaveCount(0);
	}
);

/** LB-19: each chrome toggle removes its part, and blur and padding apply. */
test(
	'LB-19: the Mini viewer leaves out the arrows, bullets, close button and backdrop when they are off, and applies blur and padding',
	{ tag: ['@lightbox', '@visual'] },
	async ({ page }) => {
		const bare = galleryPage({
			...MINI,
			lightbox_mini_show_arrows: false,
			lightbox_mini_show_bullets: false,
			lightbox_mini_show_close: false,
			lightbox_mini_show_overlay: false,
		});
		const styled = galleryPage({
			...MINI,
			lightbox_mini_show_overlay: true,
			lightbox_mini_overlay_blur: 'strong',
			lightbox_mini_padding: { desktop: 40, tablet: 40, mobile: 40 },
		});
		const mv = mini(page);

		await page.goto(bare.url);
		const plain = new GalleryRender(page, bare.id);
		await plain.waitFor();
		await plain.items().first().click();
		await expect(mv.overlay).toBeVisible();
		for (const part of ['next', 'prev', 'close', 'backdrop'] as const) {
			await expect(mv[part], part).toHaveCount(0);
		}
		await expect(mv.bullets).toHaveCount(0);
		await page.keyboard.press('Escape');

		await page.goto(styled.url);
		const gallery = new GalleryRender(page, styled.id);
		await gallery.waitFor();
		await gallery.items().first().click();
		await expect(mv.overlay).toBeVisible();
		await expect(mv.overlay).toHaveAttribute('data-fg-mv-blur', 'strong');
		expect(
			await mv.backdrop.evaluate(
				(el) => getComputedStyle(el).backdropFilter
			)
		).toBe('blur(16px)');
		expect(
			await mv.overlay.evaluate((el) =>
				getComputedStyle(el)
					.getPropertyValue('--fg-lb-mv-padding')
					.trim()
			)
		).toBe('40px');
	}
);

const GRID = {
	layout: 'grid',
	item_click_behavior: 'lightbox',
	lightbox_variant: 'grid',
};

/**
 * LB-20: the Grid overlay lays out every item from the gallery's item list,
 * one wide tile then pairs, at the set tile ratio and per-breakpoint width,
 * and a tile opens that item.
 */
test(
	'LB-20: the Grid overlay shows every item at the set tile ratio and per-breakpoint width',
	{ tag: ['@lightbox', '@visual'] },
	async ({ page }) => {
		const { id, url } = galleryPage({
			...GRID,
			lightbox_grid_aspect_ratio: '1/1',
			lightbox_grid_max_width: {
				desktop: { value: 50, unit: 'vw' },
				tablet: { value: 70, unit: 'vw' },
				mobile: { value: 80, unit: 'vw' },
			},
		});
		const gallery = new GalleryRender(page, id);
		const overlay = page.locator('.fg-lb-grid');
		const items = fixture<number[]>('F-small', 'items');

		await page.setViewportSize({ width: 1200, height: 900 });
		await page.goto(url);
		await gallery.waitFor();

		const listed = JSON.parse(
			(await gallery.attr('grid-items')) as string
		) as Array<{ id: number | string }>;
		expect(listed.map((item) => Number(item.id))).toEqual(items);

		await gallery.items().nth(2).click();
		await expect(overlay).toBeVisible();
		await expect(page.locator('dialog.fg-lightbox')).toHaveCount(0);

		const tiles = overlay.locator('.fg-lb-grid-tile');
		await expect(tiles).toHaveCount(5);
		expect(
			await overlay
				.locator('.fg-lb-grid-row')
				.evaluateAll((rows) =>
					rows.map(
						(row) => row.querySelectorAll('.fg-lb-grid-tile').length
					)
				)
		).toEqual([1, 2, 1, 1]);

		const ratio = await overlay
			.locator('.fg-lb-grid-tile--single .fg-lb-grid-tile-media')
			.first()
			.evaluate((el) => {
				const box = el.getBoundingClientRect();
				return Math.round((box.width / box.height) * 100) / 100;
			});
		expect(ratio).toBeCloseTo(1, 1);

		const width = () =>
			overlay
				.locator('.fg-lb-grid-inner')
				.evaluate((el) => el.getBoundingClientRect().width);
		expect(Math.round(await width())).toBe(600);

		await page.setViewportSize({ width: 900, height: 900 });
		await expect.poll(width).toBeCloseTo(630, 0);

		await page.setViewportSize({ width: 600, height: 900 });
		await expect.poll(width).toBeCloseTo(480, 0);
	}
);
