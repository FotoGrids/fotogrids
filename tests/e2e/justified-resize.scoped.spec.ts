import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import {
	countRenders,
	expectControlsDone,
	expectCoverage,
	expectFullRows,
	justified,
	open,
	resize,
	shapes,
	shownIds,
	walk,
	walkPages,
	type Method,
} from './support/justified';

/**
 * Justified galleries while the visitor's geometry changes: window resizes
 * within and across breakpoints, container changes without a window resize,
 * rotation and zoom. Append methods never re-request on a resize; Page Buttons
 * re-cuts only when the current page's boundaries move, and keeps the item the
 * visitor was looking at.
 */

const APPEND: Method[] = ['load_more', 'endless_scroll'];

test.describe('resize, append methods', () => {
	for (const method of APPEND) {
		test(
			`RSZ-01: ${method}, shrink within desktop between loads`,
			{ tag: ['@layout', '@critical'] },
			async ({ page }) => {
				const items = shapes(60);
				const { id, url } = justified(
					{ pagination_method: method },
					items
				);
				const gallery = await open(page, url, id);
				let resized = false;

				const result = await walk(method, page, gallery, {
					between: async () => {
						if (resized) {
							return;
						}
						resized = true;
						await gallery.root.evaluate(
							(el) =>
								((el as HTMLElement).style.maxWidth = '520px')
						);
						const renders = await countRenders(page, () =>
							resize(page, 1024)
						);
						expect(
							renders,
							'a resize in an append method makes no request'
						).toHaveLength(0);
					},
				});
				expectCoverage(result, items, method);
				await expectFullRows(gallery);
			}
		);

		test(
			`RSZ-02: ${method}, grow between loads`,
			{ tag: '@layout' },
			async ({ page }) => {
				await page.setViewportSize({ width: 700, height: 900 });
				const items = shapes(60);
				const { id, url } = justified(
					{ pagination_method: method },
					items
				);
				const gallery = await open(page, url, id);
				let resized = false;

				const result = await walk(method, page, gallery, {
					between: async () => {
						if (!resized) {
							resized = true;
							await resize(page, 1440);
						}
					},
				});
				expectCoverage(result, items, method);
				await expectFullRows(gallery);
			}
		);

		test(
			`RSZ-03: ${method}, cross desktop → tablet → desktop between loads`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(80);
				const { id, url } = justified(
					{
						pagination_method: method,
						items_per_page: { desktop: 12, tablet: 8, mobile: 4 },
					},
					items
				);
				const gallery = await open(page, url, id);
				const widths = [800, 1280, 800, 1280];

				const result = await walk(method, page, gallery, {
					between: async () => {
						const next = widths.shift();
						if (next) {
							await resize(page, next);
						}
					},
				});
				expectCoverage(result, items, method);
				await expectFullRows(gallery);
			}
		);
	}

	test(
		'RSZ-08: a rapid resize drag, Load More',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified({}, items);
			const gallery = await open(page, url, id);

			const renders = await countRenders(page, async () => {
				for (let w = 1280; w >= 700; w -= 30) {
					await page.setViewportSize({ width: w, height: 900 });
					await page.waitForTimeout(50);
				}
				await page.waitForTimeout(400);
			});
			expect(renders).toHaveLength(0);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'RSZ-09: a resize while a Load More is in flight',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified({}, items);
			const gallery = await open(page, url, id);
			await page.route(
				/gallery%2Frender|gallery\/render/,
				async (route) => {
					await new Promise((r) => setTimeout(r, 600));
					await route.continue();
				}
			);

			const button = gallery.root.locator(
				'[data-fg-pagination-trigger="load-more"]'
			);
			await button.click();
			await page.setViewportSize({ width: 760, height: 900 });
			await page.waitForTimeout(1200);
			await page.unroute(/gallery%2Frender|gallery\/render/);

			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'RSZ-10: the container narrows without a window resize, Load More',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified({}, items);
			const gallery = await open(page, url, id);
			let narrowed = false;

			const result = await walk('load_more', page, gallery, {
				between: async () => {
					if (!narrowed) {
						narrowed = true;
						await gallery.root.evaluate(
							(el) =>
								((el as HTMLElement).style.maxWidth = '420px')
						);
						await page.waitForTimeout(400);
					}
				},
			});
			expectCoverage(result, items);
			await expectFullRows(gallery);
		}
	);

	test(
		'RSZ-11: phone rotation between loads',
		{ tag: '@layout' },
		async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			const items = shapes(60);
			const { id, url } = justified(
				{ items_per_page: { desktop: 12, tablet: 8, mobile: 6 } },
				items
			);
			const gallery = await open(page, url, id);
			const sizes = [
				[844, 390],
				[390, 844],
				[844, 390],
			];

			const result = await walk('load_more', page, gallery, {
				between: async () => {
					const next = sizes.shift();
					if (next) {
						await resize(page, next[0], next[1]);
					}
				},
			});
			expectCoverage(result, items);
		}
	);

	test(
		'RSZ-12: zoom changes between loads',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified({}, items);
			const gallery = await open(page, url, id);
			const zooms = ['2', '0.5', '1'];

			const result = await walk('load_more', page, gallery, {
				between: async () => {
					const next = zooms.shift();
					if (next) {
						await page.evaluate(
							(z) => (document.documentElement.style.zoom = z),
							next
						);
						await page.waitForTimeout(400);
					}
				},
			});
			expectCoverage(result, items);
		}
	);
});

