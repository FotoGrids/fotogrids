import { test, expect } from './support/test';
import { galleryPage, setSettings } from './support/collections';
import { fixture, firstItem } from './support/fixtures';
import { wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { copyItems, deleteItems } from './support/item-copies';

/**
 * What the full lightbox shows: the info panel blocks, the credit and EXIF
 * they read, the image size it loads, and its colour theme.
 *
 * scoped: each test renders galleries it created; item copies it adds are its
 * own and are deleted afterwards.
 */

const PANEL = {
	layout: 'grid',
	lightbox_variant: 'full',
	lightbox_auto_progress: false,
	lightbox_show_dots: true,
	lightbox_info_panel_enabled: true,
	lightbox_info_panel_default_state: 'open',
};

function isItemRequest(url: string): boolean {
	return decodeURIComponent(url).includes('/fotogrids/v1/lightbox/item/');
}

/** Open the lightbox on `index` and wait for that item's panel data. */
async function openWithDetails(
	gallery: GalleryRender,
	lightbox: Lightbox,
	index = 0
): Promise<void> {
	const page = gallery.root.page();
	const details = page.waitForResponse((r) => isItemRequest(r.url()));
	await lightbox.openFrom(gallery, index);
	expect((await details).status()).toBe(200);
}

function block(lightbox: Lightbox, id: string) {
	return lightbox.dialog().locator(`[data-fg-lb-block="${id}"]`);
}

/** LB-05: tags, people and location render as their own blocks. */
test(
	'LB-05: the tags, people and location blocks show the item’s terms, and drop out for an item without any',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const items = fixture<number[]>('F-tagged', 'items');
		const { id, url } = galleryPage(
			{ ...PANEL, lightbox_info_blocks: ['tags', 'people', 'location'] },
			[items[0], items[5]]
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();
		await openWithDetails(gallery, lightbox);

		await expect(
			block(lightbox, 'tags').locator('.fg-lb-info-chip')
		).toHaveText(['Architecture']);
		await expect(
			block(lightbox, 'people').locator('.fg-lb-info-chip')
		).toHaveText(['Ada Lovelace']);
		await expect(
			block(lightbox, 'location').locator('.fg-lb-info-location')
		).toHaveText('Tel Aviv');

		const untagged = page.waitForResponse((r) => isItemRequest(r.url()));
		await lightbox.goNext();
		await untagged;
		for (const id of ['tags', 'people', 'location']) {
			await expect(block(lightbox, id), id).toHaveCount(0);
		}
	}
);

test.describe('credit sources', () => {
	let copy = 0;

	test.beforeAll(() => {
		copy = copyItems(firstItem('F-exif'), [
			{ title: 'Credited', meta: { credit: 'Desk Credit' } },
		])[0];
	});

	test.afterAll(() => deleteItems([copy]));

	/**
	 * LB-06: each source reads its own place, and EXIF does not fall back to
	 * the stored credit or the XMP one when the file has no EXIF copyright.
	 */
	test(
		'LB-06: the credit comes from the chosen source only, with no fallback when EXIF has none',
		{ tag: '@lightbox' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{ ...PANEL, lightbox_info_blocks: ['credit'] },
				[copy]
			);
			const gallery = new GalleryRender(page, id);
			const lightbox = new Lightbox(page);
			const credit = block(lightbox, 'credit');

			for (const [source, expected] of [
				['item_meta', 'Desk Credit'],
				['xmp', fixture<string>('F-exif', 'credit')],
				['exif', null],
			] as const) {
				setSettings(id, { lightbox_credit_source: source });
				await page.goto(url);
				await gallery.waitFor();
				await openWithDetails(gallery, lightbox);

				if (null === expected) {
					await expect(credit, source).toHaveCount(0);
				} else {
					await expect(
						credit.locator('.fg-lb-info-credit'),
						source
					).toHaveText(expected);
				}
			}
		}
	);
});

/** LB-07: the EXIF block follows Display EXIF and the field list. */
test(
	'LB-07: the EXIF block shows only the chosen fields, and is absent with Display EXIF off',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const { id, url } = galleryPage(
			{
				...PANEL,
				lightbox_info_blocks: ['exif', 'file_info'],
				display_exif: true,
				exif_fields: ['camera', 'iso'],
			},
			[firstItem('F-exif')]
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);

		await page.goto(url);
		await gallery.waitFor();
		await openWithDetails(gallery, lightbox);

		const exif = block(lightbox, 'exif');
		await expect(exif.locator('dt')).toHaveCount(2);
		await expect(exif).toContainText('Fixture One');
		await expect(exif).not.toContainText('f/2.8');

		setSettings(id, { display_exif: false });
		await page.goto(url);
		await gallery.waitFor();
		await openWithDetails(gallery, lightbox);

		await expect(block(lightbox, 'file_info')).toBeVisible();
		await expect(exif).toHaveCount(0);
	}
);

