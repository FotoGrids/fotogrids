import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryRender } from './support/gallery-render';
import { twelveItems } from './support/fixtures';
import { storageStateFor, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Collection settings set in the editor, saved with Update, read back from the
 * stored meta and from the rendered gallery.
 *
 * Scoped: each test edits a gallery it created.
 */

/** A setting as the gallery stores it, decoded. */
function meta(id: number, key: string): unknown {
	const raw = JSON.parse(
		wpEval(
			`echo wp_json_encode( get_post_meta( ${id}, 'fotogrids_${key}', true ) );`
		)
	);
	if ('string' === typeof raw && /^[[{]/.test(raw)) {
		return JSON.parse(raw);
	}
	return raw;
}

async function openEditor(page: Page, id: number): Promise<CollectionSettings> {
	await page.goto(`/wp-admin/post.php?post=${id}&action=edit`);
	await expect(
		page.locator('.fotogrids-settings-tab__label').first()
	).toBeVisible({
		timeout: 20000,
	});
	return new CollectionSettings(page);
}

/** Press Update and wait for the edit screen to come back. */
async function update(page: Page): Promise<void> {
	await Promise.all([
		page.waitForURL(/[?&]message=\d+/, { waitUntil: 'commit' }),
		page.locator('#publish').click(),
	]);
	await expect(
		page.locator('.fotogrids-settings-tab__label').first()
	).toBeVisible({
		timeout: 20000,
	});
}

async function openPath(
	page: Page,
	panel: CollectionSettings,
	tab: string,
	subtabs: string[] = []
): Promise<void> {
	await panel.openTab(tab);
	for (const label of subtabs) {
		await page
			.locator('.fotogrids-lightbox-subtab:visible')
			.filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
			.first()
			.click();
	}
}

async function setNumber(
	page: Page,
	input: ReturnType<Page['locator']>,
	value: string
): Promise<void> {
	await input.fill(value);
	await input.press('Tab');
}

/** Pick an entry in a font select by its exact label. */
async function pickOption(
	page: Page,
	panel: CollectionSettings,
	key: string,
	label: string
): Promise<void> {
	await panel.field(key).locator('.fotogrids-render-select__trigger').click();
	await page
		.locator('.fotogrids-render-select__option')
		.filter({ hasText: new RegExp(`^${label}$`) })
		.first()
		.click();
	await expect(
		panel.field(key).locator('.fotogrids-render-select__selected')
	).toHaveText(label);
}

/** The gallery's own inline style rules, split by breakpoint. */
async function galleryCss(
	request: APIRequestContext,
	url: string,
	id: number
): Promise<{ base: string; tablet: string; mobile: string }> {
	const html = await (await request.get(url)).text();
	const wrapper = html.match(
		new RegExp(
			`id="(fg-[\\d]+-\\d+)"[^>]*data-fg-gallery-id="${id}"|data-fg-gallery-id="${id}"[^>]*id="(fg-[\\d]+-\\d+)"`
		)
	);
	const selector = `#${wrapper?.[1] ?? wrapper?.[2] ?? `fg-${id}-1`}`;
	const block = (prefix: string) => {
		const at = html.indexOf(`${prefix}${selector} {`);
		return at < 0 ? '' : html.slice(at, html.indexOf('}', at));
	};
	const media = (width: string) => {
		const start = html.indexOf(
			`@media (max-width: ${width}px) {\n    ${selector} {`
		);
		return start < 0 ? '' : html.slice(start, html.indexOf('}', start));
	};

	return { base: block(''), tablet: media('1024'), mobile: media('767') };
}

/** Range and colour renderers: caption overlay opacity and colour reach the overlay background. */
test(
	'SET-11: a range and a colour saved in the editor reach the caption overlay',
	{ tag: ['@admin', '@settings'] },
	async ({ page, request }, testInfo) => {
		testInfo.setTimeout(90_000);
		const { id, url } = galleryPage({
			layout: 'grid',
			caption_placement: 'overlay',
		});
		let panel = await openEditor(page, id);
		await openPath(page, panel, 'Captions', ['General', 'Regular']);

		await setNumber(
			page,
			panel
				.field('caption_overlay_opacity')
				.locator('input[type="number"]'),
			'40'
		);

		await panel
			.field('caption_overlay_color')
			.locator('.fotogrids-color-swatch')
			.click();
		const hex = page.locator('.fg-cp__text-input');
		await hex.fill('#0a141e');
		await hex.press('Enter');
		await page.keyboard.press('Escape');
		await expect(
			panel
				.field('caption_overlay_color')
				.locator('.fotogrids-color-text')
		).toHaveValue(/0a141e|10, ?20, ?30/i);

		await update(page);

		expect(Number(meta(id, 'caption_overlay_opacity'))).toBe(40);
		expect(String(meta(id, 'caption_overlay_color'))).toMatch(
			/0a141e|10, ?20, ?30/i
		);

		const { base } = await galleryCss(request, url, id);
		const overlay =
			base.match(/--fg-caption-overlay-bg:\s*([^;]+);/)?.[1] ?? '';
		const channels = (overlay.match(/[\d.]+/g) ?? []).map(Number);
		expect(channels.slice(0, 3), overlay).toEqual([10, 20, 30]);
		expect(channels[3], overlay).toBeCloseTo(0.4, 2);

		panel = await openEditor(page, id);
		await openPath(page, panel, 'Captions', ['General', 'Regular']);
		await expect(
			panel
				.field('caption_overlay_opacity')
				.locator('input[type="number"]')
		).toHaveValue('40');
	}
);

/** Text input renderer: the Load More label typed in the editor is the button's text. */
test(
	'SET-11: a text input saved in the editor labels the Load More button',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const label = `Show me more ${process.pid}`;
		const { id, url } = galleryPage(
			{
				layout: 'grid',
				pagination_type: 'paginated',
				pagination_method: 'load_more',
				items_per_page: { desktop: 4, tablet: 4, mobile: 4 },
			},
			twelveItems()
		);
		const panel = await openEditor(page, id);
		await openPath(page, panel, 'Pagination', ['Button']);

		await panel.inputIn('load_more_button_text').fill(label);
		await update(page);

		expect(meta(id, 'load_more_button_text')).toBe(label);

		await page.goto(url);
		const gallery = new GalleryRender(page, id);
		await gallery.waitFor();
		await expect(
			gallery.root.locator('.fg-pagination__load-more')
		).toHaveText(label);
	}
);

/** Font family and font style renderers reach the caption title variables. */
test(
	'SET-11: a font family and a font style saved in the editor reach the caption title',
	{ tag: ['@admin', '@settings'] },
	async ({ page, request }) => {
		const { id, url } = galleryPage({ layout: 'grid' });
		const panel = await openEditor(page, id);
		await openPath(page, panel, 'Captions', ['Typography']);

		await pickOption(page, panel, 'caption_title_font_family', 'Georgia');
		await pickOption(page, panel, 'caption_title_font_style', 'Italic');
		await update(page);

		expect(meta(id, 'caption_title_font_family')).toBe('Georgia');
		expect(meta(id, 'caption_title_font_style')).toBe('italic');

		const { base } = await galleryCss(request, url, id);
		expect(base).toMatch(/--fg-caption-title-font-family:[^;]*Georgia/);
		expect(base).toMatch(/--fg-caption-title-font-style:\s*italic;/);

		await openPath(page, panel, 'Captions', ['Typography']);
		await expect(
			panel
				.field('caption_title_font_family')
				.locator('.fotogrids-render-select__selected')
		).toHaveText('Georgia');
		await expect(
			panel
				.field('caption_title_font_style')
				.locator('.fotogrids-render-select__selected')
		).toHaveText('Italic');
	}
);

/** Hover effects grid renderer: the chosen card becomes the gallery's hover effect. */
test(
	'SET-11: a hover effect picked in the editor is the one the gallery renders',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			hover_effect: 'none',
		});
		const panel = await openEditor(page, id);
		await openPath(page, panel, 'Effects', ['Hover Effects']);

		const zoom = panel
			.field('hover_effect')
			.locator('.fotogrids-hover-effect-option')
			.filter({
				has: page.locator('.fotogrids-hover-effect-option__name', {
					hasText: /^Zoom$/,
				}),
			});
		await zoom.locator('.fotogrids-hover-effect-option__content').click();
		await expect(zoom).toHaveClass(/fg-is-active/);
		await update(page);

		expect(meta(id, 'hover_effect')).toBe('zoom');

		await page.goto(url);
		const gallery = new GalleryRender(page, id);
		await gallery.waitFor();
		expect(await gallery.attr('hover')).toBe('zoom');
	}
);

