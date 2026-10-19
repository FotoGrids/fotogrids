import type { Page, Route } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * Random sort, refetch mode: whatever happens to the refetch of page 1, every
 * later page and every Lightbox slide comes from the order on screen, so each
 * item of the gallery is reachable exactly once.
 *
 * Only the refetch is altered - delayed past the hold, answered with an
 * error, or aborted. Every other request reaches the server unchanged.
 *
 * scoped: each test renders its own gallery.
 */

const sixty = (): number[] => fixture<number[]>('F-large', 'items');
const PER_PAGE = { desktop: 12, tablet: 12, mobile: 12 };

type Refetch = 'on time' | 'late' | 'http 403' | 'network error';
const OUTCOMES: Refetch[] = ['on time', 'late', 'http 403', 'network error'];

const isRender = (url: URL): boolean =>
	decodeURIComponent(url.toString()).includes('/fotogrids/v1/gallery/render');

/** Alters the first render request - the random-sort refetch - per outcome. */
async function alterRefetch(page: Page, outcome: Refetch): Promise<void> {
	let first = true;
	await page.route(isRender, async (route: Route) => {
		if (!first || 'on time' === outcome) {
			first = false;
			return route.continue();
		}
		first = false;
		if ('late' === outcome) {
			const response = await route.fetch();
			await new Promise((resolve) => setTimeout(resolve, 1200));
			return route.fulfill({ response });
		}
		if ('http 403' === outcome) {
			return route.fulfill({
				status: 403,
				contentType: 'application/json',
				body: '{"code":"rest_cookie_invalid_nonce","data":{"status":403}}',
			});
		}
		return route.abort('failed');
	});
}

/** The browser logs the altered refetch's 403 or network error. */
const LOGS_ERROR: Refetch[] = ['http 403', 'network error'];

/**
 * Declares a test for one refetch outcome. Outcomes that make the browser log
 * the failed request opt out of the console guard, and assert instead that
 * the page threw no exception.
 */
function outcomeTest(
	outcome: Refetch,
	title: string,
	tag: string[],
	body: (page: Page) => Promise<void>
): void {
	const declare = () =>
		test(title, { tag }, async ({ page }) => {
			const thrown: string[] = [];
			page.on('pageerror', (error) => thrown.push(error.message));
			await body(page);
			expect(thrown).toEqual([]);
		});

	if (!LOGS_ERROR.includes(outcome)) {
		declare();
		return;
	}
	test.describe(() => {
		test.use({
			allowConsoleErrors:
				'the refetch is answered with an error, which the browser logs',
		});
		declare();
	});
}

function randomGallery(settings: Record<string, unknown>) {
	return galleryPage(
		{
			layout: 'grid',
			default_sort_order: 'random',
			random_mode: 'refetch',
			pagination_type: 'paginated',
			items_per_page: PER_PAGE,
			...settings,
		},
		sixty()
	);
}

/**
 * Opens the gallery and waits until the refetch has settled either way.
 * `served` is the order of the items in the HTML the server sent.
 */
async function open(page: Page, url: string, id: number) {
	const response = await page.goto(url);
	const served = [
		...(await response!.text()).matchAll(/data-fg-item-id="(\d+)"/g),
	].map((m) => Number(m[1]));
	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	await expect(gallery.items().first()).toBeVisible();
	await expect(gallery.root.locator('.fg-random-pending')).toHaveCount(0);
	await page.waitForTimeout(1500);
	return Object.assign(gallery, { served });
}

function shown(gallery: GalleryRender): Promise<number[]> {
	return gallery
		.items()
		.locator('[data-fg-item-id]')
		.evaluateAll((nodes) =>
			nodes.map((node) => Number(node.getAttribute('data-fg-item-id')))
		);
}

function repeatsAndMissing(seen: number[]) {
	const repeated = seen.filter((id, i) => seen.indexOf(id) !== i);
	const missing = sixty().filter((id) => !seen.includes(id));
	return { repeated, missing };
}

