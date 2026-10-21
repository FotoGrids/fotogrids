import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, setSettings } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * The styling decorators: border, radius, shadow, spacing, image filters and
 * hover effects, read from the rendered gallery.
 *
 * scoped: each test renders galleries it created.
 */

const VIEWPORTS = {
	desktop: { width: 1280, height: 900 },
	tablet: { width: 900, height: 900 },
	mobile: { width: 500, height: 900 },
} as const;

type Device = keyof typeof VIEWPORTS;

/** A computed style property of the first item's media box. */
function mediaStyle(gallery: GalleryRender, property: string) {
	return gallery.root
		.locator('.fg-item-media')
		.first()
		.evaluate(
			(el, prop) => getComputedStyle(el).getPropertyValue(prop).trim(),
			property
		);
}

async function at(page: Page, device: Device): Promise<void> {
	await page.setViewportSize(VIEWPORTS[device]);
}

/** DEC-01: an enabled border reaches every item's media box, per breakpoint. */
test(
	'DEC-01: an enabled border styles the media box with its style, colour and per-breakpoint width',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			border_enabled: true,
			border_style: 'dashed',
			border_color: '#ff0000',
			border_width: { desktop: 3, tablet: 5, mobile: 7 },
		});
		const gallery = new GalleryRender(page, id);

		await at(page, 'desktop');
		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute('data-fg-border', 'dashed');
		expect(await mediaStyle(gallery, 'border-top-style')).toBe('dashed');
		expect(await mediaStyle(gallery, 'border-top-color')).toBe(
			'rgb(255, 0, 0)'
		);

		for (const [device, width] of [
			['desktop', '3px'],
			['tablet', '5px'],
			['mobile', '7px'],
		] as const) {
			await at(page, device);
			expect(await gallery.cssVar('border-w'), device).toBe(width);
			await expect
				.poll(() => mediaStyle(gallery, 'border-left-width'), {
					message: device,
				})
				.toBe(width);
		}
	}
);

/** DEC-01: with the border off, the widths saved for it draw nothing. */
test(
	'DEC-01: a disabled border leaves the media box unbordered',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			border_enabled: false,
			border_style: 'solid',
			border_width: { desktop: 6, tablet: 6, mobile: 6 },
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		expect(await gallery.attr('border')).toBeNull();
		expect(await gallery.cssVar('border-w')).toBe('');
		expect(await mediaStyle(gallery, 'border-top-style')).toBe('none');
		expect(await mediaStyle(gallery, 'border-top-width')).toBe('0px');
	}
);

/** DEC-02: four sides and three breakpoints each reach the media corners. */
test(
	'DEC-02: the border radius rounds each corner as set, per breakpoint',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			border_radius: {
				desktop: { top: 12, right: 4, bottom: 20, left: 6 },
				tablet: 8,
				mobile: 2,
			},
		});
		const gallery = new GalleryRender(page, id);

		await at(page, 'desktop');
		await page.goto(url);
		await gallery.waitFor();

		expect(await gallery.cssVar('radius')).toBe('12px 4px 20px 6px');
		expect(await mediaStyle(gallery, 'border-top-left-radius')).toBe(
			'12px'
		);
		expect(await mediaStyle(gallery, 'border-top-right-radius')).toBe(
			'4px'
		);
		expect(await mediaStyle(gallery, 'border-bottom-right-radius')).toBe(
			'20px'
		);
		expect(await mediaStyle(gallery, 'border-bottom-left-radius')).toBe(
			'6px'
		);

		await at(page, 'tablet');
		await expect
			.poll(() => mediaStyle(gallery, 'border-top-left-radius'))
			.toBe('8px');

		await at(page, 'mobile');
		await expect
			.poll(() => mediaStyle(gallery, 'border-top-left-radius'))
			.toBe('2px');
	}
);

