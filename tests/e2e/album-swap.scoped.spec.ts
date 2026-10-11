import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';
import type { Page } from '@playwright/test';

/**
 * An album's default mode: clicking a tile swaps the gallery into the album's
 * place without leaving the page, and the gallery's Back button puts the album
 * back. Anything the swap cannot do - a modifier click, a failed request -
 * falls through to the link the tile already is.
 *
 * scoped: each test makes its own album.
 */

const FIVE = fixture<number[]>('F-small', 'items');

const TRIGGER = '[data-fg-album-ajax-trigger]';

/** An album of two galleries, with the Back button the swap relies on. */
function twoGalleryAlbum() {
	const galleries = [
		galleryPage({ layout: 'grid' }, FIVE.slice(0, 3)).id,
		galleryPage({ layout: 'grid' }, FIVE.slice(3, 5)).id,
	];

	const made = album(galleries, {
		use_ajax_from_album: true,
		navigation_show_back_button: true,
	});

	return { ...made, galleries };
}

function viewOf(id: number): string {
	return wpEval(`echo get_permalink( ${id} );`).trim();
}

/** Resolve on the next occurrence of a FotoGrids document event. */
function nextEvent(page: Page, name: string): Promise<void> {
	return page.evaluate(
		(eventName) =>
			new Promise<void>((resolve) =>
				document.addEventListener(eventName, () => resolve(), {
					once: true,
				})
			),
		name
	);
}

test.describe('the swap', () => {
	test(
		'ALB-05: a tile swaps the gallery in without leaving the page',
		{
			tag: ['@layout', '@critical'],
		},
		async ({ page }) => {
			const { id, url, galleries } = twoGalleryAlbum();

			await page.goto(url);

			const albumEl = page.locator(`[data-fg-album-id="${id}"]`);
			await expect(albumEl.locator(TRIGGER)).toHaveCount(2);

			const swapped = nextEvent(page, 'fotogrids:album_swapped');
			await albumEl
				.locator(`${TRIGGER}[data-fg-gallery-id="${galleries[0]}"]`)
				.click();
			await swapped;

			expect(page.url(), 'the swap navigated away').toBe(url);
			expect(await albumEl.getAttribute('data-fg-ajax-swapped')).toBe(
				'1'
			);

			// The album wrapper now holds the gallery, and the runtime has
			// initialised it like any other.
			const gallery = new GalleryRender(page, galleries[0]);
			await gallery.waitFor();
			await expect(gallery.items()).toHaveCount(3);
			await expect(albumEl.locator(TRIGGER)).toHaveCount(0);
		}
	);

	/**
	 * ALB-06. The snapshot is the album as first rendered, so a second
	 * drill-down after a Back restores the album and not the first gallery -
	 * and the restored tiles have to be live again for that second click to
	 * swap at all.
	 */
	test(
		'ALB-06: Back restores the album, and its tiles swap again',
		{
			tag: ['@layout', '@critical'],
		},
		async ({ page }) => {
			const { id, url, galleries } = twoGalleryAlbum();
			const albumEl = page.locator(`[data-fg-album-id="${id}"]`);

			await page.goto(url);

			let swapped = nextEvent(page, 'fotogrids:album_swapped');
			await albumEl
				.locator(`${TRIGGER}[data-fg-gallery-id="${galleries[0]}"]`)
				.click();
			await swapped;

			const back = albumEl.locator('.fg-back-button');
			await expect(
				back,
				'the swapped-in gallery offers no way back'
			).toBeVisible();

			const restored = nextEvent(page, 'fotogrids:album_restored');
			await back.click();
			await restored;

			expect(page.url()).toBe(url);
			expect(
				await albumEl.getAttribute('data-fg-ajax-swapped')
			).toBeNull();
			await expect(albumEl.locator(TRIGGER)).toHaveCount(2);

			swapped = nextEvent(page, 'fotogrids:album_swapped');
			await albumEl
				.locator(`${TRIGGER}[data-fg-gallery-id="${galleries[1]}"]`)
				.click();
			await swapped;

			const second = new GalleryRender(page, galleries[1]);
			await second.waitFor();
			await expect(second.items()).toHaveCount(2);
		}
	);
});

/**
 * ALB-07. The tile is a real link to the gallery's page, and the swap is an
 * enhancement on top of it. Every case the script declines falls through to
 * that link.
 */
test.describe('falling through to the link', () => {
	test(
		'ALB-07: a modifier click opens the gallery page and leaves the album',
		{
			tag: '@layout',
		},
		async ({ page, context }) => {
			const { id, url, galleries } = twoGalleryAlbum();
			const albumEl = page.locator(`[data-fg-album-id="${id}"]`);

			await page.goto(url);

			const opened = context.waitForEvent('page');
			await albumEl
				.locator(`${TRIGGER}[data-fg-gallery-id="${galleries[0]}"]`)
				.click({ modifiers: ['ControlOrMeta'] });
			const tab = await opened;
			const target = viewOf(galleries[0]);
			await tab.waitForURL(
				(to) => `${to.origin}${to.pathname}` === target
			);

			expect(
				await albumEl.getAttribute('data-fg-ajax-swapped')
			).toBeNull();
			await expect(albumEl.locator(TRIGGER)).toHaveCount(2);

			await tab.close();
		}
	);

	test.describe('when the render request fails', () => {
		// The failure is induced, and the browser logs the refused request.
		test.use({
			allowConsoleErrors: 'the row fails the render request on purpose',
		});

		test(
			'ALB-07: a failed swap navigates to the gallery page instead',
			{
				tag: '@layout',
			},
			async ({ page }) => {
				const { url, galleries } = twoGalleryAlbum();

				await page.route('**/fotogrids/v1/gallery/render**', (route) =>
					route.fulfill({ status: 500, body: '{}' })
				);

				const target = new URL(viewOf(galleries[0])).pathname;

				await page.goto(url);

				await Promise.all([
					page.waitForURL((to) => to.pathname === target),
					page
						.locator(
							`${TRIGGER}[data-fg-gallery-id="${galleries[0]}"]`
						)
						.click(),
				]);

				const gallery = new GalleryRender(page, galleries[0]);
				await gallery.waitFor();
				await expect(gallery.items()).toHaveCount(3);
			}
		);
	});
});