test.describe('random refetch: Load More', () => {
	for (const outcome of OUTCOMES) {
		outcomeTest(
			outcome,
			`RND-01: refetch ${outcome} - loading every page shows each item once`,
			['@layout', ...('late' === outcome ? ['@critical'] : [])],
			async (page) => {
				const { id, url } = randomGallery({
					pagination_method: 'load_more',
				});
				await alterRefetch(page, outcome);
				const gallery = await open(page, url, id);
				const button = gallery.root.locator(
					'.fg-pagination__load-more'
				);

				for (const count of [24, 36, 48, 60]) {
					await button.click();
					await expect(gallery.items()).toHaveCount(count);
				}
				await expect(button).toBeHidden();

				const seen = await shown(gallery);
				expect(repeatsAndMissing(seen)).toEqual({
					repeated: [],
					missing: [],
				});
			}
		);
	}
});

test.describe('random refetch: page buttons', () => {
	for (const outcome of ['late', 'http 403'] as Refetch[]) {
		outcomeTest(
			outcome,
			`RND-02: refetch ${outcome} - the five pages together hold each item once`,
			['@layout'],
			async (page) => {
				const { id, url } = randomGallery({
					pagination_method: 'pages',
					pages_truncate: false,
				});
				await alterRefetch(page, outcome);
				const gallery = await open(page, url, id);
				const nav = gallery.root.locator('.fg-pagination--pages');
				const current = nav.locator('[aria-current="page"]');

				const seen = await shown(gallery);
				for (const n of [2, 3, 4, 5]) {
					await nav
						.locator(`[data-fg-pagination-page="${n}"]`)
						.click();
					await expect(current).toHaveText(String(n));
					await expect(gallery.items()).toHaveCount(12);
					seen.push(...(await shown(gallery)));
				}

				expect(repeatsAndMissing(seen)).toEqual({
					repeated: [],
					missing: [],
				});
			}
		);
	}
});

test.describe('random refetch: Lightbox', () => {
	for (const outcome of ['on time', 'late'] as Refetch[]) {
		test(
			`RND-03: refetch ${outcome} - walking the Lightbox from page 1 reaches each item once`,
			{ tag: '@lightbox' },
			async ({ page }) => {
				test.setTimeout(120_000);
				const { id, url } = randomGallery({
					pagination_method: 'load_more',
				});
				await alterRefetch(page, outcome);
				const gallery = await open(page, url, id);

				await page.evaluate(() => {
					const w = window as unknown as { __fgSlides: string[] };
					w.__fgSlides = [];
					const record = (event: Event) => {
						const item = (event as CustomEvent).detail?.item;
						w.__fgSlides.push(item ? String(item.id) : '');
					};
					document.addEventListener(
						'fotogrids:lightbox:open',
						record
					);
					document.addEventListener(
						'fotogrids:lightbox:navigate',
						record
					);
				});
				const slides = () =>
					page.evaluate(
						() =>
							(window as unknown as { __fgSlides: string[] })
								.__fgSlides
					);

				const lightbox = new Lightbox(page);
				await lightbox.openFrom(gallery);
				for (let i = 1; i < 60; i++) {
					await expect
						.poll(async () => {
							if ((await slides()).length < i + 1) {
								await lightbox.next().click();
							}
							return (await slides()).length;
						})
						.toBe(i + 1);
				}

				const seen = (await slides()).map(Number);
				expect(seen).not.toContain(0);
				expect(repeatsAndMissing(seen)).toEqual({
					repeated: [],
					missing: [],
				});
			}
		);
	}
});

test(
	'RND-04: refetch on time - page 1 is the refetched order, not the server order',
	{ tag: '@layout' },
	async ({ page }) => {
		const { id, url } = randomGallery({ pagination_method: 'load_more' });
		const gallery = await open(page, url, id);

		expect(gallery.served).toHaveLength(12);
		expect(await shown(gallery)).not.toEqual(gallery.served);
	}
);
