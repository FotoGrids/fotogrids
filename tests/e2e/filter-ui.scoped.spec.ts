import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';

/**
 * The front-end filter bar: its modes, single and multiple selection, the
 * reset control, keyboard use, the change event and the style settings.
 *
 * scoped: each test renders its own gallery.
 */

const FILTERING = {
	filtering_enabled: true,
	filter_by: ['tags'],
	filter_display_mode: 'always',
};

/** F-tagged: four items with one tag each, then two with none. */
const tagged = (): number[] => fixture<number[]>('F-tagged', 'items');

const shapes = (count: number): number[] =>
	fixture<number[]>('F-shapes', 'items').slice(0, count);

function filtered(settings: Settings = {}, items = tagged()) {
	return galleryPage({ layout: 'grid', ...FILTERING, ...settings }, items);
}

async function open(page: Page, url: string, id: number) {
	await page.goto(url);
	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	await expect(gallery.root.locator('.fotogrids-filters')).toHaveAttribute(
		'data-fg-filters-ready',
		'true'
	);
	return gallery;
}

/** Item ids not hidden by a filter, in DOM order. */
function visibleIds(gallery: GalleryRender): Promise<number[]> {
	return gallery.root
		.locator('.fg-item:not(.fg-is-filtered-out) [data-fg-item-id]')
		.evaluateAll((nodes) =>
			nodes.map((node) => Number(node.getAttribute('data-fg-item-id')))
		);
}

function button(gallery: GalleryRender, slug: string) {
	return gallery.root.locator(`.fg-filter-btn[data-fg-filter="${slug}"]`);
}

/** Counts `fotogrids:filters_changed` events and keeps each detail. */
async function recordChanges(page: Page): Promise<void> {
	await page.evaluate(() => {
		const win = window as unknown as { fgChanges: unknown[] };
		win.fgChanges = [];
		document.addEventListener('fotogrids:filters_changed', (event) => {
			const detail = (event as CustomEvent).detail;
			win.fgChanges.push({
				galleryId: detail.galleryEl.getAttribute('data-fg-gallery-id'),
				target: (event.target as Element).getAttribute(
					'data-fg-gallery-id'
				),
				filters: detail.filters,
			});
		});
	});
}

function changes(page: Page): Promise<unknown[]> {
	return page.evaluate(
		() => (window as unknown as { fgChanges: unknown[] }).fgChanges
	);
}

test.describe('selection', () => {
	/** With multiple selection off, a second tag replaces the first rather than adding to it. */
	test(
		'FIL-04: single-select replaces the active tag in buttons and checkboxes',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = tagged();
			const single = filtered({ filtering_multiple_enabled: false });
			let gallery = await open(page, single.url, single.id);
			await expect(gallery.root).toHaveAttribute(
				'data-fg-filter-multiple',
				'false'
			);

			await button(gallery, 'architecture').click();
			await button(gallery, 'sunset').click();
			await expect(button(gallery, 'architecture')).toHaveAttribute(
				'aria-pressed',
				'false'
			);
			await expect(button(gallery, 'sunset')).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			expect(await visibleIds(gallery)).toEqual([items[1]]);

			await button(gallery, 'sunset').click();
			expect(await visibleIds(gallery)).toEqual(items);

			const boxes = filtered({
				filtering_multiple_enabled: false,
				filter_ui_style: 'checkboxes',
			});
			gallery = await open(page, boxes.url, boxes.id);
			const box = (slug: string) =>
				gallery.root.locator(`.fg-filter-checkbox[value="${slug}"]`);
			const label = (slug: string) =>
				gallery.root.locator(
					`.fg-filter-checkbox-label:has([value="${slug}"])`
				);

			await label('architecture').click();
			await label('sunset').click();
			await expect(box('sunset')).toBeChecked();
			await expect(box('architecture')).not.toBeChecked();
			expect(await visibleIds(gallery)).toEqual([items[1]]);
		}
	);

	/** The default keeps every chosen tag, so the contrast with FIL-04 is in the same file. */
	test(
		'FIL-04: multiple selection on keeps both tags',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = tagged();
			const { id, url } = filtered();
			const gallery = await open(page, url, id);

			await button(gallery, 'architecture').click();
			await button(gallery, 'sunset').click();

			expect(await visibleIds(gallery)).toEqual(items.slice(0, 2));
		}
	);

	/** An item with no tags carries an empty data-fg-tags and drops out under any tag. */
	test(
		'FIL-10: untagged items carry an empty tag list and hide under any filter',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = tagged();
			const { id, url } = filtered();
			const gallery = await open(page, url, id);
			const untagged = gallery.root.locator('.fg-item').nth(4);

			await expect(untagged).toHaveAttribute('data-fg-tags', '');
			await expect(
				gallery.root.locator('.fg-item').nth(5)
			).toHaveAttribute('data-fg-tags', '');

			for (const slug of [
				'architecture',
				'portrait',
				'street',
				'sunset',
			]) {
				await button(gallery, slug).click();
				const shown = await visibleIds(gallery);
				expect(shown, slug).not.toContain(items[4]);
				expect(shown, slug).not.toContain(items[5]);
				await button(gallery, slug).click();
			}

			await expect(untagged).toBeVisible();
		}
	);

	/** A source with no options renders no group, so the bar never shows an empty one. */
	test(
		'FIL-09: a gallery with no tags renders no filter group',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = filtered(
				{},
				fixture<number[]>('F-small', 'items')
			);
			await page.goto(url);
			const gallery = new GalleryRender(page, id);
			await gallery.waitFor();

			await expect(gallery.root.locator('.fg-filter-group')).toHaveCount(
				0
			);
			await expect(gallery.root.locator('.fg-filter-btn')).toHaveCount(0);
		}
	);
});