/** DEC-03: regular, hover and loading shadows are three separate values. */
test(
	'DEC-03: the regular, hover and loading shadows each get their own value',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			shadow_enabled: true,
			shadow_color: 'rgba(255,0,0,0.5)',
			shadow_offset_x: { desktop: 1, tablet: 1, mobile: 1 },
			shadow_offset_y: { desktop: 2, tablet: 2, mobile: 2 },
			shadow_blur: { desktop: 3, tablet: 3, mobile: 3 },
			shadow_spread: { desktop: 0, tablet: 0, mobile: 0 },
			shadow_hover_color: 'rgba(0,0,255,0.5)',
			shadow_hover_offset_x: { desktop: 0, tablet: 0, mobile: 0 },
			shadow_hover_offset_y: { desktop: 8, tablet: 8, mobile: 8 },
			shadow_hover_blur: { desktop: 16, tablet: 16, mobile: 16 },
			shadow_hover_spread: { desktop: 2, tablet: 2, mobile: 2 },
			shadow_loading_color: 'rgba(0,255,0,0.5)',
			shadow_loading_offset_x: { desktop: 5, tablet: 5, mobile: 5 },
			shadow_loading_offset_y: { desktop: 5, tablet: 5, mobile: 5 },
			shadow_loading_blur: { desktop: 5, tablet: 5, mobile: 5 },
			shadow_loading_spread: { desktop: 5, tablet: 5, mobile: 5 },
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute('data-fg-shadow', 'true');
		expect(await gallery.cssVar('shadow')).toBe(
			'1px 2px 3px 0px rgba(255,0,0,0.5)'
		);
		expect(await gallery.cssVar('shadow-hover')).toBe(
			'0px 8px 16px 2px rgba(0,0,255,0.5)'
		);
		expect(await gallery.cssVar('shadow-loading')).toBe(
			'5px 5px 5px 5px rgba(0,255,0,0.5)'
		);

		const first = gallery.items().first();
		await expect(first).toHaveAttribute('data-fg-media-state', 'loaded', {
			timeout: 15000,
		});
		await expect
			.poll(() => mediaStyle(gallery, 'box-shadow'))
			.toBe('rgba(255, 0, 0, 0.5) 1px 2px 3px 0px');

		await first.hover();
		await expect
			.poll(() => mediaStyle(gallery, 'box-shadow'))
			.toBe('rgba(0, 0, 255, 0.5) 0px 8px 16px 2px');
	}
);

/** DEC-03: with the shadow off, the media box casts none. */
test(
	'DEC-03: a disabled shadow casts none',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			shadow_enabled: false,
			shadow_blur: { desktop: 30, tablet: 30, mobile: 30 },
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		expect(await gallery.attr('shadow')).toBeNull();
		expect(await mediaStyle(gallery, 'box-shadow')).toBe('none');
	}
);

/**
 * DEC-04: margin and padding become wrapper variables only when set; padding
 * applies. The theme's layout rules decide the wrapper's margin, so only the
 * variable is read for it.
 */
test(
	'DEC-04: margin and padding reach the gallery wrapper, and are left alone when unset',
	{ tag: '@visual' },
	async ({ page }) => {
		const spaced = galleryPage({
			layout: 'grid',
			margin: {
				desktop: { top: 10, right: 20, bottom: 30, left: 40 },
				tablet: 4,
				mobile: 4,
			},
			padding: {
				desktop: { top: 5, right: 6, bottom: 7, left: 8 },
				tablet: 2,
				mobile: 2,
			},
		});
		const plain = galleryPage({ layout: 'grid' });

		await at(page, 'desktop');
		await page.goto(spaced.url);
		const gallery = new GalleryRender(page, spaced.id);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute('data-fg-spacing', '1');
		const padding = () =>
			gallery.root.evaluate((el) => getComputedStyle(el).padding);

		expect(await gallery.cssVar('margin')).toBe('10px 20px 30px 40px');
		expect(await padding()).toBe('5px 6px 7px 8px');

		await at(page, 'mobile');
		expect(await gallery.cssVar('margin')).toBe('4px');
		expect(await padding()).toBe('2px');

		await page.goto(plain.url);
		const control = new GalleryRender(page, plain.id);
		await control.waitFor();
		expect(await control.attr('spacing')).toBeNull();
		expect(await control.cssVar('margin')).toBe('');
		expect(await control.cssVar('padding')).toBe('');
		expect(
			await control.root.evaluate((el) => getComputedStyle(el).padding)
		).toBe('0px');
	}
);

