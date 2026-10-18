import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import {
	expectControlsDone,
	expectCoverage,
	expectFullRows,
	expectRowHeights,
	finalRow,
	justified,
	type Method,
	open,
	PER_PAGE,
	resize,
	rows,
	settle,
	shapes,
	shownIds,
	shownSequence,
	walk,
	walkLoadMore,
	walkPages,
} from './support/justified';

/**
 * Justified row building and the settings that shape rows: row height, gap,
 * tolerance, image shapes, item decorations, captions, Last Row Behavior,
 * Max Rows, the Match trailing row, and guards for the other layouts.
 */

test.describe.configure({ timeout: 120000 });

const SHOW_ALL = { layout: 'justified', pagination_type: 'show_all' };
const LAST_ROW = ['nojustify', 'justify', 'left', 'center', 'right', 'hide'];

test.describe('rows and geometry', () => {
	for (const height of [40, 140, 600]) {
		test(
			`ROW-01: row height ${height} at 390 and 1280`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(60);
				const { id, url } = justified(
					{
						layout_justified_row_height: {
							desktop: height,
							tablet: height,
							mobile: height,
						},
					},
					items
				);
				for (const width of [1280, 390]) {
					await page.setViewportSize({ width, height: 900 });
					const gallery = await open(page, url, id);
					await expectFullRows(gallery, 0);
					await expectRowHeights(gallery, height);
					expectCoverage(
						await walk('load_more', page, gallery, {
							rowsFull: true,
						}),
						items,
						`${width}px`
					);
				}
			}
		);
	}

	for (const spacing of [
		{ desktop: 0, tablet: 0, mobile: 0 },
		{ desktop: 40, tablet: 40, mobile: 40 },
		{
			desktop: { value: 1.5, unit: 'em' },
			tablet: { value: 1, unit: 'em' },
			mobile: { value: 0.5, unit: 'em' },
		},
		{ desktop: 12 },
	]) {
		test(
			`ROW-02: gap ${JSON.stringify(spacing)} at 390, 800 and 1280`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(60);
				const { id, url } = justified({ item_spacing: spacing }, items);
				for (const width of [1280, 800, 390]) {
					await page.setViewportSize({ width, height: 900 });
					const gallery = await open(page, url, id);
					await expectFullRows(gallery, 0);
					expectCoverage(
						await walk('load_more', page, gallery, {
							rowsFull: true,
						}),
						items,
						`${width}px`
					);
				}
			}
		);
	}

	test(
		'ROW-03: row height unset on tablet and mobile',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified(
				{ layout_justified_row_height: { desktop: 260 } },
				items
			);
			for (const width of [800, 390]) {
				await page.setViewportSize({ width, height: 900 });
				const gallery = await open(page, url, id);
				await expectFullRows(gallery, 0);
				expectCoverage(
					await walk('load_more', page, gallery, { rowsFull: true }),
					items,
					`${width}px`
				);
			}
		}
	);

	for (const tolerance of [0, 25, 100]) {
		test(
			`ROW-04: tolerance ${tolerance} bounds every row and decides whether a short final row is stretched`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(23);
				const { id, url } = galleryPage(
					{
						...SHOW_ALL,
						layout_justified_row_height_tolerance: tolerance,
					},
					items
				);
				const gallery = await open(page, url, id);

				const final = await gallery.root.evaluate((root) => {
					const track = root.querySelector(
						'.fg-justified-track'
					) as HTMLElement;
					const boxes = [
						...track.querySelectorAll(':scope > .fg-item'),
					].map((n) => ({
						el: n as HTMLElement,
						box: n.getBoundingClientRect(),
					}));
					const lastTop = Math.max(
						...boxes.map((b) => Math.round(b.box.top))
					);
					const last = boxes.filter(
						(b) => Math.round(b.box.top) === lastTop
					);
					const aspects = last.map((b) => {
						const img = b.el.querySelector(
							'img'
						) as HTMLImageElement;
						return (
							Number(img.getAttribute('width')) /
							Number(img.getAttribute('height'))
						);
					});
					const gap =
						parseFloat(getComputedStyle(track).columnGap) || 0;
					const width = track.getBoundingClientRect().width;
					const stretched =
						(width - gap * (last.length - 1)) /
						aspects.reduce((a, b) => a + b, 0);
					const used =
						Math.max(...last.map((b) => b.box.right)) -
						Math.min(...last.map((b) => b.box.left));
					return { stretched, used, width };
				});
				const within =
					Math.abs(final.stretched - 220) / 220 <= tolerance / 100;
				if (within) {
					expect(
						Math.abs(final.used - final.width)
					).toBeLessThanOrEqual(1);
				} else {
					expect(final.used).toBeLessThan(final.width - 1);
				}
				await expectRowHeights(gallery, 220, tolerance);
			}
		);
	}

	const ratios = () => fixture<number[]>('F-shapes', 'ratios');
	for (const [name, pick] of [
		['near-uniform landscape', () => fixture<number[]>('F-large', 'items')],
		['all portrait', () => shapes().filter((_, i) => ratios()[i] < 1)],
		['all panorama', () => shapes().filter((_, i) => ratios()[i] > 2)],
		['one item', () => shapes(1)],
	] as Array<[string, () => number[]]>) {
		test(`ROW-05: ${name}`, { tag: '@layout' }, async ({ page }) => {
			const items = pick();
			const { id, url } = justified({}, items);
			const gallery = await open(page, url, id);
			await expectFullRows(gallery, items.length > 12 ? 0 : 1);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items,
				name
			);
		});
	}

	test(
		"ROW-06: items without stored dimensions use the file's real shape and page correctly",
		{ tag: '@layout' },
		async ({ page }) => {
			const nodims = fixture<number[]>('F-shapes', 'nodims');
			const items = [...shapes(10), ...nodims, ...shapes(30).slice(10)];
			const { id, url } = justified({}, items);
			const gallery = await open(page, url, id);

			for (const itemId of nodims) {
				const img = gallery.root
					.locator(`[data-fg-item-id="${itemId}"] img`)
					.first();
				await expect(img).toHaveAttribute('width', '300');
				await expect(img).toHaveAttribute('height', '300');
			}
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'ROW-07: video and embed items mixed with images',
		{ tag: '@layout' },
		async ({ page }) => {
			const media = [
				fixture<number>('F-mixed', 'video'),
				fixture<number>('F-mixed', 'youtube'),
				fixture<number>('F-mixed', 'vimeo'),
			];
			const items = [...shapes(6), ...media, ...shapes(30).slice(6)];
			const { id, url } = justified({}, items);
			const gallery = await open(page, url, id);

			await expectFullRows(gallery, 0);
			// Video and embed items carry no item id, so coverage is by position.
			await walk('load_more', page, gallery, { rowsFull: true });
			expect(await shownSequence(gallery)).toEqual(
				items.map((_, i) => i)
			);
		}
	);

	test(
		'ROW-08: borders, radius, shadow and a hover zoom never push a row past the track',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = justified(
				{
					border_enabled: true,
					border_width: { desktop: 4, tablet: 4, mobile: 4 },
					border_radius: { desktop: 12, tablet: 12, mobile: 12 },
					shadow_enabled: true,
					hover_effects: true,
					hover_effect: 'zoom',
				},
				items
			);
			const gallery = await open(page, url, id);

			await expectFullRows(gallery, 0);
			await gallery.root.locator('.fg-item').nth(2).hover();
			await expectFullRows(gallery, 0);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'ROW-09: caption placement does not change where rows break',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const counts: Record<string, number[]> = {};
			for (const placement of ['overlay', 'top', 'bottom']) {
				const { id, url } = galleryPage(
					{ ...SHOW_ALL, caption_placement: placement },
					items
				);
				const gallery = await open(page, url, id);
				counts[placement] = (await rows(gallery)).rows.map(
					(r) => r.items
				);
			}
			expect(counts.top).toEqual(counts.overlay);
			expect(counts.bottom).toEqual(counts.overlay);
		}
	);
});