test.describe('reset and change event', () => {
	/** "All" on an already clear bar fires no change and asks the server for nothing. */
	test(
		'FIL-05: All while nothing is selected sends no request and no change',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = shapes(40);
			const { id, url } = filtered(
				{
					pagination_type: 'paginated',
					pagination_method: 'load_more',
					items_per_page: { desktop: 12, tablet: 12, mobile: 12 },
				},
				items
			);
			const gallery = await open(page, url, id);
			await recordChanges(page);
			const renders: string[] = [];
			page.on('request', (request) => {
				if (request.url().includes('/gallery/render')) {
					renders.push(request.url());
				}
			});
			const all = gallery.root.locator('[data-fg-filter-all]');

			await all.click();
			await all.click();
			await page.waitForTimeout(800);
			expect(renders).toEqual([]);
			expect(await changes(page)).toEqual([]);

			await gallery.root
				.locator('.fg-filter-btn', { hasText: /^Shape quarter/ })
				.click();
			await expect.poll(() => renders.length).toBeGreaterThan(0);
			expect(await changes(page)).toHaveLength(1);
		}
	);

	/** The event bubbles from the gallery wrapper and names the active tags by arg key. */
	test(
		'FIL-14: fotogrids:filters_changed carries the gallery and the active tags',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = filtered();
			const gallery = await open(page, url, id);
			await recordChanges(page);

			await button(gallery, 'sunset').click();
			await button(gallery, 'architecture').click();
			await gallery.root.locator('[data-fg-filter-all]').click();

			const seen = await changes(page);
			const at = String(id);
			expect(seen).toEqual([
				{ galleryId: at, target: at, filters: { tags: ['sunset'] } },
				{
					galleryId: at,
					target: at,
					filters: { tags: ['sunset', 'architecture'] },
				},
				{ galleryId: at, target: at, filters: {} },
			]);
		}
	);
});

test.describe('display mode', () => {
	/** Toggle mode starts collapsed; the button flips aria-expanded and reveals the options. */
	test(
		'FIL-07: toggle mode starts collapsed and the button expands it',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = filtered({ filter_display_mode: 'toggle' });
			const gallery = await open(page, url, id);
			const bar = gallery.root.locator('.fotogrids-filters');
			const toggle = gallery.root.locator('.fg-filter-toggle');
			const first = button(gallery, 'architecture');

			await expect(bar).toHaveAttribute(
				'data-fg-filter-collapsed',
				'true'
			);
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect(first).toBeHidden();

			await toggle.click();
			await expect(toggle).toHaveAttribute('aria-expanded', 'true');
			await expect(bar).not.toHaveAttribute(
				'data-fg-filter-collapsed',
				/.*/
			);
			await expect(first).toBeVisible();

			await toggle.click();
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect(first).toBeHidden();
		}
	);

	/** A sidebar bar is always open, whatever display mode is stored. */
	test(
		'FIL-06: the sidebar position forces the bar open with no toggle',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = filtered({
				filter_ui_position: 'sidebar',
				filter_display_mode: 'toggle',
			});
			const gallery = await open(page, url, id);
			const bar = gallery.root.locator('.fotogrids-filters');

			await expect(gallery.root).toHaveAttribute(
				'data-fg-filter-display',
				'always'
			);
			await expect(bar).toHaveAttribute(
				'data-fg-filter-display',
				'always'
			);
			await expect(bar).not.toHaveAttribute(
				'data-fg-filter-collapsed',
				/.*/
			);
			await expect(gallery.root.locator('.fg-filter-toggle')).toHaveCount(
				0
			);
			await expect(button(gallery, 'architecture')).toBeVisible();
		}
	);
});

