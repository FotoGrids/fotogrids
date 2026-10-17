import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { storageStateFor, wpEval } from './support/roles';

/**
 * The ways a gallery gets onto a page: the shortcodes in a classic post, and
 * the gallery and album blocks.
 *
 * scoped: each test makes its own collections and posts.
 */

const five = (): number[] => fixture<number[]>('F-small', 'items');

/** A published post with this content, marked for the purge. */
function postWith(
	content: string,
	status = 'publish'
): { id: number; url: string } {
	const encoded = Buffer.from(content, 'utf8').toString('base64');
	const id = Number(
		wpEval(
			`echo wp_insert_post( array( 'post_type' => 'post', 'post_status' => '${status}', 'post_title' => 'Insertion', 'post_content' => base64_decode( '${encoded}' ) ) );`
		).trim()
	);
	adopt(id);
	return {
		id,
		url: wpEval(`echo get_permalink( ${id} );`).trim(),
	};
}

function galleryBlock(attributes: Record<string, unknown>): string {
	return `<!-- wp:fotogrids/gallery ${JSON.stringify(attributes)} /-->`;
}

/** What a render shows of its items: their ids, in order. */
function itemIds(gallery: GalleryRender) {
	return gallery
		.items()
		.locator('[data-fg-item-id]')
		.evaluateAll((nodes) =>
			nodes.map((node) => node.getAttribute('data-fg-item-id'))
		);
}

async function renderOf(page: Page, url: string, id: number) {
	await page.goto(url);
	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	return {
		layout: await gallery.layout(),
		items: await itemIds(gallery),
		cols: await gallery.cssVar('cols'),
	};
}

test(
	'INS-01: a shortcode in a classic post renders a working gallery',
	{ tag: ['@layout', '@critical'] },
	async ({ page }) => {
		const id = galleryPage(
			{ layout: 'grid', item_click_behavior: 'lightbox' },
			five().slice(0, 3)
		).id;
		const { url } = postWith(
			`<p>Before.</p>\n\n[fotogrids_gallery id="${id}"]\n\n<p>After.</p>`
		);

		await page.goto(url);
		const gallery = new GalleryRender(page, id);
		await gallery.waitFor();
		await expect(gallery.items()).toHaveCount(3);

		// The runtime reached the page and wired the items: a click opens them.
		expect(
			await page.evaluate(
				() => typeof (window as { fotogrids?: unknown }).fotogrids
			)
		).toBe('object');
		await new Lightbox(page).openFrom(gallery);
	}
);

/**
 * INS-06. Every way the gallery shortcode can fail to render. Someone who can
 * edit posts is told why; a visitor gets an empty, hidden placeholder.
 */
test.describe('a shortcode that cannot render', () => {
	const cases = () => {
		const draft = galleryPage(
			{ layout: 'grid' },
			five().slice(0, 2),
			undefined,
			undefined,
			'draft'
		).id;
		const empty = galleryPage({ layout: 'grid' }, []).id;
		return [
			{
				name: 'with no id',
				shortcode: '[fotogrids_gallery]',
				says: 'No gallery ID specified',
			},
			{
				name: 'for a missing gallery',
				shortcode: '[fotogrids_gallery id="987654"]',
				says: 'Gallery with ID 987654 not found',
			},
			{
				name: 'for a draft gallery',
				shortcode: `[fotogrids_gallery id="${draft}"]`,
				says: `Gallery with ID ${draft} is not published (status: draft)`,
			},
			{
				name: 'for a gallery with no items',
				shortcode: `[fotogrids_gallery id="${empty}"]`,
				says: `Gallery with ID ${empty} exists but has no items`,
			},
		];
	};

	test.describe('to someone who can edit posts', () => {
		test.use({ storageState: storageStateFor('administrator') });

		test(
			'INS-06: says why, for each way it fails',
			{ tag: '@layout' },
			async ({ page }) => {
				for (const { name, shortcode, says } of cases()) {
					await page.goto(postWith(shortcode).url);
					const error = page.locator('.fotogrids-error');
					await expect(error, name).toHaveCount(1);
					await expect(error, name).toBeVisible();
					await expect(error, name).toContainText(says);
					await expect(
						page.locator('.fotogrids-collection'),
						name
					).toHaveCount(0);
				}
			}
		);
	});

	test(
		'INS-06: tells a visitor nothing, for each way it fails',
		{ tag: '@layout' },
		async ({ page }) => {
			for (const { name, shortcode, says } of cases()) {
				await page.goto(postWith(shortcode).url);
				const error = page.locator('.fotogrids-error');
				await expect(error, name).toHaveCount(1);
				await expect(error, name).toBeHidden();
				await expect(error, name).toHaveText('');
				await expect(page.locator('body'), name).not.toContainText(
					says
				);
			}
		}
	);
});

