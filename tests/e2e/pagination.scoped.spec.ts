import { readFileSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';

/**
 * Pagination: Load More, endless scroll and page buttons over a sixty-item
 * gallery, and where pagination does not apply.
 *
 * scoped: each test renders its own gallery.
 */

const sixty = (): number[] => fixture<number[]>('F-large', 'items');

const PER_PAGE = (n: number) => ({ desktop: n, tablet: n, mobile: n });

function paginated(
	method: 'load_more' | 'endless_scroll' | 'pages',
	settings: Record<string, unknown> = {},
	items = sixty()
) {
	return galleryPage(
		{
			layout: 'grid',
			pagination_type: 'paginated',
			pagination_method: method,
			items_per_page: PER_PAGE(12),
			...settings,
		},
		items
	);
}

/** The attachment ids of the items on the page, in order. */
function shown(gallery: GalleryRender): Promise<number[]> {
	return gallery
		.items()
		.locator('[data-fg-item-id]')
		.evaluateAll((nodes) =>
			nodes.map((node) => Number(node.getAttribute('data-fg-item-id')))
		);
}

async function open(page: Page, url: string, id: number) {
	await page.goto(url);
	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	return gallery;
}

test.describe('Load More', () => {
	test(
		'PAG-01: appends the next page and keeps the items already shown',
		{ tag: ['@layout', '@critical'] },
		async ({ page }) => {
			const { id, url } = paginated('load_more');
			const gallery = await open(page, url, id);

			await expect(gallery.items()).toHaveCount(12);
			const first = await shown(gallery);
			expect(first).toEqual(sixty().slice(0, 12));

			const inserted = gallery.root.evaluate(
				(root) =>
					new Promise<number>((resolve) =>
						root.addEventListener(
							'fotogrids:items_inserted',
							(event) =>
								resolve(
									((event as CustomEvent).detail?.items ?? [])
										.length
								),
							{ once: true }
						)
					)
			);
			await gallery.root.locator('.fg-pagination__load-more').click();

			expect(await inserted, 'items_inserted carried no items').toBe(12);
			await expect(gallery.items()).toHaveCount(24);
			expect(await shown(gallery)).toEqual(sixty().slice(0, 24));

			// The appended items are wired like the first page: their images load.
			const appended = gallery.items().nth(12);
			await appended.scrollIntoViewIfNeeded();
			await expect(appended).toHaveAttribute(
				'data-fg-media-state',
				'loaded'
			);
		}
	);

	test(
		'PAG-02: the button goes once the last page is in',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = paginated('load_more', {
				items_per_page: PER_PAGE(25),
			});
			const gallery = await open(page, url, id);
			const button = gallery.root.locator('.fg-pagination__load-more');

			await expect(gallery.items()).toHaveCount(25);
			await button.click();
			await expect(gallery.items()).toHaveCount(50);
			await expect(button).toBeVisible();

			await button.click();
			await expect(gallery.items()).toHaveCount(60);
			await expect(button).toBeHidden();
		}
	);
});

test(
	'PAG-03: endless scroll loads the next page when the end comes into view',
	{ tag: '@layout' },
	async ({ page }) => {
		// Two tall columns, so the end of the first page starts well below the fold.
		const { id, url } = paginated('endless_scroll', {
			columns: PER_PAGE(2),
		});
		await page.setViewportSize({ width: 1280, height: 600 });
		const gallery = await open(page, url, id);

		await expect(gallery.items()).toHaveCount(12);
		// Nothing loads until the visitor gets there.
		await page.waitForTimeout(500);
		await expect(gallery.items()).toHaveCount(12);

		await gallery.root
			.locator('[data-fg-pagination-sentinel]')
			.scrollIntoViewIfNeeded();
		await expect(gallery.items()).toHaveCount(24);
		expect(await shown(gallery)).toEqual(sixty().slice(0, 24));
	}
);