test.describe('counts', () => {
	/** Counts cover the whole gallery, not the page on screen, and hold on page 2. */
	test(
		'FIL-08: counts on a paginated gallery are those of the full set, on every page',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = filtered(
				{
					pagination_type: 'paginated',
					pagination_method: 'pages',
					items_per_page: { desktop: 12, tablet: 12, mobile: 12 },
					show_filter_count: true,
				},
				shapes(120)
			);
			const gallery = await open(page, url, id);
			const count = (label: RegExp) =>
				gallery.root
					.locator('.fg-filter-btn', { hasText: label })
					.locator('.fg-filter-count');

			await expect(count(/^Shape quarter/)).toHaveText('30');
			await expect(count(/^Shape few/)).toHaveText('7');

			const current = gallery.root.locator(
				'.fg-pagination--pages [aria-current="page"]'
			);
			await gallery.root
				.locator('.fg-pagination--pages [data-fg-pagination-page="2"]')
				.click();
			await expect(current).toHaveText('2');

			await expect(count(/^Shape quarter/)).toHaveText('30');
			await expect(count(/^Shape few/)).toHaveText('7');
		}
	);
});

test.describe('keyboard', () => {
	/** Arrow keys move focus round the tag buttons and wrap at both ends. */
	test(
		'FIL-12: arrow keys rove through a button group and wrap',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = filtered();
			const gallery = await open(page, url, id);
			const buttons = gallery.root.locator('.fg-filter-btn');
			const focused = () =>
				gallery.root.evaluate((root) =>
					root.ownerDocument.activeElement?.getAttribute(
						'data-fg-filter'
					)
				);

			await buttons.first().focus();
			expect(await focused()).toBe('architecture');
			await page.keyboard.press('ArrowRight');
			expect(await focused()).toBe('portrait');
			await page.keyboard.press('ArrowDown');
			expect(await focused()).toBe('street');
			await page.keyboard.press('ArrowLeft');
			expect(await focused()).toBe('portrait');
			await page.keyboard.press('ArrowUp');
			await page.keyboard.press('ArrowUp');
			expect(await focused()).toBe('sunset');
			await page.keyboard.press('ArrowRight');
			expect(await focused()).toBe('architecture');
		}
	);

	/** The dropdown opens from the keyboard, moves with arrows, selects on Enter/Space and closes on Escape. */
	test(
		'FIL-12: a dropdown works from the keyboard alone',
		{ tag: '@layout' },
		async ({ page }) => {
			const items = tagged();
			const { id, url } = filtered({
				filter_ui_style: 'dropdowns',
				filtering_multiple_enabled: false,
			});
			const gallery = await open(page, url, id);
			const trigger = gallery.root.locator('.fg-filter-dropdown-trigger');
			const list = gallery.root.locator('.fg-filter-dropdown-list');
			const focused = () =>
				gallery.root.evaluate((root) => {
					const el = root.ownerDocument.activeElement;
					return el?.matches('.fg-filter-dropdown-trigger')
						? 'trigger'
						: el?.getAttribute('data-fg-filter');
				});

			await trigger.focus();
			await page.keyboard.press('Enter');
			await expect(list).toHaveClass(/fg-is-open/);
			await expect(trigger).toHaveAttribute('aria-expanded', 'true');
			expect(await focused()).toBe('');

			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('ArrowDown');
			expect(await focused()).toBe('portrait');
			await page.keyboard.press('ArrowUp');
			expect(await focused()).toBe('architecture');
			await page.keyboard.press('Enter');

			await expect(list).not.toHaveClass(/fg-is-open/);
			await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			await expect(trigger).toContainText('Architecture');
			expect(await visibleIds(gallery)).toEqual([items[0]]);

			await trigger.focus();
			await page.keyboard.press(' ');
			await expect(list).toHaveClass(/fg-is-open/);
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('ArrowDown');
			expect(await focused()).toBe('street');
			await page.keyboard.press(' ');
			expect(await visibleIds(gallery)).toEqual([items[3]]);

			await trigger.focus();
			await page.keyboard.press('ArrowDown');
			await expect(list).toHaveClass(/fg-is-open/);
			await page.keyboard.press('Escape');
			await expect(list).not.toHaveClass(/fg-is-open/);
			expect(await focused()).toBe('trigger');

			await page.keyboard.press('Enter');
			await page.keyboard.press('ArrowUp');
			await expect(list).not.toHaveClass(/fg-is-open/);
			expect(await focused()).toBe('trigger');
		}
	);
});

