import { expect, type Page, type Request } from '@playwright/test';
import { galleryPage, type Settings } from './collections';
import { fixture } from './fixtures';
import { GalleryRender } from './gallery-render';

/**
 * Helpers for justified-layout specs: what is on screen, how its rows sit, and
 * walking every page with each pagination method.
 */

export type Method = 'load_more' | 'endless_scroll' | 'pages';

export const PER_PAGE = (n: number) => ({ desktop: n, tablet: n, mobile: n });

/** The F-shapes items in sequence order: mixed portrait, landscape and panorama. */
export function shapes(count = 120): number[] {
	return fixture<number[]>('F-shapes', 'items').slice(0, count);
}

/** A paginated justified gallery on its own page. */
export function justified(
	settings: Settings,
	items: number[]
): { id: number; url: string } {
	return galleryPage(
		{
			layout: 'justified',
			pagination_type: 'paginated',
			pagination_method: 'load_more',
			items_per_page: PER_PAGE(12),
			...settings,
		},
		items
	);
}

export async function open(
	page: Page,
	url: string,
	id: number
): Promise<GalleryRender> {
	await page.goto(url);
	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	await expect(gallery.root).toHaveAttribute('data-fg-justified-packed', '1');
	// A random refetch holds the items until the fresh set lands or is dropped.
	await expect(gallery.root.locator('.fg-random-pending')).toHaveCount(0);
	return gallery;
}

/** Item ids the visitor can see, in DOM order. */
export function shownIds(gallery: GalleryRender): Promise<number[]> {
	return gallery.root.locator('.fg-item').evaluateAll((nodes) =>
		nodes
			.filter((n) => {
				const el = n as HTMLElement;
				return (
					!el.hasAttribute('data-fg-overflow') &&
					!el.classList.contains('fg-is-filtered-out') &&
					'none' !== getComputedStyle(el).display &&
					el.getBoundingClientRect().width > 0
				);
			})
			.map((n) => {
				const host = n.matches('[data-fg-item-id]')
					? n
					: n.querySelector('[data-fg-item-id]');
				return Number(host?.getAttribute('data-fg-item-id'));
			})
	);
}

export type Row = {
	top: number;
	items: number;
	width: number;
	left: number;
	height: number;
};

/** Visible rows, top to bottom, with each row's occupied width including gaps. */
export async function rows(
	gallery: GalleryRender
): Promise<{ track: number; gap: number; rows: Row[] }> {
	return gallery.root.evaluate((root) => {
		// Layout boxes, not client rects: a hover transform must not move an item between rows.
		const box = (el: HTMLElement) => {
			let left = 0;
			let top = 0;
			for (
				let n: HTMLElement | null = el;
				n;
				n = n.offsetParent as HTMLElement | null
			) {
				left += n.offsetLeft;
				top += n.offsetTop;
			}
			return {
				left,
				top,
				width: el.offsetWidth,
				height: el.offsetHeight,
			};
		};
		const track = root.querySelector('.fg-justified-track') as HTMLElement;
		const gap =
			parseFloat(
				getComputedStyle(track).columnGap || getComputedStyle(track).gap
			) || 0;
		const trackBox = box(track);
		const byTop = new Map<
			number,
			Array<{ left: number; width: number; height: number }>
		>();
		track.querySelectorAll(':scope > .fg-item').forEach((n) => {
			const el = n as HTMLElement;
			if (
				el.hasAttribute('data-fg-overflow') ||
				'none' === getComputedStyle(el).display ||
				el.offsetWidth <= 0
			) {
				return;
			}
			const b = box(el);
			byTop.set(b.top, [...(byTop.get(b.top) ?? []), b]);
		});
		const out = [...byTop.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([top, boxes]) => {
				const left = Math.min(...boxes.map((b) => b.left));
				const right = Math.max(...boxes.map((b) => b.left + b.width));
				return {
					top,
					items: boxes.length,
					width: right - left,
					left: left - trackBox.left,
					height: Math.max(...boxes.map((b) => b.height)),
				};
			});
		return { track: track.clientWidth, gap, rows: out };
	});
}