const FILTERS = [
	['grayscale', 10, '10%'],
	['sepia', 20, '20%'],
	['blur', 3, '3px'],
	['brightness', 110, '110%'],
	['contrast', 120, '120%'],
	['saturate', 130, '130%'],
	['invert', 5, '5%'],
	['opacity', 90, '90%'],
	['hue-rotate', 45, '45deg'],
] as const;

/** Settings for every filter type, `hover` amounts doubled where it fits. */
function filterSettings(prefix: 'thumbnail' | 'full_image') {
	const settings: Record<string, unknown> = {
		[`${prefix}_filter_enabled`]: true,
		[`${prefix}_filter_type`]: FILTERS.map(([type]) => type),
	};

	for (const [type, amount] of FILTERS) {
		const key = type.replace('-', '_');
		const hover = 'hue-rotate' === type ? 90 : amount + 1;
		settings[`${prefix}_filter_amount_${key}`] = {
			desktop: amount,
			tablet: amount,
			mobile: amount,
		};
		settings[`${prefix}_filter_hover_amount_${key}`] = {
			desktop: hover,
			tablet: hover,
			mobile: hover,
		};
	}

	return settings;
}

function filterString(hover: boolean): string {
	return FILTERS.map(([type, amount, css]) => {
		if (!hover) {
			return `${type}(${css})`;
		}
		const unit = css.replace(/^[\d.]+/, '');
		const value = 'hue-rotate' === type ? 90 : amount + 1;
		return `${type}(${value}${unit})`;
	}).join(' ');
}

/** DEC-05: each filter type keeps its own unit, in the order chosen. */
test(
	'DEC-05: all nine thumbnail filters apply in order with their units, and swap on hover',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			...filterSettings('thumbnail'),
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.root).toHaveAttribute(
			'data-fg-filter',
			FILTERS.map(([type]) => type).join(' ')
		);
		expect(await gallery.cssVar('thumb-filter-regular')).toBe(
			filterString(false)
		);
		expect(await gallery.cssVar('thumb-filter-hover')).toBe(
			filterString(true)
		);

		const image = gallery.items().nth(1).locator('.fg-item-media img');
		const filter = () =>
			image.evaluate((el) => getComputedStyle(el).filter);

		await expect.poll(filter).toContain('blur(3px)');
		await expect.poll(filter).toContain('hue-rotate(45deg)');

		await gallery.items().nth(1).hover();
		await expect.poll(filter).toContain('blur(4px)');
		await expect.poll(filter).toContain('hue-rotate(90deg)');
	}
);

/** DEC-05: full-image filters reach the lightbox stage, not the thumbnails. */
test(
	'DEC-05: full-image filters apply to the lightbox image only',
	{ tag: ['@visual', '@lightbox'] },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			...filterSettings('full_image'),
		});
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();

		expect(await gallery.attr('filter')).toBeNull();
		await expect(gallery.root).toHaveAttribute(
			'data-fg-lb-full-filter',
			filterString(false)
		);
		expect(
			await gallery.root
				.locator('.fg-item-media img')
				.first()
				.evaluate((el) => getComputedStyle(el).filter)
		).toBe('none');

		await lightbox.openFrom(gallery);
		await page.mouse.move(0, 0);
		const stage = () =>
			lightbox.image().evaluate((el) => getComputedStyle(el).filter);
		await expect.poll(stage).toContain('blur(3px)');
		expect(await stage()).toContain('hue-rotate(45deg)');
		expect(await stage()).toContain('grayscale(0.1)');

		await lightbox.image().hover();
		await expect.poll(stage).toContain('blur(4px)');
	}
);

const FREE_EFFECTS = [
	'zoom',
	'pan',
	'blur-focus',
	'grayscale',
	'tint',
	'lift',
	'frame',
	'tilt',
	'caption-fade',
	'caption-rise',
	'caption-slide',
	'caption-split',
	'spotlight',
];