test.describe('page buttons', () => {
	test(
		'PAG-04: previous and next stop at the ends, and the current page is marked',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = paginated('pages', { pages_truncate: false });
			const gallery = await open(page, url, id);
			const nav = gallery.root.locator('.fg-pagination--pages');
			const prev = nav.locator('.fg-pagination__prev');
			const next = nav.locator('.fg-pagination__next');
			const current = nav.locator('[aria-current="page"]');

			await expect(nav.locator('[data-fg-pagination-page]')).toHaveCount(
				5
			);
			await expect(prev).toBeDisabled();
			await expect(next).toBeEnabled();
			await expect(current).toHaveText('1');

			await next.click();
			await expect(current).toHaveText('2');
			await expect(prev).toBeEnabled();
			expect(await shown(gallery)).toEqual(sixty().slice(12, 24));

			await nav.locator('[data-fg-pagination-page="5"]').click();
			await expect(current).toHaveText('5');
			await expect(next).toBeDisabled();
			expect(await shown(gallery)).toEqual(sixty().slice(48, 60));
		}
	);

	/**
	 * PAG-05. The arrow on Previous and Next is the SVG the lightbox's
	 * arrow-icons.json holds for the chosen icon, not a fallback.
	 */
	test(
		'PAG-05: the chosen arrow icon is the one the icon set defines',
		{ tag: '@layout' },
		async ({ page }) => {
			const icons = JSON.parse(
				readFileSync(
					path.resolve(
						'src/public/render/lightbox/shared/arrow-icons.json'
					),
					'utf8'
				)
			);
			const pathsOf = (svg: string) =>
				[...svg.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]);

			for (const icon of ['arrow_circle', 'chevron_double']) {
				const { id, url } = paginated('pages', {
					pages_button_icon: icon,
				});
				const gallery = await open(page, url, id);

				for (const side of ['prev', 'next'] as const) {
					const span = gallery.root.locator(
						`.fg-pagination__icon--${icon}[data-fg-icon="${side}"]`
					);
					await expect(span, `${icon} ${side}`).toHaveCount(1);
					const rendered = pathsOf(await span.innerHTML());
					const expected = pathsOf(String(icons[icon]?.[side] ?? ''));
					expect(
						expected.length,
						`${icon} ${side} in the icon set`
					).toBeGreaterThan(0);
					expect(rendered, `${icon} ${side}`).toEqual(expected);
				}
			}
		}
	);

	/**
	 * PAG-06. The server renders a button for every page; shortening the row
	 * to a window around the current page is the script's job.
	 */
	test(
		'PAG-06: every page button is in the HTML, and the script shortens the row',
		{ tag: '@layout' },
		async ({ page, browser }) => {
			const { id, url } = paginated('pages', {
				items_per_page: PER_PAGE(3),
				pages_truncate: true,
			});
			const buttons = (on: Page) =>
				on.locator(
					`[data-fg-gallery-id="${id}"] .fg-pagination--pages [data-fg-pagination-page]`
				);

			const context = await browser.newContext({
				javaScriptEnabled: false,
			});
			try {
				const noJs = await context.newPage();
				await noJs.goto(url);
				await expect(buttons(noJs)).toHaveCount(20);
				await expect(
					buttons(noJs).filter({ visible: true })
				).toHaveCount(20);
			} finally {
				await context.close();
			}

			await open(page, url, id);
			await expect
				.poll(() => buttons(page).filter({ visible: true }).count())
				.toBeLessThan(20);
			await expect(
				page.locator(
					`[data-fg-gallery-id="${id}"] .fg-pagination--pages [aria-current="page"]`
				)
			).toBeVisible();
		}
	);
});

/**
 * PAG-07. The page size follows the visitor's breakpoint.
 */
test(
	'PAG-07: the first page holds the items-per-page for each breakpoint',
	{ tag: '@layout' },
	async ({ page }) => {
		const { id, url } = paginated('load_more', {
			items_per_page: { desktop: 12, tablet: 8, mobile: 6 },
		});

		for (const [name, width, count] of [
			['desktop', 1280, 12],
			['tablet', 900, 8],
			['mobile', 400, 6],
		] as const) {
			await page.setViewportSize({ width, height: 900 });
			const gallery = await open(page, url, id);
			await expect(gallery.items(), name).toHaveCount(count);
		}
	}
);