test.describe('last row', () => {
	async function expectFinalRowAs(
		gallery: import('./support/gallery-render').GalleryRender,
		value: string
	): Promise<void> {
		const row = await finalRow(gallery);
		const slack = row.track - row.width;
		if ('justify' === value) {
			expect(Math.abs(slack)).toBeLessThanOrEqual(1);
			return;
		}
		if (slack <= 1) {
			return;
		}
		if ('center' === value) {
			expect(Math.abs(row.left - slack / 2)).toBeLessThanOrEqual(1.5);
		} else if ('right' === value) {
			expect(Math.abs(row.left - slack)).toBeLessThanOrEqual(1.5);
		} else {
			expect(row.left).toBeLessThanOrEqual(1);
		}
	}

	for (const value of LAST_ROW) {
		test(
			`LR-01/02: Show All, ${value}, at three widths`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(23);
				const { id, url } = galleryPage(
					{ ...SHOW_ALL, layout_justified_last_row: value },
					items
				);
				const gallery = await open(page, url, id);
				for (const width of [1280, 800, 390]) {
					await resize(page, width);
					expect(
						await shownIds(gallery),
						'the final row is never hidden'
					).toEqual(items);
					await expectFinalRowAs(gallery, value);
					await expectFullRows(gallery);
				}
			}
		);

		for (const method of ['load_more', 'pages'] as Method[]) {
			test(
				`LR-03/04: Fill, ${method}, ${value}: page ends full, final row per setting`,
				{ tag: '@layout' },
				async ({ page }) => {
					const items = shapes(50);
					const { id, url } = justified(
						{
							pagination_method: method,
							layout_justified_last_row: value,
						},
						items
					);
					const gallery = await open(page, url, id);

					expectCoverage(
						await walk(method, page, gallery, { rowsFull: true }),
						items
					);
					await expectFinalRowAs(gallery, value);
				}
			);
		}
	}

	for (const value of ['nojustify', 'justify', 'left', 'center', 'right']) {
		test(
			`LR-05: Match, Page Buttons, ${value}: each page's trailing row styled like the final row`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(50);
				const { id, url } = justified(
					{
						pagination_method: 'pages',
						layout_justified_page_trailing_row: 'match',
						layout_justified_last_row: value,
					},
					items
				);
				const gallery = await open(page, url, id);

				await expectFinalRowAs(gallery, value);
				const result = await walkPages(page, gallery, {
					between: async () => expectFinalRowAs(gallery, value),
				});
				expectCoverage(result, items);
			}
		);
	}

	for (const method of ['load_more', 'pages', 'endless_scroll'] as Method[]) {
		test(
			`LR-06: Match + Hide, ${method}: no item is ever hidden or skipped`,
			{ tag: ['@layout', '@critical'] },
			async ({ page }) => {
				const items = shapes(60);
				const { id, url } = justified(
					{
						pagination_method: method,
						layout_justified_page_trailing_row: 'match',
						layout_justified_last_row: 'hide',
					},
					items
				);
				const gallery = await open(page, url, id);

				expectCoverage(
					await walk(method, page, gallery, {
						rowsFull: 'endless_scroll' !== method,
					}),
					items
				);
				await expectControlsDone(gallery, method);
			}
		);
	}

	test(
		'LR-07: Match, Load More: the trailing row joins the rows above once more items arrive',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = justified(
				{
					layout_justified_page_trailing_row: 'match',
					layout_justified_last_row: 'center',
				},
				items
			);
			const gallery = await open(page, url, id);

			const result = await walkLoadMore(page, gallery, {
				between: async () => expectFinalRowAs(gallery, 'center'),
			});
			expectCoverage(result, items);
			await expectFullRows(gallery);
		}
	);

	test(
		'LR-08: a filter that changes the final row re-applies the rule to it',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					...SHOW_ALL,
					layout_justified_last_row: 'center',
					filtering_enabled: true,
					filter_display_mode: 'always',
				},
				shapes(120)
			);
			const gallery = await open(page, url, id);

			await gallery.root
				.locator('.fg-filter-group button', {
					hasText: /^Shape quarter/,
				})
				.click();
			await page.waitForTimeout(500);

			await expectFinalRowAs(gallery, 'center');
		}
	);
});

