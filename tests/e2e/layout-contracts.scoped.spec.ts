import { test, expect } from './support/test';
import { galleryPage, shortcodePage } from './support/collections';
import { firstItem } from './support/fixtures';
import { storageStateFor } from './support/roles';
import { GalleryRender } from './support/gallery-render';

/**
 * What every layout puts in the page, and which settings move it.
 *
 * scoped: each test renders its own gallery and reads it.
 *
 * The rows are written per layout rather than once over a loop where the
 * layouts disagree — four of the eight ship their items hidden and four do not,
 * and a loop that tolerated both would assert nothing.
 */

/** Track element and whether the layout hands its items to JS hidden. */
const LAYOUTS = [
	{ layout: 'grid', track: '.fg-grid-track', hidden: false, paginates: true },
	{
		layout: 'masonry',
		track: '.fg-masonry-track',
		hidden: true,
		paginates: true,
	},
	{
		layout: 'justified',
		track: '.fg-justified-track',
		hidden: true,
		paginates: true,
	},
	{
		layout: 'instant-photos',
		track: '.fg-instant-photos-track',
		hidden: false,
		paginates: true,
	},
	{
		layout: 'slider',
		track: '.fg-carousel-track',
		hidden: true,
		paginates: false,
	},
	{
		layout: 'image-viewer',
		track: '.fg-viewer-track',
		hidden: true,
		paginates: false,
	},
	{
		layout: 'featured-item',
		track: '.fg-featured-grid',
		hidden: false,
		paginates: false,
	},
] as const;

const COLUMNS = { desktop: 4, tablet: 3, mobile: 1 };

const VIEWPORTS = {
	desktop: { width: 1280, height: 900 },
	tablet: { width: 820, height: 1100 },
	mobile: { width: 390, height: 844 },
} as const;

test.describe('the markup a layout renders', () => {
	for (const { layout, track, paginates } of LAYOUTS) {
		test(
			`LAY-01: ${layout} marks its track as the items root`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { id, url } = galleryPage({ layout });
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				expect(await gallery.layout()).toBe(layout);
				await expect(
					gallery.root.locator(`${track}[data-fg-items-root="true"]`)
				).toHaveCount(1);
			}
		);

		test(
			`LAY-21: ${layout} ${
				paginates
					? 'wraps its items in a layout body'
					: 'renders no layout body'
			}`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { id, url } = galleryPage({ layout });
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				await expect(
					gallery.root.locator('.fg-layout-body')
				).toHaveCount(paginates ? 1 : 0);
			}
		);
	}
});

/**
 * LAY-02 and LAY-03. Four layouts hand every item to JS carrying
 * `fg-item-hidden` and rely on it to reveal them, so with JS off the gallery is
 * blank. The markup is there either way, which is what makes this worth
 * asserting: a crawler sees the items, a visitor without JS does not.
 */
test.describe('the hidden-then-revealed contract', () => {
	for (const { layout, hidden } of LAYOUTS) {
		test(
			`LAY-02: ${layout} ${
				hidden
					? 'reveals items JS was handed hidden'
					: 'renders items visible'
			}`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { id, url } = galleryPage({ layout });
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				// Whatever the initial state, a browser with JS ends up showing them.
				await expect(gallery.items().first()).toBeVisible();
				await expect(
					gallery.root.locator('.fg-item.fg-item-hidden')
				).toHaveCount(0);
			}
		);
	}

	for (const { layout, hidden } of LAYOUTS) {
		test(
			`LAY-02: with JS off, ${layout} is ${
				hidden ? 'blank' : 'still a gallery'
			}`,
			{ tag: '@layout' },
			async ({ browser }) => {
				const { id, url } = galleryPage({ layout });
				const context = await browser.newContext({
					javaScriptEnabled: false,
				});
				const noJs = await context.newPage();

				try {
					await noJs.goto(url);

					const root = noJs.locator(`[data-fg-gallery-id="${id}"]`);
					await expect(root).toBeAttached();

					const items = root.locator('.fg-item');
					expect(
						await items.count(),
						'the items are in the HTML either way'
					).toBeGreaterThan(0);

					if (hidden) {
						await expect(
							items.first(),
							'this layout depends on JS to reveal its items'
						).toBeHidden();
					} else {
						await expect(items.first()).toBeVisible();
					}
				} finally {
					await context.close();
				}
			}
		);
	}
});

