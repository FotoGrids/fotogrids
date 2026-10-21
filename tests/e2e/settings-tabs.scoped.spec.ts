import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage, type Settings } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { storageStateFor } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Which collection-settings tabs the editor shows, and when.
 *
 * Scoped: each test opens a collection it created, and none of them saves.
 */

const FREE_LAYOUTS = [
	'Grid',
	'Masonry',
	'Justified',
	'Slider',
	'Image Viewer',
	'Single Item',
	'Featured Item',
	'Instant Photos',
] as const;

type Layout = (typeof FREE_LAYOUTS)[number];

async function openEditor(page: Page, id: number): Promise<CollectionSettings> {
	const panel = new CollectionSettings(page);
	await page.goto(`/wp-admin/post.php?post=${id}&action=edit`);
	await expect(
		page.locator('.fotogrids-settings-tab__label').first()
	).toBeVisible({
		timeout: 20000,
	});
	return panel;
}

async function chooseLayout(
	panel: CollectionSettings,
	name: Layout
): Promise<void> {
	await panel.openTab('Layout');
	await panel.layoutOption(name).click();
	await expect(panel.activeLayout()).toHaveText(name);
}

/** Click a button-group choice inside a field. */
async function choose(
	panel: CollectionSettings,
	key: string,
	title: string
): Promise<void> {
	const button = panel
		.field(key)
		.locator(`.fg-button-group__button[title="${title}"]`);
	await button.click();
	await expect(button).toHaveClass(/fg-is-active/);
}

/** Tab labels that are showing, by label. */
async function labelCount(
	panel: CollectionSettings,
	label: string
): Promise<number> {
	return (await panel.tabLabels()).filter((text) => text.trim() === label)
		.length;
}

/**
 * The catalog id of the one tab showing under a label. Several tabs share a
 * label, and clicking one writes its id to the URL.
 */
async function tabIdFor(
	page: Page,
	panel: CollectionSettings,
	label: string
): Promise<string | null> {
	expect(await labelCount(panel, label), `tabs labelled ${label}`).toBe(1);
	await panel.openTab(label);
	await expect
		.poll(() => new URL(page.url()).searchParams.get('fg-settings-tab'))
		.not.toBeNull();
	return new URL(page.url()).searchParams.get('fg-settings-tab');
}

async function variant(
	panel: CollectionSettings,
	title: string
): Promise<void> {
	await panel.openTab('Interactions');
	await panel.openSubtab(/^\s*Item Click Behavior\s*$/);
	await choose(panel, 'lightbox_variant', title);
}

/** Whether a tab shows for each free layout, chosen live in the picker. */
async function presenceByLayout(
	page: Page,
	label: string,
	settings: Settings = {}
): Promise<Record<string, boolean>> {
	const { id } = galleryPage({ layout: 'grid', ...settings });
	const panel = await openEditor(page, id);
	const seen: Record<string, boolean> = {};

	for (const layout of FREE_LAYOUTS) {
		await chooseLayout(panel, layout);
		seen[layout] = (await labelCount(panel, label)) > 0;
	}

	return seen;
}

/** Filtering follows the layout's ability to filter. */
test(
	'SET-07: Filtering is offered for every free layout except the single-view ones',
	{ tag: ['@admin', '@settings'] },
	async ({ page }, testInfo) => {
		testInfo.setTimeout(120_000);

		expect(await presenceByLayout(page, 'Filtering')).toEqual({
			Grid: true,
			Masonry: true,
			Justified: true,
			Slider: true,
			'Image Viewer': false,
			'Single Item': false,
			'Featured Item': false,
			'Instant Photos': true,
		});
	}
);

/** Pagination follows the layout's ability to paginate. */
test(
	'SET-08: Pagination is offered only for grid, masonry, justified and instant photos',
	{ tag: ['@admin', '@settings'] },
	async ({ page }, testInfo) => {
		testInfo.setTimeout(120_000);

		expect(await presenceByLayout(page, 'Pagination')).toEqual({
			Grid: true,
			Masonry: true,
			Justified: true,
			Slider: false,
			'Image Viewer': false,
			'Single Item': false,
			'Featured Item': false,
			'Instant Photos': true,
		});
	}
);