test.describe('max rows', () => {
	for (const max of [0, 1, 3]) {
		test(
			`MR-01: Show All, Max Rows ${max}, at 1280 and 390`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(60);
				const { id, url } = galleryPage(
					{ ...SHOW_ALL, layout_justified_max_rows: max },
					items
				);
				const gallery = await open(page, url, id);
				for (const width of [1280, 390]) {
					await resize(page, width);
					const visible = (await rows(gallery)).rows.length;
					if (0 === max) {
						expect(await shownIds(gallery)).toEqual(items);
					} else {
						expect(visible).toBe(max);
					}
				}
			}
		);
	}

	for (const mode of ['fill', 'match']) {
		for (const method of [
			'load_more',
			'pages',
			'endless_scroll',
		] as Method[]) {
			test(
				`MR-02: ${mode}, ${method}, Max Rows 3 caps every page and loses nothing`,
				{ tag: '@layout' },
				async ({ page }) => {
					const items = shapes(60);
					const { id, url } = justified(
						{
							pagination_method: method,
							layout_justified_page_trailing_row: mode,
							layout_justified_max_rows: 3,
						},
						items
					);
					const gallery = await open(page, url, id);

					const perStep: number[] = [
						(await rows(gallery)).rows.length,
					];
					const result = await walk(method, page, gallery, {
						between: async () => {
							perStep.push((await rows(gallery)).rows.length);
						},
					});
					expectCoverage(result, items);
					if ('pages' === method) {
						perStep.forEach((count) =>
							expect(count).toBeLessThanOrEqual(3)
						);
					} else {
						perStep.forEach((count, i) =>
							expect(count).toBeLessThanOrEqual(3 * (i + 1))
						);
					}
				}
			);
		}
	}

	test(
		'MR-04: Max Rows per page holds across a resize and breakpoint crossing',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified(
				{ pagination_method: 'pages', layout_justified_max_rows: 2 },
				items
			);
			const gallery = await open(page, url, id);

			for (const width of [800, 390, 1280]) {
				await resize(page, width);
				expect((await rows(gallery)).rows.length).toBeLessThanOrEqual(
					2
				);
			}
			expectCoverage(
				await walk('pages', page, await open(page, url, id), {}),
				items
			);
		}
	);

	test(
		'MR-05: Max Rows with Last Row Hide never hides the final row',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(30);
			const { id, url } = justified(
				{
					layout_justified_max_rows: 3,
					layout_justified_last_row: 'hide',
				},
				items
			);
			const gallery = await open(page, url, id);

			expectCoverage(await walk('load_more', page, gallery), items);
		}
	);

	test(
		'MR-06: Max Rows with a filter applies to the filtered set',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = justified(
				{
					layout_justified_max_rows: 2,
					filtering_enabled: true,
					filter_display_mode: 'always',
				},
				shapes(120)
			);
			const gallery = await open(page, url, id);
			await gallery.root
				.locator('.fg-filter-group button', {
					hasText: /^Shape quarter/,
				})
				.click();
			await settle(page);
			await page.waitForTimeout(400);

			expect((await rows(gallery)).rows.length).toBeLessThanOrEqual(2);
			expectCoverage(
				await walk('load_more', page, gallery),
				shapes(120).filter((_, i) => 0 === i % 4)
			);
		}
	);
});