/** Alignment grid renderer: the ninth cell is bottom-right, stored and shown again. */
test(
	'SET-11: a crop alignment picked on the grid is stored and shown again',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage({
			layout: 'grid',
			thumbnail_size: 'custom',
		});
		let panel = await openEditor(page, id);
		await panel.openTab('Media');

		const cells = panel
			.field('thumbnail_custom_size_crop_alignment')
			.locator('.fg-button-group__button');
		await expect(cells).toHaveCount(9);
		await cells.nth(8).click();
		await expect(cells.nth(8)).toHaveClass(/fg-is-active/);
		await update(page);

		expect(meta(id, 'thumbnail_custom_size_crop_alignment')).toBe(
			'bottom-right'
		);

		panel = await openEditor(page, id);
		await panel.openTab('Media');
		await expect(
			panel
				.field('thumbnail_custom_size_crop_alignment')
				.locator('.fg-button-group__button')
				.nth(8)
		).toHaveClass(/fg-is-active/);
	}
);

/** Per-device values all survive Update, and a device equal to the wider one emits no override. */
test(
	'SET-12: a responsive value set per device saves all three and emits only the differing ones',
	{ tag: ['@admin', '@settings', '@layout'] },
	async ({ page, request }) => {
		const { id, url } = galleryPage({ layout: 'grid' });
		let panel = await openEditor(page, id);
		await panel.openTab('Layout');

		const field = panel.field('item_spacing');
		const number = field.locator('input[type="number"]');
		const device = (name: string) =>
			field.getByRole('button', { name, exact: true });

		await setNumber(page, number, '24');
		await device('Tablet').click();
		await setNumber(page, number, '24');
		await device('Mobile').click();
		await setNumber(page, number, '6');
		await update(page);

		const stored = meta(id, 'item_spacing') as Settings;
		const px = (value: unknown) =>
			Number(
				'object' === typeof value && value
					? (value as { value: unknown }).value
					: value
			);
		expect([
			px(stored.desktop),
			px(stored.tablet),
			px(stored.mobile),
		]).toEqual([24, 24, 6]);

		const css = await galleryCss(request, url, id);
		expect(css.base).toContain('--fg-gap: 24px;');
		expect(css.tablet, 'tablet repeats the desktop value').not.toContain(
			'--fg-gap'
		);
		expect(css.mobile).toContain('--fg-gap: 6px;');

		panel = await openEditor(page, id);
		await panel.openTab('Layout');
		await expect(number).toHaveValue('24');
		await device('Mobile').click();
		await expect(number).toHaveValue('6');
	}
);