test.describe('resize, Page Buttons', () => {
	async function toPage(
		page: import('@playwright/test').Page,
		gallery: import('./support/gallery-render').GalleryRender,
		n: number
	): Promise<void> {
		for (let i = 1; i < n; i++) {
			await gallery.root
				.locator('[data-fg-pagination-trigger="next"]')
				.click();
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(250);
		}
	}

	test(
		'RSZ-05: on page 3, a shrink that moves the cut re-cuts once and keeps the first item in view',
		{ tag: ['@layout', '@critical'] },
		async ({ page }) => {
			const items = shapes(120);
			const { id, url } = justified(
				{ pagination_method: 'pages' },
				items
			);
			const gallery = await open(page, url, id);
			await toPage(page, gallery, 3);
			const first = (await shownIds(gallery))[0];

			const renders = await countRenders(page, async () => {
				await gallery.root.evaluate(
					(el) => ((el as HTMLElement).style.maxWidth = '380px')
				);
				await page.waitForTimeout(500);
			});
			expect(renders).toHaveLength(1);
			expect(await shownIds(gallery)).toContain(first);
			await expectFullRows(gallery, 0);
			const chips = await gallery.root
				.locator('[data-fg-pagination-trigger="page"]')
				.count();
			expect(chips).toBe(Number(await gallery.attr('page-total')));

			const rest = await walkPages(page, gallery, { rowsFull: true });
			const before = items.slice(0, items.indexOf(rest.steps[0][0]));
			expect([...before, ...rest.seen]).toEqual(items);
		}
	);

	test(
		'RSZ-06: a window resize that leaves the container width alone makes no request',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified(
				{ pagination_method: 'pages' },
				items
			);
			const gallery = await open(page, url, id);
			await toPage(page, gallery, 2);
			const width = await gallery.root.evaluate(
				(el) => el.getBoundingClientRect().width
			);
			const shown = await shownIds(gallery);

			const renders = await countRenders(page, () => resize(page, 1200));
			const after = await gallery.root.evaluate(
				(el) => el.getBoundingClientRect().width
			);
			test.skip(
				Math.abs(after - width) >= 1,
				'the theme column changed width at 1200px'
			);

			expect(renders).toHaveLength(0);
			expect(await shownIds(gallery)).toEqual(shown);
		}
	);

	test(
		'RSZ-07: on the last page, a shrink that adds pages keeps the first item and enables Next',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified(
				{ pagination_method: 'pages' },
				items
			);
			const gallery = await open(page, url, id);
			const total = Number(await gallery.attr('page-total'));
			await toPage(page, gallery, total);
			const first = (await shownIds(gallery))[0];

			await resize(page, 390, 844);

			expect(await shownIds(gallery)).toContain(first);
			const now = Number(await gallery.attr('page-current'));
			const nowTotal = Number(await gallery.attr('page-total'));
			expect(nowTotal).toBeGreaterThanOrEqual(total);
			if (now < nowTotal) {
				await expect(
					gallery.root.locator('[data-fg-pagination-trigger="next"]')
				).toBeEnabled();
			}
		}
	);

	test(
		'RSZ-08: a rapid resize drag re-cuts at most once',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(120);
			const { id, url } = justified(
				{ pagination_method: 'pages' },
				items
			);
			const gallery = await open(page, url, id);
			await toPage(page, gallery, 3);

			const renders = await countRenders(page, async () => {
				for (let w = 640; w >= 360; w -= 14) {
					await gallery.root.evaluate(
						(el, px) =>
							((el as HTMLElement).style.maxWidth = `${px}px`),
						w
					);
					await page.waitForTimeout(50);
				}
				await page.waitForTimeout(500);
			});
			expect(renders.length).toBeLessThanOrEqual(1);
			await expectFullRows(gallery, 0);
		}
	);

	test(
		'RSZ-11: phone rotation on page 2',
		{ tag: '@layout' },
		async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			const items = shapes(60);
			const { id, url } = justified(
				{
					pagination_method: 'pages',
					items_per_page: { desktop: 12, tablet: 8, mobile: 6 },
				},
				items
			);
			const gallery = await open(page, url, id);
			await toPage(page, gallery, 2);
			const first = (await shownIds(gallery))[0];

			await resize(page, 844, 390);

			expect(await shownIds(gallery)).toContain(first);
			await expectFullRows(gallery, 0);
		}
	);
});

test(
	'RSZ-13: Show All repacks on resize across breakpoints, with full rows above the last',
	{ tag: '@layout' },
	async ({ page }) => {
		const items = shapes(40);
		const { id, url } = galleryPage(
			{ layout: 'justified', pagination_type: 'show_all' },
			items
		);
		const gallery = await open(page, url, id);

		for (const width of [1280, 800, 390, 1440]) {
			await resize(page, width);
			expect(await shownIds(gallery)).toEqual(items);
			await expectFullRows(gallery);
		}
	}
);

test(
	'RSZ-04: endless scroll survives a resize across breakpoints mid-scroll',
	{ tag: '@layout' },
	async ({ page }) => {
		const items = shapes(60);
		const { id, url } = justified(
			{
				pagination_method: 'endless_scroll',
				items_per_page: { desktop: 12, tablet: 8, mobile: 4 },
			},
			items
		);
		const gallery = await open(page, url, id);
		const widths = [800, 390, 1280];

		const result = await walk('endless_scroll', page, gallery, {
			between: async () => {
				const next = widths.shift();
				if (next) {
					await resize(page, next);
				}
			},
		});
		expectCoverage(result, items);
		await expectControlsDone(gallery, 'endless_scroll');
	}
);
