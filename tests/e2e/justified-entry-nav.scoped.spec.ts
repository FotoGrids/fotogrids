import { test, expect } from './support/test';
import {
	album,
	galleryPage,
	passwordGalleryPage,
	shortcodePage,
	multiGalleryPage,
} from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';
import {
	PER_PAGE,
	countRenders,
	expectControlsDone,
	expectCoverage,
	expectFullRows,
	justified,
	open,
	postWith,
	shapes,
	shownIds,
	walk,
	walkPages,
	type Method,
} from './support/justified';

/**
 * Justified galleries: every way page 1 reaches the visitor, and paging to the
 * end with each method. Each row asserts that every item is reached once, in
 * order, that page ends sit on full rows, and that the controls are right.
 */

const METHODS: Method[] = ['load_more', 'endless_scroll', 'pages'];

test.describe('entry', () => {
	for (const method of METHODS) {
		test(
			`ENT-01: Fill, ${method}, in the theme's content column`,
			{ tag: ['@layout', '@critical'] },
			async ({ page }) => {
				const items = shapes(25);
				const { id, url } = justified(
					{ pagination_method: method },
					items
				);

				let gallery!: GalleryRender;
				const renders = await countRenders(page, async () => {
					gallery = await open(page, url, id);
				});
				expect(
					renders,
					'page 1 is cut in the browser without a request'
				).toHaveLength(0);

				await expectFullRows(gallery, 0);
				const result = await walk(method, page, gallery, {
					rowsFull: true,
				});
				expectCoverage(result, items, method);
				await expectControlsDone(gallery, method);
			}
		);
	}

	for (const width of [390, 800]) {
		for (const method of ['load_more', 'pages'] as Method[]) {
			test(
				`ENT-02: Fill, ${method}, at ${width}px uses that breakpoint from the first paint`,
				{ tag: '@layout' },
				async ({ page }) => {
					await page.setViewportSize({ width, height: 900 });
					const items = shapes(25);
					const { id, url } = justified(
						{
							pagination_method: method,
							items_per_page: {
								desktop: 12,
								tablet: 8,
								mobile: 4,
							},
						},
						items
					);
					const gallery = await open(page, url, id);

					const first = await shownIds(gallery);
					const target = 390 === width ? 4 : 8;
					expect(first.length).toBeGreaterThanOrEqual(
						Math.max(1, target - Math.round(target * 0.2))
					);
					expect(first.length).toBeLessThan(12);
					await expectFullRows(gallery, 0);

					expectCoverage(
						await walk(method, page, gallery, { rowsFull: true }),
						items,
						`${method} ${width}`
					);
				}
			);
		}
	}

	test(
		'ENT-03: a gallery in a hidden container is cut once it is shown',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(25);
			const { id } = justified({}, items);
			const url = postWith(
				wpEval,
				`<div id="fg-hidden-tab" style="display:none">[fotogrids_gallery id="${id}"]</div>`
			);

			await page.goto(url);
			await page.evaluate(() => {
				(
					document.getElementById('fg-hidden-tab') as HTMLElement
				).style.display = 'block';
			});
			const gallery = new GalleryRender(page, id);
			await expect(gallery.root).toHaveAttribute(
				'data-fg-justified-packed',
				'1'
			);
			await page.waitForTimeout(400);

			await expectFullRows(gallery, 0);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'ENT-04: a password gallery pages correctly after unlocking',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(25);
			const { id, url } = passwordGalleryPage(
				'justified-secret',
				{
					layout: 'justified',
					pagination_type: 'paginated',
					pagination_method: 'load_more',
					items_per_page: PER_PAGE(12),
					password_remember: false,
				},
				items
			);
			await page.goto(url);
			const form = page.locator(`.fg-lock-form[data-gallery-id="${id}"]`);
			await form.locator('.fg-lock-input').fill('justified-secret');
			await form.locator('.fg-lock-submit').click();
			const gallery = new GalleryRender(page, id);
			await expect(gallery.root).toHaveAttribute(
				'data-fg-justified-packed',
				'1',
				{ timeout: 15000 }
			);

			await expectFullRows(gallery, 0);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'ENT-05: a gallery opened in place from an album pages correctly',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(25);
			const child = justified({}, items);
			const made = album([child.id], { use_ajax_from_album: true });

			await page.goto(made.url);
			await page
				.locator(`[data-fg-album-id="${made.id}"] .fg-item`)
				.first()
				.click();
			const gallery = new GalleryRender(page, child.id);
			await expect(gallery.root).toHaveAttribute(
				'data-fg-justified-packed',
				'1',
				{ timeout: 15000 }
			);

			await expectFullRows(gallery, 0);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'ENT-06: block, shortcode and View Page behave the same',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(25);
			const { id } = justified({}, items);
			const urls = {
				shortcode: shortcodePage(id, '').url,
				block: postWith(
					wpEval,
					`<!-- wp:fotogrids/gallery {"galleryId":${id}} /-->`
				),
				view: wpEval(`echo get_permalink( ${id} );`).trim(),
			};

			const firsts: Record<string, number[]> = {};
			for (const [placement, url] of Object.entries(urls)) {
				const gallery = await open(page, url, id);
				firsts[placement] = await shownIds(gallery);
				await expectFullRows(gallery, 0);
				expectCoverage(
					await walk('load_more', page, gallery, { rowsFull: true }),
					items,
					placement
				);
			}
			expect(firsts.block).toEqual(firsts.shortcode);
		}
	);

	test(
		'ENT-07: a second visit, served from the render cache, behaves like the first',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(25);
			const { id, url } = justified({ enable_cache: true }, items);

			const first = await shownIds(await open(page, url, id));
			const gallery = await open(page, url, id);

			expect(await shownIds(gallery)).toEqual(first);
			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'ENT-09: a justified album shows every gallery with full rows',
		{ tag: '@layout' },
		async ({ page }) => {
			const children = [0, 1, 2, 3, 4, 5, 6].map(
				(n) => galleryPage({}, shapes(3 + n)).id
			);
			const made = album(children, {
				layout: 'justified',
				layout_justified_last_row: 'hide',
			});

			await page.goto(made.url);
			const root = page.locator(`[data-fg-album-id="${made.id}"]`);
			await expect(root).toHaveAttribute('data-fg-justified-packed', '1');
			const shown = await root
				.locator('.fg-item')
				.evaluateAll(
					(nodes) =>
						nodes.filter(
							(n) => 'none' !== getComputedStyle(n).display
						).length
				);
			expect(shown).toBe(children.length);
		}
	);

	test(
		'ENT-10: without JavaScript, page 1 shows and overflow stays hidden',
		{ tag: '@layout' },
		async ({ browser }) => {
			const items = shapes(25);
			const { id, url } = justified({}, items);
			const context = await browser.newContext({
				javaScriptEnabled: false,
			});
			const page = await context.newPage();
			await page.goto(url);

			const visible = await page
				.locator(`[data-fg-gallery-id="${id}"] .fg-item`)
				.evaluateAll(
					(nodes) =>
						nodes.filter(
							(n) => 'none' !== getComputedStyle(n).display
						).length
				);
			const pageSize = Number(
				await page
					.locator(`[data-fg-gallery-id="${id}"]`)
					.getAttribute('data-fg-page-size')
			);
			expect(visible).toBe(pageSize);
			expect(
				await page
					.locator(
						`[data-fg-gallery-id="${id}"] [data-fg-overflow]:visible`
					)
					.count()
			).toBe(0);
			await context.close();
		}
	);

	for (const total of [5, 12, 13]) {
		test(
			`ENT-11: ${total} items fit one page, with no controls`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(total);
				for (const method of METHODS) {
					const { id, url } = justified(
						{ pagination_method: method },
						items
					);
					const gallery = await open(page, url, id);
					expect(await shownIds(gallery)).toEqual(items);
					await expect(
						gallery.root.locator(
							'[data-fg-pagination-trigger="load-more"]'
						)
					).toBeHidden();
					await expect(
						gallery.root.locator(
							'[data-fg-pagination-trigger="page"]:visible'
						)
					).toHaveCount(0);
					await expect(
						gallery.root.locator(
							'[data-fg-pagination-trigger="next"]:visible'
						)
					).toHaveCount(0);
				}
			}
		);
	}
});