/** A unit chosen per device is stored beside its number and reaches the render in that unit. */
test(
	'SET-13: vw, px and % units round-trip per device',
	{ tag: ['@admin', '@settings', '@lightbox'] },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'lightbox',
			lightbox_variant: 'grid',
		});
		const panel = await openEditor(page, id);
		await openPath(page, panel, 'Lightbox', ['Styling']);

		const field = panel.field('lightbox_grid_max_width');
		const number = field.locator('input[type="number"]');
		const unit = async (value: string) => {
			await field.locator('.fotogrids-unit-select__button').click();
			await page
				.locator('.fotogrids-unit-select__option')
				.filter({ hasText: new RegExp(`^${value}$`) })
				.click();
			await expect(
				field.locator('.fotogrids-unit-select__value')
			).toHaveText(value);
		};
		const device = (name: string) =>
			field.getByRole('button', { name, exact: true });

		await unit('vw');
		await setNumber(page, number, '70');
		await device('Tablet').click();
		await unit('px');
		await setNumber(page, number, '640');
		await device('Mobile').click();
		await unit('%');
		await setNumber(page, number, '85');
		await update(page);

		expect(meta(id, 'lightbox_grid_max_width')).toMatchObject({
			desktop: { value: 70, unit: 'vw' },
			tablet: { value: 640, unit: 'px' },
			mobile: { value: 85, unit: '%' },
		});

		await page.goto(url);
		const gallery = new GalleryRender(page, id);
		await gallery.waitFor();
		expect(await gallery.attr('data-fg-grid-maxw-desktop')).toBe('70vw');
		expect(await gallery.attr('data-fg-grid-maxw-tablet')).toBe('640px');
		expect(await gallery.attr('data-fg-grid-maxw-mobile')).toBe('85%');
	}
);

