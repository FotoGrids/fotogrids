import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { Lightbox } from './support/lightbox';
import {
	PER_PAGE,
	expectCoverage,
	expectFullRows,
	justified,
	open,
	resize,
	shapes,
	shownIds,
	shownSequence,
	walk,
	type Method,
} from './support/justified';

/**
 * Justified galleries whose sequence changes or is reordered: tag filters,
 * sort orders, random order in each mode, and the lightbox walking past what
 * is loaded.
 */

test.describe.configure({ timeout: 120000 });

const FEW = () => shapes(7);
const QUARTER = () => shapes(120).filter((_, i) => 0 === i % 4);

const FILTERING = { filtering_enabled: true, filter_display_mode: 'always' };

async function choose(
	page: import('@playwright/test').Page,
	gallery: import('./support/gallery-render').GalleryRender,
	label: RegExp
): Promise<void> {
	await gallery.root
		.locator('.fg-filter-group button, .fg-filter-group label', {
			hasText: label,
		})
		.first()
		.click();
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(400);
}

async function reset(
	page: import('@playwright/test').Page,
	gallery: import('./support/gallery-render').GalleryRender
): Promise<void> {
	await gallery.root.locator('[data-fg-filter-all="true"]').first().click();
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(400);
}

test.describe('filters', () => {
	test(
		'FLT-01: a filter whose set fits one page hides the controls',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = justified(FILTERING, shapes(120));
			const gallery = await open(page, url, id);

			await choose(page, gallery, /^Shape few/);

			expect(await shownIds(gallery)).toEqual(FEW());
			await expect(
				gallery.root.locator('[data-fg-pagination-trigger="load-more"]')
			).toBeHidden();
		}
	);

	for (const method of ['load_more', 'pages', 'endless_scroll'] as Method[]) {
		test(
			`FLT-02/03: ${method}, a three-page filter then reset reach every item once`,
			{ tag: ['@layout', '@critical'] },
			async ({ page }) => {
				const items = shapes(120);
				const { id, url } = justified(
					{ ...FILTERING, pagination_method: method },
					items
				);
				const gallery = await open(page, url, id);

				await choose(page, gallery, /^Shape quarter/);
				await expectFullRows(gallery, 0);
				expectCoverage(
					await walk(method, page, gallery, {
						rowsFull: 'endless_scroll' !== method,
					}),
					QUARTER(),
					'filtered'
				);

				await reset(page, gallery);
				await expectFullRows(gallery, 0);
				expectCoverage(
					await walk(method, page, gallery, {
						rowsFull: 'endless_scroll' !== method,
					}),
					items,
					'reset'
				);
			}
		);
	}

	test(
		'FLT-04: filter, resize, page, then reset',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(120);
			const { id, url } = justified(FILTERING, items);
			const gallery = await open(page, url, id);

			await choose(page, gallery, /^Shape quarter/);
			await resize(page, 800);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				QUARTER(),
				'filtered'
			);
			await reset(page, gallery);
			await resize(page, 1280);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items,
				'reset'
			);
		}
	);

	test(
		'FLT-05: multiple selection shows the union, in sequence order',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(120);
			const { id, url } = justified(
				{ ...FILTERING, filtering_multiple_enabled: true },
				items
			);
			const gallery = await open(page, url, id);

			await choose(page, gallery, /^Shape quarter/);
			await choose(page, gallery, /^Shape few/);

			const union = items.filter((itemId, i) => 0 === i % 4 || i < 7);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				union
			);
		}
	);

	for (const style of ['checkboxes', 'dropdowns']) {
		test(
			`FLT-05: the ${style} filter style pages the same way`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { id, url } = justified(
					{ ...FILTERING, filter_ui_style: style },
					shapes(120)
				);
				const gallery = await open(page, url, id);

				if ('dropdowns' === style) {
					await gallery.root
						.locator('.fg-filter-dropdown-trigger')
						.first()
						.click();
					await gallery.root
						.locator('.fg-filter-dropdown-list [role="option"]', {
							hasText: /^Shape quarter/,
						})
						.first()
						.click();
				} else {
					await gallery.root
						.locator('label', { hasText: /^Shape quarter/ })
						.first()
						.click();
				}
				await page.waitForLoadState('networkidle');
				await page.waitForTimeout(400);

				expectCoverage(
					await walk('load_more', page, gallery, { rowsFull: true }),
					QUARTER()
				);
			}
		);
	}

	test(
		'FLT-06: a filter sidebar narrows the track, and rows still fill it',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified(
				{ ...FILTERING, filter_ui_position: 'sidebar' },
				items
			);
			const gallery = await open(page, url, id);

			await expectFullRows(gallery, 0);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'FLT-07: the cache strategy restores a filtered view taken at another width',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(120);
			const { id, url } = justified(FILTERING, items);
			const gallery = await open(page, url, id);
			await gallery.root.evaluate((el) =>
				el.setAttribute('data-fg-filter-strategy', 'cache')
			);

			await choose(page, gallery, /^Shape quarter/);
			await gallery.root
				.locator('[data-fg-pagination-trigger="load-more"]')
				.click();
			await page.waitForLoadState('networkidle');
			await reset(page, gallery);
			await resize(page, 800);
			await choose(page, gallery, /^Shape quarter/);

			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				QUARTER()
			);
		}
	);

	test(
		'FLT-08: Show All with a filter repacks the visible items',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'justified',
					pagination_type: 'show_all',
					...FILTERING,
				},
				shapes(120)
			);
			const gallery = await open(page, url, id);

			await choose(page, gallery, /^Shape quarter/);

			expect(await shownIds(gallery)).toEqual(QUARTER());
			await expectFullRows(gallery);
		}
	);
});