test.describe('navigation', () => {
	for (const total of [13, 25, 37, 60, 120]) {
		test(
			`NAV-01: Load More reaches all ${total} items`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(total);
				const { id, url } = justified({}, items);
				const gallery = await open(page, url, id);

				expectCoverage(
					await walk('load_more', page, gallery, { rowsFull: true }),
					items
				);
				await expectControlsDone(gallery, 'load_more');
			}
		);
	}

	for (const total of [25, 60]) {
		test(
			`NAV-02: Endless Scroll reaches all ${total} items`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(total);
				const { id, url } = justified(
					{ pagination_method: 'endless_scroll' },
					items
				);
				const gallery = await open(page, url, id);

				expectCoverage(
					await walk('endless_scroll', page, gallery),
					items
				);
				await expectFullRows(gallery);
			}
		);
	}

	test(
		'NAV-03: Page Buttons, Next to the end and Prev back give the same pages',
		{ tag: ['@layout', '@critical'] },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified(
				{ pagination_method: 'pages' },
				items
			);
			const gallery = await open(page, url, id);

			const forward = await walkPages(page, gallery, { rowsFull: true });
			expectCoverage(forward, items);

			const prev = gallery.root.locator(
				'[data-fg-pagination-trigger="prev"]'
			);
			const backward = [await shownIds(gallery)];
			while (!(await prev.isDisabled())) {
				await prev.click();
				await page.waitForLoadState('networkidle');
				await page.waitForTimeout(250);
				backward.unshift(await shownIds(gallery));
			}
			expect(backward).toEqual(forward.steps);
		}
	);

	test(
		'NAV-04: jumping straight to a chip shows the same page as walking to it',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified(
				{ pagination_method: 'pages' },
				items
			);
			const gallery = await open(page, url, id);
			const forward = await walkPages(page, gallery);

			const fresh = await open(page, url, id);
			const chips = fresh.root.locator(
				'[data-fg-pagination-trigger="page"]'
			);
			const last = await chips.count();
			expect(last).toBe(forward.steps.length);

			await chips.nth(last - 1).click();
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(250);
			expect(await shownIds(fresh)).toEqual(forward.steps[last - 1]);

			const middle = Math.floor(last / 2);
			await chips.nth(middle).click();
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(250);
			expect(await shownIds(fresh)).toEqual(forward.steps[middle]);
		}
	);

	for (const variant of [
		{ pages_show_numbers: false },
		{ pages_show_prev_next: false },
		{ pages_truncate: true },
	]) {
		test(
			`NAV-05: Page Buttons with ${JSON.stringify(variant)} still reach every page`,
			{ tag: '@layout' },
			async ({ page }) => {
				const items = shapes(120);
				const { id, url } = justified(
					{ pagination_method: 'pages', ...variant },
					items
				);
				const gallery = await open(page, url, id);
				const total = Number(await gallery.attr('page-total'));
				const seen: number[] = [...(await shownIds(gallery))];

				for (let n = 2; n <= total; n++) {
					const next = gallery.root.locator(
						'[data-fg-pagination-trigger="next"]'
					);
					if (await next.count()) {
						await next.click();
					} else {
						await gallery.root
							.locator(
								`[data-fg-pagination-trigger="page"][data-fg-pagination-page="${n}"]`
							)
							.click();
					}
					await page.waitForLoadState('networkidle');
					await page.waitForTimeout(250);
					seen.push(...(await shownIds(gallery)));
				}
				expect(seen).toEqual(items);
			}
		);
	}

	test(
		'NAV-06: preloading the next page changes nothing the visitor sees',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(60);
			const { id, url } = justified({ preload_next_page: true }, items);
			const gallery = await open(page, url, id);

			expectCoverage(
				await walk('load_more', page, gallery, { rowsFull: true }),
				items
			);
		}
	);

	test(
		'NAV-07: two justified galleries and a grid on one page page independently',
		{ tag: '@layout' },
		async ({ page }) => {
			const fill = justified({}, shapes(25));
			const match = justified(
				{ layout_justified_page_trailing_row: 'match' },
				shapes(30).slice(5)
			);
			const grid = galleryPage(
				{
					layout: 'grid',
					pagination_type: 'paginated',
					pagination_method: 'load_more',
					items_per_page: PER_PAGE(12),
				},
				shapes(25)
			);
			const { url } = multiGalleryPage([fill.id, match.id, grid.id]);
			await page.goto(url);

			for (const [made, items] of [
				[fill, shapes(25)],
				[match, shapes(30).slice(5)],
				[grid, shapes(25)],
			] as Array<[{ id: number }, number[]]>) {
				const gallery = new GalleryRender(page, made.id);
				await gallery.waitFor();
				expectCoverage(
					await walk('load_more', page, gallery),
					items,
					`gallery ${made.id}`
				);
			}
		}
	);
});