/** URL of an attachment at a registered size. */
function sizeUrl(item: number, size: string): string {
	return wpEval(
		`echo wp_get_attachment_image_src( ${item}, '${size}' )[0];`
	).trim();
}

/**
 * LB-11 / LB-13: the Lightbox Image Size setting decides the image the
 * lightbox loads, both for an item on the page and for one fetched as a lazy
 * slide, and the two paths resolve it the same way.
 */
test(
	'LB-11 / LB-13: the lightbox loads the chosen image size, for rendered and for lazily fetched items alike',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const onPage = firstItem('F-exif');
		const lazy = fixture<number[]>('F-small', 'items')[0];
		const { id, url } = galleryPage(
			{
				...PANEL,
				full_image_size: 'medium_large',
				pagination_type: 'paginated',
				pagination_method: 'load_more',
				items_per_page: { desktop: 1, tablet: 1, mobile: 1 },
			},
			[onPage, lazy]
		);
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);
		const expected = [
			sizeUrl(onPage, 'medium_large'),
			sizeUrl(lazy, 'medium_large'),
		];

		expect(expected[0]).toMatch(/-\d+x\d+\.jpe?g$/);
		expect(expected[0]).not.toBe(sizeUrl(onPage, 'fotogrids_full'));

		await page.goto(url);
		await gallery.waitFor();
		await expect(gallery.items()).toHaveCount(1);
		await expect(gallery.triggers().first()).toHaveAttribute(
			'href',
			expected[0]
		);

		await lightbox.openFrom(gallery);
		await expect(lightbox.image()).toHaveAttribute('src', expected[0]);

		await lightbox.goNext();
		await expect(lightbox.image()).toHaveAttribute('src', expected[1]);

		setSettings(id, { full_image_size: 'medium' });
		await page.goto(url);
		await gallery.waitFor();
		await lightbox.openFrom(gallery);
		await expect(lightbox.image()).toHaveAttribute(
			'src',
			sizeUrl(onPage, 'medium')
		);
		await lightbox.goNext();
		await expect(lightbox.image()).toHaveAttribute(
			'src',
			sizeUrl(lazy, 'medium')
		);
	}
);

/** Every colour attribute the gallery carries for its lightbox. */
function colourAttrs(gallery: GalleryRender): Promise<Record<string, string>> {
	return gallery.root.evaluate((el) =>
		Object.fromEntries(
			Array.from(el.attributes)
				.filter(
					(a) =>
						a.name.startsWith('data-fg-lb-') &&
						/^(rgba?|#|hsla?)/.test(a.value)
				)
				.map((a) => [a.name, a.value])
		)
	);
}

/** LB-15: dark and light are fixed palettes; custom reads the saved colours. */
test(
	'LB-15: the dark, light and custom themes each colour the lightbox from their own palette',
	{ tag: ['@lightbox', '@visual'] },
	async ({ page }) => {
		const { id, url } = galleryPage({ ...PANEL, lightbox_theme: 'dark' });
		const gallery = new GalleryRender(page, id);
		const lightbox = new Lightbox(page);
		const backdrop = () =>
			lightbox
				.dialog()
				.locator('.fg-lb-backdrop')
				.evaluate((el) => getComputedStyle(el).backgroundColor);

		await page.goto(url);
		await gallery.waitFor();
		const dark = await colourAttrs(gallery);
		expect(Object.keys(dark).length).toBeGreaterThanOrEqual(40);
		expect(dark['data-fg-lb-bg']).toBe('rgba(0, 0, 0, 0.92)');
		await expect(gallery.root).toHaveAttribute('data-fg-lb-theme', 'dark');
		await lightbox.openFrom(gallery);
		expect(await backdrop()).toBe('rgba(0, 0, 0, 0.92)');

		setSettings(id, { lightbox_theme: 'light' });
		await page.goto(url);
		const light = await colourAttrs(gallery);
		expect(Object.keys(light)).toEqual(Object.keys(dark));
		expect(light['data-fg-lb-bg']).toBe('rgba(255, 255, 255, 0.96)');
		expect(light['data-fg-lb-arrow-color']).not.toBe(
			dark['data-fg-lb-arrow-color']
		);
		await lightbox.openFrom(gallery);
		expect(await backdrop()).toBe('rgba(255, 255, 255, 0.96)');

		setSettings(id, {
			lightbox_theme: 'custom',
			lightbox_background_color: 'rgba(18, 52, 86, 0.5)',
		});
		await page.goto(url);
		const custom = await colourAttrs(gallery);
		expect(custom['data-fg-lb-bg']).toBe('rgba(18, 52, 86, 0.5)');
		await lightbox.openFrom(gallery);
		expect(await backdrop()).toBe('rgba(18, 52, 86, 0.5)');
	}
);