test.describe('match', () => {
	for (const total of [5, 12, 13, 25, 37, 60]) {
		for (const method of [
			'load_more',
			'pages',
			'endless_scroll',
		] as Method[]) {
			test(
				`MAT-01: ${method}, ${total} items, fixed pages of 12`,
				{ tag: '@layout' },
				async ({ page }) => {
					const items = shapes(total);
					const { id, url } = justified(
						{
							pagination_method: method,
							layout_justified_page_trailing_row: 'match',
						},
						items
					);
					const gallery = await open(page, url, id);

					const result = await walk(method, page, gallery);
					expectCoverage(result, items);
					if ('endless_scroll' === method) {
						return;
					}
					const sizes =
						'pages' === method
							? result.steps.map((s) => s.length)
							: result.steps.map(
									(s, i) =>
										s.length -
										(i ? result.steps[i - 1].length : 0)
								);
					sizes.slice(0, -1).forEach((size) => expect(size).toBe(12));
				}
			);
		}
	}

	test(
		'MAT-02: per-breakpoint targets apply from the first paint',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(30);
			const { id, url } = justified(
				{
					layout_justified_page_trailing_row: 'match',
					items_per_page: { desktop: 12, tablet: 8, mobile: 4 },
				},
				items
			);
			for (const [width, target] of [
				[1280, 12],
				[800, 8],
				[390, 4],
			]) {
				await page.setViewportSize({ width, height: 900 });
				const gallery = await open(page, url, id);
				await settle(page);
				expect(await shownIds(gallery)).toEqual(items.slice(0, target));
			}
		}
	);

	test(
		'MAT-03/04: a resize within and across breakpoints, Load More',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = justified(
				{
					layout_justified_page_trailing_row: 'match',
					items_per_page: { desktop: 12, tablet: 8, mobile: 4 },
				},
				items
			);
			const gallery = await open(page, url, id);
			const widths = [1100, 800, 390];

			const result = await walk('load_more', page, gallery, {
				between: async () => {
					const next = widths.shift();
					if (next) {
						await resize(page, next);
					}
				},
			});
			expectCoverage(result, items);
		}
	);

	test(
		'MAT-05: Page Buttons moves to the page holding the first item after a breakpoint change',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = justified(
				{
					pagination_method: 'pages',
					layout_justified_page_trailing_row: 'match',
					items_per_page: { desktop: 12, tablet: 8, mobile: 4 },
				},
				items
			);
			const gallery = await open(page, url, id);
			await gallery.root
				.locator('[data-fg-pagination-trigger="next"]')
				.click();
			await settle(page);
			const first = (await shownIds(gallery))[0];

			await resize(page, 390, 844);

			expect(await shownIds(gallery)).toContain(first);
			expect(
				await gallery.root
					.locator('[data-fg-pagination-trigger="page"]')
					.count()
			).toBe(Number(await gallery.attr('page-total')));
		}
	);
});