/** The FotoGrids hover stylesheets the page loaded, by handle. */
function hoverSheets(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLLinkElement>(
				'link[id^="fotogrids-hover-"]'
			)
		)
			.filter((link) => {
				try {
					return (link.sheet?.cssRules.length ?? 0) > 0;
				} catch {
					return false;
				}
			})
			.map((link) => link.id.replace(/-css$/, ''))
			.sort()
	);
}

/** DEC-07: each Free effect stamps its id and loads its own stylesheet. */
test(
	'DEC-07: every Free hover effect is stamped on the gallery and loads its stylesheet',
	{ tag: '@visual' },
	async ({ page }) => {
		test.slow();
		const { id, url } = galleryPage({ layout: 'grid' });
		const gallery = new GalleryRender(page, id);

		for (const effect of FREE_EFFECTS) {
			setSettings(id, { hover_effect: effect });
			await page.goto(url);
			await expect(gallery.root, effect).toBeAttached();

			await expect(gallery.root, effect).toHaveAttribute(
				'data-fg-hover',
				effect
			);
			expect(await hoverSheets(page), effect).toEqual(
				[`fotogrids-hover-${effect}`, 'fotogrids-hover-base'].sort()
			);
		}
	}
);

/** DEC-08: a Pro effect chosen on Free renders nothing at all. */
test(
	'DEC-08: a Pro hover effect selected on Free renders no effect',
	{ tag: '@visual' },
	async ({ page }) => {
		for (const effect of ['duotone', 'flip']) {
			const { id, url } = galleryPage({
				layout: 'grid',
				hover_effect: effect,
			});
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await gallery.waitFor();

			expect(await gallery.attr('hover'), effect).toBeNull();
			expect(await hoverSheets(page), effect).toEqual([]);
		}
	}
);

/** DEC-09: an effect that animates the caption takes over its visibility. */
test(
	'DEC-09: a caption-animating hover effect overrides caption visibility',
	{ tag: '@visual' },
	async ({ page }) => {
		const owned = galleryPage({
			layout: 'grid',
			hover_effect: 'caption-rise',
			caption_visibility: 'show_on_hover',
		});
		const control = galleryPage({
			layout: 'grid',
			hover_effect: 'zoom',
			caption_visibility: 'show_on_hover',
		});

		await page.goto(control.url);
		const plain = new GalleryRender(page, control.id);
		await plain.waitFor();
		expect(await plain.attr('caption-show')).toBe('show_on_hover');

		await page.goto(owned.url);
		const gallery = new GalleryRender(page, owned.id);
		await gallery.waitFor();
		await expect(gallery.root).toHaveAttribute(
			'data-fg-hover',
			'caption-rise'
		);
		expect(await gallery.attr('caption-show')).toBeNull();
	}
);

/** DEC-10: the cursor icon reaches the item and the link inside it. */
test(
	'DEC-10: the hover cursor icon applies to items and their links',
	{ tag: '@visual' },
	async ({ page }) => {
		const cursors = (gallery: GalleryRender) =>
			gallery.root
				.locator('.fg-item')
				.first()
				.evaluate((item) => [
					getComputedStyle(item).cursor,
					getComputedStyle(item.querySelector('a') as Element).cursor,
				]);

		const zoom = galleryPage({
			layout: 'grid',
			hover_cursor_icon: 'zoom-in',
		});
		await page.goto(zoom.url);
		const zoomed = new GalleryRender(page, zoom.id);
		await zoomed.waitFor();
		expect(await zoomed.cssVar('hover-cursor')).toBe('zoom-in');
		expect(await zoomed.cssVar('hover-cursor-link')).toBe('zoom-in');
		expect(await cursors(zoomed)).toEqual(['zoom-in', 'zoom-in']);

		const plain = galleryPage({
			layout: 'grid',
			hover_cursor_icon: 'default',
		});
		await page.goto(plain.url);
		const control = new GalleryRender(page, plain.id);
		await control.waitFor();
		expect(await control.cssVar('hover-cursor')).toBe('default');
		expect(await control.cssVar('hover-cursor-link')).toBe('');
		expect(await cursors(control)).toEqual(['default', 'pointer']);
	}
);