test.describe('the settings that reach the browser as variables', () => {
	test(
		'LAY-16: fixed columns resolve per viewport',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage({
				layout: 'grid',
				columns_mode: 'fixed',
				columns: COLUMNS,
			});
			const gallery = new GalleryRender(page, id);

			for (const [name, viewport] of Object.entries(VIEWPORTS)) {
				await page.setViewportSize(viewport);
				await page.goto(url);
				await gallery.waitFor();

				expect(await gallery.attr('columns-mode')).toBe('fixed');
				expect(
					await gallery.cssVar('cols'),
					`--fg-cols at ${name}`
				).toBe(String(COLUMNS[name as keyof typeof COLUMNS]));
			}
		}
	);

	test(
		'LAY-17: auto columns emit a range instead of a count',
		{ tag: '@layout' },
		async ({ page }) => {
			// Stored as bare numbers; the renderer appends the unit.
			const range = {
				desktop: { min: 180, max: 320 },
				tablet: { min: 160, max: 300 },
				mobile: { min: 140, max: 280 },
			};
			const { id, url } = galleryPage({
				layout: 'grid',
				columns_mode: 'auto',
				columns_auto_range: range,
			});
			const gallery = new GalleryRender(page, id);

			await page.setViewportSize(VIEWPORTS.desktop);
			await page.goto(url);
			await gallery.waitFor();

			expect(await gallery.attr('columns-mode')).toBe('auto');
			expect(await gallery.cssVar('col-min')).toBe(
				`${range.desktop.min}px`
			);
			expect(await gallery.cssVar('col-max')).toBe(
				`${range.desktop.max}px`
			);

			// A count would make the auto-fit grid a fixed one.
			expect(await gallery.cssVar('cols')).toBe('');
		}
	);

	/**
	 * A spacing value is stored either as a bare number or as a value-and-unit
	 * pair, depending on which control wrote it. Both have to reach CSS as one
	 * length, so both shapes are asserted.
	 */
	for (const shape of ['a number', 'a value and a unit'] as const) {
		test(
			`LAY-18: item spacing stored as ${shape} resolves per viewport`,
			{
				tag: '@layout',
			},
			async ({ page }) => {
				const px = { desktop: 28, tablet: 18, mobile: 8 };
				const spacing =
					'a number' === shape
						? px
						: {
								desktop: { value: px.desktop, unit: 'px' },
								tablet: { value: px.tablet, unit: 'px' },
								mobile: { value: px.mobile, unit: 'px' },
							};

				const { id, url } = galleryPage({
					layout: 'grid',
					item_spacing: spacing,
				});
				const gallery = new GalleryRender(page, id);

				for (const [name, viewport] of Object.entries(VIEWPORTS)) {
					await page.setViewportSize(viewport);
					await page.goto(url);
					await gallery.waitFor();

					expect(
						await gallery.cssVar('gap'),
						`--fg-gap at ${name}`
					).toBe(`${px[name as keyof typeof px]}px`);
				}
			}
		);
	}
});

/**
 * LAY-19. Four branches, not three: a preset, a custom pair, "none", and a
 * custom pair with a zero in it, which falls back to natural rather than
 * emitting `0 / 1`.
 */