test.describe('regression guards', () => {
	for (const layout of ['grid', 'masonry']) {
		for (const method of [
			'load_more',
			'pages',
			'endless_scroll',
		] as Method[]) {
			for (const total of [5, 12, 13, 25]) {
				test(
					`REG-01: ${layout}, ${method}, ${total} items`,
					{ tag: '@layout' },
					async ({ page }) => {
						const items = shapes(total);
						const { id, url } = galleryPage(
							{
								layout,
								pagination_type: 'paginated',
								pagination_method: method,
								items_per_page: PER_PAGE(12),
							},
							items
						);
						for (const width of [1280, 390]) {
							await page.setViewportSize({ width, height: 900 });
							await page.goto(url);
							const gallery = new (
								await import('./support/gallery-render')
							).GalleryRender(page, id);
							await gallery.waitFor();
							await settle(page);
							expectCoverage(
								await walk(method, page, gallery),
								items,
								`${width}px`
							);
						}
					}
				);
			}
		}
	}

	test(
		'REG-02: a grid with smaller mobile pages re-pages once at 390',
		{ tag: '@layout' },
		async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			const items = shapes(30);
			const { id, url } = galleryPage(
				{
					layout: 'grid',
					pagination_type: 'paginated',
					items_per_page: { desktop: 12, tablet: 8, mobile: 4 },
				},
				items
			);
			await page.goto(url);
			await settle(page);
			const gallery = new (
				await import('./support/gallery-render')
			).GalleryRender(page, id);

			expect(await shownIds(gallery)).toEqual(items.slice(0, 4));
		}
	);

	for (const layout of [
		'grid',
		'masonry',
		'justified',
		'single-item',
		'slider',
		'image-viewer',
		'featured-item',
		'instant-photos',
	]) {
		test(
			`REG-03: ${layout} renders`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { id, url } = galleryPage({ layout }, shapes(8));
				await page.goto(url);
				await expect(
					page.locator(`[data-fg-gallery-id="${id}"]`).first()
				).toBeVisible();
			}
		);
	}

	for (const layout of ['grid', 'masonry']) {
		test(
			`REG-04: an album in ${layout} shows every gallery`,
			{ tag: '@layout' },
			async ({ page }) => {
				const children = [0, 1, 2].map(
					(n) => galleryPage({}, shapes(3 + n)).id
				);
				const made = album(children, { layout });
				await page.goto(made.url);
				await expect(
					page.locator(`[data-fg-album-id="${made.id}"] .fg-item`)
				).toHaveCount(3);
			}
		);
	}
});