/** INV-4: every row except `exempt` trailing rows spans the track within 1px; none overflows. */
export async function expectFullRows(
	gallery: GalleryRender,
	exemptTrailing = 1
): Promise<void> {
	const { track, rows: list } = await rows(gallery);
	list.forEach((row, i) => {
		expect(row.width, `row ${i} overflows the track`).toBeLessThanOrEqual(
			track + 1
		);
		if (i < list.length - exemptTrailing) {
			expect(
				Math.abs(row.width - track),
				`row ${i} is ${row.width}px of ${track}px`
			).toBeLessThanOrEqual(1);
		}
	});
}

/** D7: every row's height stays within ±tolerance of the target row height. */
export async function expectRowHeights(
	gallery: GalleryRender,
	target: number,
	tolerance = 25
): Promise<void> {
	const { rows: list } = await rows(gallery);
	const min = target * (1 - tolerance / 100);
	const max = target * (1 + tolerance / 100);
	list.forEach((row, i) => {
		expect(row.height, `row ${i} height`).toBeGreaterThanOrEqual(
			Math.floor(min) - 1
		);
		expect(row.height, `row ${i} height`).toBeLessThanOrEqual(
			Math.ceil(max) + 1
		);
	});
}

/** Requests the gallery makes to the render endpoint while `fn` runs. */
export async function countRenders(
	page: Page,
	fn: () => Promise<void>
): Promise<Request[]> {
	const seen: Request[] = [];
	const listener = (request: Request) => {
		if (
			decodeURIComponent(request.url()).includes(
				'/fotogrids/v1/gallery/render'
			)
		) {
			seen.push(request);
		}
	};
	page.on('request', listener);
	try {
		await fn();
		await page.waitForLoadState('networkidle');
	} finally {
		page.off('request', listener);
	}
	return seen;
}

export async function settle(page: Page): Promise<void> {
	await page.waitForLoadState('networkidle');
	await page.waitForFunction(
		() => !document.querySelector('.fotogrids-gallery--is-paginating')
	);
	await page.waitForTimeout(250);
}

export type Walk = {
	/** Ids on screen after each step; step 0 is the first paint. */
	steps: number[][];
	/** Every id seen, across all steps, in order of first appearance per step. */
	seen: number[];
	/** Steps that changed nothing. */
	dead: number;
};

/** Load More until it goes. Asserts full rows after every step when `rowsFull`. */
export async function walkLoadMore(
	page: Page,
	gallery: GalleryRender,
	opts: { rowsFull?: boolean; between?: () => Promise<void> } = {}
): Promise<Walk> {
	const button = gallery.root.locator(
		'[data-fg-pagination-trigger="load-more"]'
	);
	const steps = [await shownIds(gallery)];
	let dead = 0;
	for (let guard = 0; guard < 40 && (await button.isVisible()); guard++) {
		if (opts.rowsFull) {
			await expectFullRows(gallery, 0);
		}
		if (opts.between) {
			await opts.between();
		}
		const before = steps[steps.length - 1].length;
		await button.click();
		await settle(page);
		const now = await shownIds(gallery);
		if (now.length <= before) {
			dead++;
		}
		steps.push(now);
	}
	return { steps, seen: steps[steps.length - 1], dead };
}

/** Scroll naturally until no more items arrive. */
export async function walkEndless(
	page: Page,
	gallery: GalleryRender,
	opts: { between?: () => Promise<void> } = {}
): Promise<Walk> {
	const steps = [await shownIds(gallery)];
	let same = 0;
	for (let guard = 0; guard < 40 && same < 3; guard++) {
		if (opts.between) {
			await opts.between();
		}
		await page.evaluate(() => window.scrollTo(0, 0));
		for (let k = 0; k < 120; k++) {
			const atEnd = await page.evaluate(() => {
				window.scrollBy(0, 250);
				return (
					window.scrollY + window.innerHeight >=
					document.body.scrollHeight - 2
				);
			});
			await page.waitForTimeout(40);
			if (atEnd) {
				break;
			}
		}
		await settle(page);
		const now = await shownIds(gallery);
		same = now.length === steps[steps.length - 1].length ? same + 1 : 0;
		steps.push(now);
	}
	return { steps, seen: steps[steps.length - 1], dead: 0 };
}