test.describe('the aspect-ratio branches', () => {
	const RATIOS = [
		{
			name: 'a preset is normalised to a CSS ratio',
			settings: { layout_item_aspect_ratio: '4/3' },
			ratio: '4 / 3',
		},
		{
			name: 'a custom pair becomes that ratio',
			settings: {
				layout_item_aspect_ratio: 'custom',
				layout_item_aspect_ratio_w: 5,
				layout_item_aspect_ratio_h: 2,
			},
			ratio: '5 / 2',
		},
		{
			name: 'none opts the item box out',
			settings: { layout_item_aspect_ratio: 'none' },
			ratio: null,
		},
		{
			name: 'a custom pair with a zero falls back to natural',
			settings: {
				layout_item_aspect_ratio: 'custom',
				layout_item_aspect_ratio_w: 0,
				layout_item_aspect_ratio_h: 3,
			},
			ratio: null,
		},
	] as const;

	for (const { name, settings, ratio } of RATIOS) {
		test(`LAY-19: ${name}`, { tag: '@layout' }, async ({ page }) => {
			const { id, url } = galleryPage({ layout: 'grid', ...settings });
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			if (null === ratio) {
				expect(await gallery.attr('natural-ratio')).toBe('1');
				expect(await gallery.cssVar('item-aspect-ratio')).toBe('');
			} else {
				expect(await gallery.attr('natural-ratio')).toBeNull();
				expect(await gallery.cssVar('item-aspect-ratio')).toBe(ratio);
			}
		});
	}

	test(
		'LAY-20: object fit is the value that was saved',
		{ tag: '@layout' },
		async ({ page }) => {
			for (const fit of ['cover', 'contain']) {
				const { id, url } = galleryPage({
					layout: 'grid',
					layout_item_object_fit: fit,
				});
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				expect(await gallery.cssVar('item-fit')).toBe(fit);
			}
		}
	);
});

test.describe('the edges of a gallery', () => {
	test(
		'LAY-25: an empty gallery says so instead of rendering a layout',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const { id, url } = galleryPage({ layout: 'grid' }, []);

			await page.goto(url);

			await expect(
				page.locator(`[data-fg-gallery-id="${id}"]`)
			).toHaveCount(0);
			await expect(
				page.locator('.fotogrids-error, .fg-error')
			).toHaveCount(1);
		}
	);

	for (const { layout, track } of LAYOUTS) {
		test(
			`LAY-26: ${layout} renders a one-item gallery`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { id, url } = galleryPage({ layout }, [
					firstItem('F-small'),
				]);
				const gallery = new GalleryRender(page, id);

				await page.goto(url);
				await gallery.waitFor();

				await expect(gallery.root.locator(track)).toHaveCount(1);
				await expect(gallery.items()).toHaveCount(1);
				await expect(gallery.items().first()).toBeVisible();
			}
		);
	}
});

/**
 * LAY-15. A layout name nothing registered is a mistake in a saved setting or in
 * the shortcode's `template` attribute, which overrides it. Both reach the same
 * error, and the editor who can fix it sees the message while a visitor gets an
 * empty hidden element.
 */
test.describe('an unknown layout', () => {
	const UNKNOWN = 'kaleidoscope';
	const ERROR = '.fotogrids-error';

	const ROUTES = [
		{
			name: 'saved as the gallery layout',
			page: () => galleryPage({ layout: UNKNOWN }),
		},
		{
			name: 'passed as the shortcode template',
			page: () =>
				shortcodePage(
					galleryPage({ layout: 'grid' }).id,
					`template="${UNKNOWN}"`
				),
		},
	] as const;

	// `_show_render_errors` is `current_user_can( 'edit_posts' )`, so the two
	// halves of this row differ only in who is asking.
	for (const route of ROUTES) {
		test(
			`LAY-15: ${route.name}, an editor is shown the reason`,
			{ tag: '@layout' },
			async ({ browser }) => {
				const { url } = route.page();
				const context = await browser.newContext({
					storageState: storageStateFor('editor'),
				});
				const editor = await context.newPage();

				try {
					await editor.goto(url);

					const error = editor.locator(ERROR);
					await expect(error).toBeVisible();
					await expect(error).toContainText(UNKNOWN);
				} finally {
					await context.close();
				}
			}
		);

		test(
			`LAY-15: ${route.name}, a visitor is shown nothing`,
			{ tag: '@layout' },
			async ({ page }) => {
				const { url } = route.page();

				await page.goto(url);

				const error = page.locator(ERROR);
				await expect(
					error,
					'the element is there, so the layout did fail'
				).toBeAttached();
				await expect(error).toBeHidden();
				expect(
					await error.textContent(),
					'the reason leaked to a visitor'
				).toBe('');
			}
		);
	}
});