test.describe('the gallery block', () => {
	/**
	 * INS-08. The block hands the shortcode renderer its id and wraps the
	 * result in the block's own element; the gallery inside is the same.
	 */
	test(
		'INS-08: renders the gallery the shortcode renders, inside the block wrapper',
		{ tag: '@layout' },
		async ({ page }) => {
			const id = galleryPage(
				{
					layout: 'masonry',
					columns: { desktop: 4, tablet: 3, mobile: 2 },
				},
				five()
			).id;

			const shortcode = await renderOf(
				page,
				postWith(`[fotogrids_gallery id="${id}"]`).url,
				id
			);
			const block = await renderOf(
				page,
				postWith(galleryBlock({ galleryId: id })).url,
				id
			);

			expect(block).toEqual(shortcode);
			expect(block.layout).toBe('masonry');
			expect(block.items).toHaveLength(5);

			const wrapper = page.locator('.wp-block-fotogrids-gallery');
			await expect(wrapper).toHaveCount(1);
			await expect(
				wrapper.locator(`[data-fg-gallery-id="${id}"]`)
			).toHaveCount(1);
		}
	);

	test(
		'INS-10: alignment and spacing reach the block wrapper',
		{ tag: '@layout' },
		async ({ page }) => {
			const id = galleryPage({ layout: 'grid' }, five().slice(0, 2)).id;

			for (const align of ['wide', 'full']) {
				await page.goto(
					postWith(
						galleryBlock({
							galleryId: id,
							align,
							style: {
								spacing: {
									margin: { top: '37px' },
									padding: { left: '23px' },
								},
							},
						})
					).url
				);

				const wrapper = page.locator('.wp-block-fotogrids-gallery');
				await expect(wrapper, align).toHaveClass(
					new RegExp(`\\balign${align}\\b`)
				);
				await expect(wrapper, align).toHaveCSS('margin-top', '37px');
				await expect(wrapper, align).toHaveCSS('padding-left', '23px');
				await expect(wrapper.locator('.fg-item')).toHaveCount(2);
			}
		}
	);

	test(
		'INS-11: a block with no gallery chosen renders nothing',
		{ tag: '@layout' },
		async ({ page }) => {
			await page.goto(
				postWith(
					`<p>Before.</p>\n\n${galleryBlock({ galleryId: 0 })}\n\n<p>After.</p>`
				).url
			);

			await expect(page.getByText('After.')).toBeVisible();
			await expect(
				page.locator('.wp-block-fotogrids-gallery')
			).toHaveCount(0);
			await expect(page.locator('.fotogrids-collection')).toHaveCount(0);
			await expect(page.locator('.fotogrids-error')).toHaveCount(0);
		}
	);
});

test(
	'INS-09: the album block renders the album the shortcode renders',
	{ tag: '@layout' },
	async ({ page }) => {
		const galleries = [
			galleryPage({ layout: 'grid' }, five().slice(0, 2)).id,
			galleryPage({ layout: 'grid' }, five().slice(2, 4)).id,
		];
		const { id, url } = album(galleries);

		const tiles = async () =>
			page
				.locator(
					`[data-fg-album-id="${id}"] .fg-item [data-fg-gallery-id]`
				)
				.evaluateAll((links) =>
					links.map((link) => link.getAttribute('data-fg-gallery-id'))
				);

		await page.goto(url);
		const fromShortcode = await tiles();

		await page.goto(
			postWith(`<!-- wp:fotogrids/album {"albumId":${id}} /-->`).url
		);
		await expect(
			page.locator(`.wp-block-fotogrids-album [data-fg-album-id="${id}"]`)
		).toHaveCount(1);
		expect(await tiles()).toEqual(fromShortcode);
		expect(fromShortcode).toEqual(galleries.map(String));
	}
);