test.describe('sort', () => {
	for (const order of ['date', 'title', 'filename']) {
		test(
			`SRT-01: sorted by ${order}, every item once in sequence order`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(60);
				const { id, url } = justified(
					{ default_sort_order: order },
					items
				);
				const gallery = await open(page, url, id);

				const result = await walk('load_more', page, gallery, {
					rowsFull: true,
				});
				expect([...result.seen].sort((a, b) => a - b)).toEqual(
					[...items].sort((a, b) => a - b)
				);
				expect(await shownSequence(gallery)).toEqual(
					items.map((_, i) => i)
				);
			}
		);
	}

	for (const mode of ['refetch', 'reorder', 'uncached']) {
		for (const method of ['load_more', 'pages'] as Method[]) {
			test(
				`SRT-02: random ${mode}, ${method}, every item once`,
				{ tag: '@layout' },
				async ({ page }) => {
					const items = shapes(60);
					const { id, url } = justified(
						{
							default_sort_order: 'random',
							random_mode: mode,
							pagination_method: method,
							enable_cache: false,
						},
						items
					);
					const gallery = await open(page, url, id);

					const result = await walk(method, page, gallery, {
						rowsFull: true,
					});
					expect(
						result.seen.filter(
							(v, i) => result.seen.indexOf(v) !== i
						)
					).toEqual([]);
					expect([...result.seen].sort((a, b) => a - b)).toEqual(
						[...items].sort((a, b) => a - b)
					);
				}
			);
		}
	}

	test(
		'SRT-02: random refetch with a filter sends the filter and pages the filtered set',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = justified(
				{
					...FILTERING,
					default_sort_order: 'random',
					random_mode: 'refetch',
					enable_cache: false,
				},
				shapes(120)
			);
			const gallery = await open(page, url, id);

			await choose(page, gallery, /^Shape quarter/);
			const result = await walk('load_more', page, gallery, {
				rowsFull: true,
			});

			expect([...result.seen].sort((a, b) => a - b)).toEqual(
				[...QUARTER()].sort((a, b) => a - b)
			);
		}
	);
});