test.describe('styles', () => {
	/** Dropdowns render a plain reset button, where buttons and checkboxes render an active All toggle. */
	test(
		'FIL-13: the dropdown reset button is not rendered active',
		{ tag: '@layout' },
		async ({ page }) => {
			const dropdowns = filtered({ filter_ui_style: 'dropdowns' });
			let gallery = await open(page, dropdowns.url, dropdowns.id);
			const reset = gallery.root.locator('[data-fg-filter-all]');
			await expect(reset).toHaveClass(/fg-filter-reset/);
			await expect(reset).not.toHaveClass(/fg-is-active/);

			const buttons = filtered();
			gallery = await open(page, buttons.url, buttons.id);
			const all = gallery.root.locator('[data-fg-filter-all]');
			await expect(all).not.toHaveClass(/fg-filter-reset/);
			await expect(all).toHaveClass(/fg-is-active/);
		}
	);

	const RED = 'rgb(200, 10, 20)';
	const GREEN = 'rgb(10, 150, 40)';
	const BLUE = 'rgb(20, 30, 210)';
	const GOLD = 'rgb(220, 180, 10)';

	async function background(
		locator: import('@playwright/test').Locator,
		pseudo: string | null = null
	) {
		return locator.evaluate(
			(el, which) => getComputedStyle(el, which).backgroundColor,
			pseudo
		);
	}

	/** One colour per state group reaches the button and its count badge. */
	test(
		'FIL-15: button and count-badge colours follow their settings per state',
		{ tag: ['@layout', '@visual'] },
		async ({ page }) => {
			const { id, url } = filtered({
				filter_btn_bg: RED,
				filter_btn_hover_bg: GREEN,
				filter_btn_active_bg: BLUE,
				filter_count_bg: GOLD,
				filter_count_active_bg: GREEN,
			});
			const gallery = await open(page, url, id);
			const sunset = button(gallery, 'sunset');
			const badge = sunset.locator('.fg-filter-count');

			expect(await background(sunset)).toBe(RED);
			expect(await background(badge)).toBe(GOLD);

			await sunset.hover();
			await expect.poll(() => background(sunset)).toBe(GREEN);

			await sunset.click();
			await page.mouse.move(0, 0);
			await expect.poll(() => background(sunset)).toBe(BLUE);
			await expect.poll(() => background(badge)).toBe(GREEN);
		}
	);

	/** The dropdown trigger's open state and a selected option take their own colours. */
	test(
		'FIL-15: dropdown trigger and option colours follow their settings',
		{ tag: ['@layout', '@visual'] },
		async ({ page }) => {
			const { id, url } = filtered({
				filter_ui_style: 'dropdowns',
				filtering_multiple_enabled: true,
				filter_select_bg: RED,
				filter_select_open_bg: GREEN,
				filter_dropdown_option_bg: GOLD,
				filter_dropdown_option_selected_bg: BLUE,
			});
			const gallery = await open(page, url, id);
			const trigger = gallery.root.locator('.fg-filter-dropdown-trigger');
			const option = gallery.root.locator(
				'.fg-filter-dropdown-option[data-fg-filter="street"]'
			);

			expect(await background(trigger)).toBe(RED);
			await trigger.click();
			await page.mouse.move(0, 0);
			await expect.poll(() => background(trigger)).toBe(GREEN);
			expect(await background(option)).toBe(GOLD);

			await option.click();
			await page.mouse.move(0, 0);
			await expect.poll(() => background(option)).toBe(BLUE);
		}
	);

	/** A checked box takes the checked colour, an unchecked one the regular colour. */
	test(
		'FIL-15: checkbox colours follow their settings per state',
		{ tag: ['@layout', '@visual'] },
		async ({ page }) => {
			const { id, url } = filtered({
				filter_ui_style: 'checkboxes',
				filter_cb_bg: RED,
				filter_cb_checked_bg: BLUE,
			});
			const gallery = await open(page, url, id);
			const label = gallery.root.locator(
				'.fg-filter-checkbox-label:has([value="street"])'
			);

			expect(await background(label, '::before')).toBe(RED);
			await label.click();
			await page.mouse.move(0, 0);
			await expect.poll(() => background(label, '::before')).toBe(BLUE);
		}
	);
});