/** Four sides, each device and its unit are kept apart through Update and into the caption padding. */
test(
	'SET-14: four-sided padding keeps device, side and unit apart',
	{ tag: ['@admin', '@settings'] },
	async ({ page, request }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			caption_placement: 'bottom',
		});
		const panel = await openEditor(page, id);
		await openPath(page, panel, 'Captions', ['General']);

		const field = panel.field('caption_padding');
		const sides = field.locator(
			'.fotogrids-fourside-input-group input[type="number"]'
		);
		const unit = async (value: string) => {
			await field.locator('.fotogrids-unit-select__button').click();
			await page
				.locator('.fotogrids-unit-select__option')
				.filter({ hasText: new RegExp(`^${value}$`) })
				.click();
			await expect(
				field.locator('.fotogrids-unit-select__value')
			).toHaveText(value);
		};
		const device = (name: string) =>
			field.getByRole('button', { name, exact: true });

		await field.getByRole('button', { name: 'Unlink values' }).click();
		await unit('px');
		for (const [i, value] of ['4', '8', '12', '16'].entries()) {
			await setNumber(page, sides.nth(i), value);
		}

		await device('Mobile').click();
		await unit('em');
		for (const [i, value] of ['1', '2', '3', '4'].entries()) {
			await setNumber(page, sides.nth(i), value);
		}
		await update(page);

		const stored = meta(id, 'caption_padding') as Record<
			string,
			Record<string, { value: number; unit: string }>
		>;
		expect(stored.desktop).toEqual({
			top: { value: 4, unit: 'px' },
			right: { value: 8, unit: 'px' },
			bottom: { value: 12, unit: 'px' },
			left: { value: 16, unit: 'px' },
		});
		expect(stored.mobile).toEqual({
			top: { value: 1, unit: 'em' },
			right: { value: 2, unit: 'em' },
			bottom: { value: 3, unit: 'em' },
			left: { value: 4, unit: 'em' },
		});

		const css = await galleryCss(request, url, id);
		expect(css.base).toContain('--fg-caption-padding: 4px 8px 12px 16px;');
		expect(css.mobile).toContain('--fg-caption-padding: 1em 2em 3em 4em;');
	}
);

/** A Pro-tier field shows as a disabled teaser, and saving the gallery keeps the value it already had. */
test(
	'SET-16: a Pro-tier field is a disabled teaser whose stored value survives a Free save',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage({
			layout: 'grid',
			disable_right_click: true,
		});
		const panel = await openEditor(page, id);
		await panel.openTab('Security');

		const field = panel.field('disable_right_click');
		await expect(field).toBeVisible();
		await expect(field).toHaveClass(/fotogrids-setting--disabled/);
		await expect(field.locator('.fotogrids-field-gate')).toHaveClass(
			/fotogrids-field-gate--teaser/
		);
		await expect(panel.switchIn('disable_right_click')).toHaveAttribute(
			'aria-checked',
			'true'
		);

		await panel.switchIn('disable_right_click').click({ force: true });
		await expect(panel.switchIn('disable_right_click')).toHaveAttribute(
			'aria-checked',
			'true'
		);

		await panel.openTab('Styling');
		await panel.switchIn('border_enabled').click();
		await update(page);

		expect(meta(id, 'border_enabled')).toBeTruthy();
		expect([true, '1', 1]).toContain(meta(id, 'disable_right_click'));
	}
);