test.describe('lightbox', () => {
	async function walkLightbox(
		page: import('@playwright/test').Page,
		from: import('@playwright/test').Locator
	): Promise<Set<string>> {
		const lightbox = new Lightbox(page);
		await from.click();
		await expect(lightbox.dialog()).toBeVisible({ timeout: 15000 });
		const seen = new Set<string>();
		for (let guard = 0; guard < 200; guard++) {
			await expect(lightbox.image()).toHaveJSProperty('complete', true, {
				timeout: 15000,
			});
			seen.add((await lightbox.currentSrc()) ?? '');
			const next = lightbox.next();
			if (!(await next.isVisible()) || (await next.isDisabled())) {
				break;
			}
			const before = await lightbox.index();
			await next.click();
			await expect
				.poll(() => lightbox.index(), { timeout: 15000 })
				.not.toBe(before);
			if (0 === (await lightbox.index())) {
				break;
			}
		}
		return seen;
	}

	test(
		'LBX-01: from the last loaded item the lightbox reaches every item',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = justified(
				{ lightbox_show_dots: true, lightbox_loop: false },
				items
			);
			const gallery = await open(page, url, id);
			const shown = await shownIds(gallery);

			const last = gallery.root
				.locator(
					`[data-fg-item-id="${shown[shown.length - 1]}"] [data-fg-lightbox-trigger], [data-fg-item-id="${shown[shown.length - 1]}"][data-fg-lightbox-trigger]`
				)
				.first();
			const seen = await walkLightbox(page, last);

			expect(seen.size).toBe(items.length - shown.length + 1);
		}
	);

	test(
		'LBX-02: after a Page Buttons re-cut the lightbox still reaches every item',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = justified(
				{
					pagination_method: 'pages',
					lightbox_show_dots: true,
					lightbox_loop: false,
				},
				items
			);
			const gallery = await open(page, url, id);
			await gallery.root.evaluate(
				(el) => ((el as HTMLElement).style.maxWidth = '380px')
			);
			await page.waitForTimeout(600);
			await page.waitForLoadState('networkidle');

			const seen = await walkLightbox(
				page,
				gallery.root.locator('[data-fg-lightbox-trigger]').first()
			);
			expect(seen.size).toBe(items.length);
		}
	);

	test(
		'LBX-02: with Max Rows in Show All the lightbox still reaches every item',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = galleryPage(
				{
					layout: 'justified',
					pagination_type: 'show_all',
					layout_justified_max_rows: 2,
					lightbox_show_dots: true,
					lightbox_loop: false,
				},
				items
			);
			const gallery = await open(page, url, id);

			const seen = await walkLightbox(
				page,
				gallery.root.locator('[data-fg-lightbox-trigger]').first()
			);
			expect(seen.size).toBe(items.length);
		}
	);

	test(
		'LBX-02: after a filter the lightbox walks the filtered set',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = justified(
				{
					...FILTERING,
					lightbox_show_dots: true,
					lightbox_loop: false,
				},
				shapes(120)
			);
			const gallery = await open(page, url, id);
			await choose(page, gallery, /^Shape quarter/);

			const seen = await walkLightbox(
				page,
				gallery.root.locator('[data-fg-lightbox-trigger]').first()
			);
			expect(seen.size).toBe(QUARTER().length);
		}
	);
});

test(
	'fixture sanity: F-shapes holds 120 items with mixed shapes',
	{ tag: '@layout' },
	() => {
		const ratios = fixture<number[]>('F-shapes', 'ratios');
		expect(ratios).toHaveLength(120);
		expect(Math.min(...ratios)).toBeLessThan(0.5);
		expect(Math.max(...ratios)).toBeGreaterThan(3);
		expect(PER_PAGE(1)).toEqual({ desktop: 1, tablet: 1, mobile: 1 });
	}
);