test.describe('where pagination does not apply', () => {
	test(
		'PAG-08: an album shows every gallery, whatever its page size',
		{ tag: '@layout' },
		async ({ page }) => {
			const galleries = Array.from(
				{ length: 4 },
				(_, i) =>
					galleryPage(
						{ layout: 'grid' },
						sixty().slice(i * 2, i * 2 + 2)
					).id
			);
			const { id, url } = album(galleries, {
				pagination_type: 'paginated',
				pagination_method: 'load_more',
				items_per_page: PER_PAGE(2),
			});

			await page.goto(url);
			const root = page.locator(`[data-fg-album-id="${id}"]`);
			await expect(root.locator('.fg-item')).toHaveCount(4);
			await expect(root.locator('.fg-pagination')).toHaveCount(0);
		}
	);

	test(
		'PAG-08: a slider shows every item and no pagination',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = paginated('load_more', { layout: 'slider' });
			const gallery = await open(page, url, id);

			await expect(gallery.items()).toHaveCount(60);
			await expect(gallery.root.locator('.fg-pagination')).toHaveCount(0);
		}
	);
});

/** Records the page number of every render request sent for one gallery. */
function renderRequests(page: Page, galleryId: number): number[] {
	const pages: number[] = [];
	page.on('request', (request) => {
		if (
			request.method() !== 'POST' ||
			!decodeURIComponent(request.url()).includes(
				'/fotogrids/v1/gallery/render'
			)
		) {
			return;
		}
		const body = request.postDataJSON() ?? {};
		if (Number(body.gallery_id) === galleryId) {
			pages.push(Number(body.page));
		}
	});
	return pages;
}

/**
 * Preload Next Page: with the setting on, each page is requested once, ahead
 * of the visitor asking for it, and the items shown match the setting off.
 */
test.describe('Preload Next Page', () => {
	test(
		'PRE-01: Load More requests each page once, ahead of the click',
		{ tag: ['@layout', '@critical'] },
		async ({ page }) => {
			const seen: Record<string, number[]> = {};

			for (const preload of [true, false]) {
				const { id, url } = paginated('load_more', {
					preload_next_page: preload,
				});
				const pages = renderRequests(page, id);
				const gallery = await open(page, url, id);
				const button = gallery.root.locator(
					'.fg-pagination__load-more'
				);

				if (preload) {
					await expect.poll(() => [...pages]).toEqual([2]);
				}
				await button.click();
				await expect(gallery.items()).toHaveCount(24);
				if (preload) {
					await expect.poll(() => [...pages]).toEqual([2, 3]);
				}
				await button.click();
				await expect(gallery.items()).toHaveCount(36);

				if (preload) {
					await expect.poll(() => [...pages]).toEqual([2, 3, 4]);
				} else {
					await page.waitForTimeout(500);
					expect(pages).toEqual([2, 3]);
				}
				seen[String(preload)] = await shown(gallery);
			}

			expect(seen.true).toEqual(sixty().slice(0, 36));
			expect(seen.true).toEqual(seen.false);
		}
	);

	test(
		'PRE-02: endless scroll requests each page once',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = paginated('endless_scroll', {
				columns: PER_PAGE(2),
				preload_next_page: true,
			});
			await page.setViewportSize({ width: 1280, height: 600 });
			const pages = renderRequests(page, id);
			const gallery = await open(page, url, id);

			for (const count of [24, 36, 48, 60]) {
				await gallery.root
					.locator('[data-fg-pagination-sentinel]')
					.scrollIntoViewIfNeeded();
				await expect(gallery.items()).toHaveCount(count);
			}
			await page.waitForTimeout(500);

			expect(pages).toEqual([2, 3, 4, 5]);
			expect(await shown(gallery)).toEqual(sixty());
		}
	);

	test(
		'PRE-03: page buttons request the next page once, ahead of Next',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = paginated('pages', {
				pages_truncate: false,
				preload_next_page: true,
			});
			const pages = renderRequests(page, id);
			const gallery = await open(page, url, id);
			const nav = gallery.root.locator('.fg-pagination--pages');
			const next = nav.locator('.fg-pagination__next');
			const current = nav.locator('[aria-current="page"]');

			await expect.poll(() => [...pages]).toEqual([2]);
			await next.click();
			await expect(current).toHaveText('2');
			await expect.poll(() => [...pages]).toEqual([2, 3]);
			await next.click();
			await expect(current).toHaveText('3');
			await expect.poll(() => [...pages]).toEqual([2, 3, 4]);

			expect(await shown(gallery)).toEqual(sixty().slice(24, 36));
		}
	);
});