/** Next until disabled; each step is one page. */
export async function walkPages(
	page: Page,
	gallery: GalleryRender,
	opts: { rowsFull?: boolean; between?: () => Promise<void> } = {}
): Promise<Walk> {
	const next = gallery.root.locator('[data-fg-pagination-trigger="next"]');
	const steps = [await shownIds(gallery)];
	let dead = 0;
	for (
		let guard = 0;
		guard < 40 && (await next.count()) && !(await next.isDisabled());
		guard++
	) {
		if (opts.rowsFull) {
			await expectFullRows(gallery, 0);
		}
		if (opts.between) {
			await opts.between();
		}
		const before = JSON.stringify(steps[steps.length - 1]);
		await next.click();
		await settle(page);
		const now = await shownIds(gallery);
		if (JSON.stringify(now) === before) {
			dead++;
		}
		steps.push(now);
	}
	return { steps, seen: steps.flat(), dead };
}

export function walk(
	method: Method,
	page: Page,
	gallery: GalleryRender,
	opts: { rowsFull?: boolean; between?: () => Promise<void> } = {}
): Promise<Walk> {
	if ('pages' === method) {
		return walkPages(page, gallery, opts);
	}
	if ('endless_scroll' === method) {
		return walkEndless(page, gallery, opts);
	}
	return walkLoadMore(page, gallery, opts);
}

/** INV-1, INV-2, INV-3 over a finished walk. */
export function expectCoverage(
	result: Walk,
	items: number[],
	label = ''
): void {
	const repeats = result.seen.filter(
		(id, i) => result.seen.indexOf(id) !== i
	);
	expect(repeats, `${label} repeated items`).toEqual([]);
	expect(result.seen, `${label} items or order`).toEqual(items);
	expect(result.dead, `${label} clicks that loaded nothing`).toBe(0);
}

/** INV-7 for the method's control after the last step. */
export async function expectControlsDone(
	gallery: GalleryRender,
	method: Method
): Promise<void> {
	if ('load_more' === method) {
		await expect(
			gallery.root.locator('[data-fg-pagination-trigger="load-more"]')
		).toBeHidden();
	}
	if ('pages' === method) {
		await expect(
			gallery.root.locator('[data-fg-pagination-trigger="next"]')
		).toBeDisabled();
	}
}

/** Resize the viewport and wait for the layout's debounced pass. */
export async function resize(
	page: Page,
	width: number,
	height = 900
): Promise<void> {
	await page.setViewportSize({ width, height });
	await page.waitForFunction(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				'[data-fg-layout="justified"]'
			)
		).every((el) => {
			const track = el.querySelector('.fg-justified-track');
			return (
				!track ||
				0 === track.clientWidth ||
				el.dataset.fgContainerWidth ===
					String(Math.round(track.clientWidth))
			);
		})
	);
	// Covers the layout's resize debounce and the re-plan that follows it.
	await page.waitForTimeout(450);
	await page.waitForFunction(
		() => !document.querySelector('.fotogrids-gallery--is-paginating')
	);
}

/** Sequence positions of the items the visitor can see, in DOM order. */
export function shownSequence(gallery: GalleryRender): Promise<number[]> {
	return gallery.root.locator('.fg-item').evaluateAll((nodes) =>
		nodes
			.filter((n) => {
				const el = n as HTMLElement;
				return (
					!el.hasAttribute('data-fg-overflow') &&
					'none' !== getComputedStyle(el).display &&
					el.getBoundingClientRect().width > 0
				);
			})
			.map((n) => Number((n as HTMLElement).dataset.fgSequenceIndex))
	);
}

/** A post the purge removes, holding the given content. */
export function postWith(
	wpEval: (php: string) => string,
	content: string
): string {
	const escaped = content.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
	return wpEval(
		`$id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Justified page', 'post_name' => 'justified-' . strtolower( wp_generate_password( 8, false ) ), 'post_content' => '${escaped}' ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo get_permalink( $id );`
	).trim();
}

/** The final visible row and its first item's left edge, relative to the track. */
export async function finalRow(
	gallery: GalleryRender
): Promise<Row & { track: number }> {
	const { track, rows: list } = await rows(gallery);
	return { ...list[list.length - 1], track };
}