/** A gallery's Navigation tab is the layout-navigation one, for the two stepping layouts. */
test(
	'SET-10: a gallery shows layout Navigation only for image viewer and slider',
	{ tag: ['@admin', '@settings'] },
	async ({ page }, testInfo) => {
		testInfo.setTimeout(120_000);

		expect(await presenceByLayout(page, 'Navigation')).toEqual({
			Grid: false,
			Masonry: false,
			Justified: false,
			Slider: true,
			'Image Viewer': true,
			'Single Item': false,
			'Featured Item': false,
			'Instant Photos': false,
		});

		const panel = new CollectionSettings(page);
		await chooseLayout(panel, 'Slider');
		expect(await tabIdFor(page, panel, 'Navigation')).toBe(
			'layout-navigation'
		);
		await expect(panel.field('layout_loop')).toBeVisible();
	}
);

/** An album has the album Navigation tab, whatever its layout. */
test(
	'SET-10: an album shows album Navigation and no layout Navigation',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = album([galleryPage().id], { layout: 'slider' });
		const panel = await openEditor(page, id);

		expect(await tabIdFor(page, panel, 'Navigation')).toBe('navigation');
		await expect(panel.field('navigation_show_breadcrumbs')).toBeVisible();
		await expect(panel.field('layout_loop')).toHaveCount(0);
	}
);

/** The Lightbox tab follows Item Click Behavior live, without a reload. */
test(
	'SET-05: Lightbox appears and disappears with Item Click Behavior',
	{ tag: ['@admin', '@settings', '@lightbox'] },
	async ({ page }) => {
		const { id } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'lightbox',
		});
		const panel = await openEditor(page, id);
		await page.evaluate(
			() =>
				((window as unknown as { fgNoReload: boolean }).fgNoReload =
					true)
		);

		expect(await labelCount(panel, 'Lightbox')).toBe(1);

		await panel.openTab('Interactions');
		await panel.openSubtab(/^\s*Item Click Behavior\s*$/);
		await choose(panel, 'item_click_behavior', 'Do Nothing');
		await expect.poll(() => labelCount(panel, 'Lightbox')).toBe(0);

		await choose(panel, 'item_click_behavior', 'Direct Link to Item');
		await expect.poll(() => labelCount(panel, 'Lightbox')).toBe(0);

		await choose(panel, 'item_click_behavior', 'Open in Lightbox');
		await expect.poll(() => labelCount(panel, 'Lightbox')).toBe(1);

		expect(
			await page.evaluate(
				() => (window as unknown as { fgNoReload?: boolean }).fgNoReload
			)
		).toBe(true);
	}
);

/** Exactly one lightbox tab shows, and which one follows layout and variant. */
test(
	'SET-06: one lightbox tab per layout and variant',
	{ tag: ['@admin', '@settings', '@lightbox'] },
	async ({ page }, testInfo) => {
		testInfo.setTimeout(120_000);
		const { id } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'lightbox',
			lightbox_variant: 'full',
		});
		const panel = await openEditor(page, id);

		expect(await tabIdFor(page, panel, 'Lightbox')).toBe('lightbox');

		await variant(panel, 'Lightbox Mini');
		expect(await tabIdFor(page, panel, 'Lightbox')).toBe('lightbox-mini');

		await variant(panel, 'Lightbox Grid');
		expect(await tabIdFor(page, panel, 'Lightbox')).toBe('lightbox-grid');

		// Instant Photos has no grid lightbox, so it falls back to the full one.
		await chooseLayout(panel, 'Instant Photos');
		expect(await tabIdFor(page, panel, 'Lightbox')).toBe('lightbox');

		await variant(panel, 'Lightbox Mini');
		expect(await tabIdFor(page, panel, 'Lightbox')).toBe('lightbox-mini');

		await chooseLayout(panel, 'Featured Item');
		expect(await tabIdFor(page, panel, 'Lightbox')).toBe('lightbox-grid');
	}
);

/** Featured Item opens its grid lightbox whatever the click behaviour says. */
test(
	'SET-06: a featured item gallery always gets the grid lightbox tab',
	{ tag: ['@admin', '@settings', '@lightbox'] },
	async ({ page }) => {
		const { id } = galleryPage({
			layout: 'featured-item',
			item_click_behavior: 'nothing',
			lightbox_variant: 'full',
		});
		const panel = await openEditor(page, id);

		expect(await tabIdFor(page, panel, 'Lightbox')).toBe('lightbox-grid');
	}
);
