import { test, expect } from './support/test';
import { galleryPage, setSettings } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { copyItems, deleteItems } from './support/item-copies';

/**
 * Item captions on the front end: placement, visibility, the text they show,
 * how it is limited and styled, and when there is no caption at all.
 *
 * scoped: each test renders galleries it created; item copies it adds are its
 * own and are deleted afterwards.
 */

const MOBILE = { width: 500, height: 900 };

/** Text of the first item's caption parts. */
function firstCaption(gallery: GalleryRender) {
	const caption = gallery.items().first().locator('figcaption');

	return {
		title: caption.locator('.fg-caption-title'),
		description: caption.locator('.fg-caption-description'),
		box: caption,
	};
}

/** CAP-01: top and bottom captions sit outside the media, overlay inside it. */
test(
	'CAP-01: top and bottom captions flow outside the media with the set gap, overlay sits on it with none',
	{ tag: '@visual' },
	async ({ page }) => {
		const GAP = { desktop: 14, tablet: 14, mobile: 14 };
		const { id, url } = galleryPage({
			layout: 'grid',
			caption_placement: 'top',
			caption_gap: GAP,
		});
		const gallery = new GalleryRender(page, id);

		/** Caption box against the media box, and the item's gap. */
		const geometry = () =>
			gallery
				.items()
				.first()
				.evaluate((item) => {
					const media = item
						.querySelector('.fg-item-media')!
						.getBoundingClientRect();
					const caption = item
						.querySelector('figcaption')!
						.getBoundingClientRect();
					return {
						above: caption.bottom <= media.top,
						below: caption.top >= media.bottom,
						inside:
							caption.top >= media.top - 1 &&
							caption.bottom <= media.bottom + 1,
						gap: getComputedStyle(item).rowGap,
					};
				});

		await page.goto(url);
		await gallery.waitFor();
		await expect(gallery.root).toHaveAttribute('data-fg-caption', 'top');
		expect(await gallery.cssVar('caption-gap')).toBe('14px');
		expect(await geometry()).toMatchObject({ above: true, gap: '14px' });

		setSettings(id, { caption_placement: 'bottom' });
		await page.goto(url);
		await expect(gallery.root).toHaveAttribute('data-fg-caption', 'bottom');
		expect(await geometry()).toMatchObject({ below: true, gap: '14px' });

		setSettings(id, { caption_placement: 'overlay' });
		await page.goto(url);
		await expect(gallery.root).toHaveAttribute(
			'data-fg-caption',
			'overlay'
		);
		expect(await gallery.cssVar('caption-gap')).toBe('0');
		expect(await geometry()).toMatchObject({ inside: true, gap: '0px' });
	}
);

/** CAP-02: the attribute appears only for the two hover modes, and acts. */
test(
	'CAP-02: caption visibility is stamped only when not Always, and hover shows or hides the caption',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			caption_visibility: 'always',
		});
		const gallery = new GalleryRender(page, id);
		const opacity = () =>
			firstCaption(gallery).box.evaluate(
				(el) => getComputedStyle(el).opacity
			);

		await page.goto(url);
		await gallery.waitFor();
		expect(await gallery.attr('caption-show')).toBeNull();
		await gallery.items().first().hover();
		expect(await opacity()).toBe('1');

		for (const [mode, idle, hovered] of [
			['show_on_hover', '0', '1'],
			['hide_on_hover', '1', '0'],
		] as const) {
			setSettings(id, { caption_visibility: mode });
			await page.mouse.move(0, 0);
			await page.goto(url);
			await expect(gallery.root).toHaveAttribute(
				'data-fg-caption-show',
				mode
			);
			await expect.poll(opacity, { message: mode }).toBe(idle);
			await gallery.items().first().hover();
			await expect.poll(opacity, { message: mode }).toBe(hovered);
		}
	}
);

/** CAP-03: the caption title reads the field the source names. */
test(
	'CAP-03: the caption title shows the item field chosen as its source',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({ layout: 'grid' });
		const gallery = new GalleryRender(page, id);

		// F-small item 1 holds a distinct value in each field.
		for (const [source, text] of [
			['item_title', 'Small 1'],
			['item_caption', 'Caption for item 1'],
			['item_alt', 'Test image 1, landscape'],
			['item_description', 'Description for item 1.'],
		]) {
			setSettings(id, { caption_title_source: source });
			await page.goto(url);
			await expect(firstCaption(gallery).title, source).toHaveText(text);
		}
	}
);

/** CAP-04: Characters cuts the text on the server; Lines clamps in CSS. */
test(
	'CAP-04: a character limit truncates the text, a line limit clamps it with no truncation',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			caption_limit_title_length: 'characters',
			caption_max_title_characters: { desktop: 5, tablet: 5, mobile: 5 },
			caption_limit_description_length: 'characters',
			caption_max_desc_characters: { desktop: 9, tablet: 9, mobile: 9 },
		});
		const gallery = new GalleryRender(page, id);
		const caption = firstCaption(gallery);
		const clamp = (part: 'title' | 'description') =>
			caption[part].evaluate((el) =>
				getComputedStyle(el).getPropertyValue('-webkit-line-clamp')
			);

		await page.goto(url);
		await gallery.waitFor();
		await expect(caption.title).toHaveText('Small…');
		await expect(caption.description).toHaveText('Caption f…');
		expect(await gallery.cssVar('caption-title-lines')).toBe('');
		expect(await gallery.cssVar('caption-desc-lines')).toBe('');
		expect(await clamp('title')).toBe('none');

		setSettings(id, {
			caption_limit_title_length: 'lines',
			caption_max_title_lines: { desktop: 2, tablet: 2, mobile: 3 },
			caption_limit_description_length: 'lines',
			caption_max_desc_lines: { desktop: 4, tablet: 4, mobile: 1 },
		});
		await page.goto(url);
		await expect(caption.title).toHaveText('Small 1');
		await expect(caption.description).toHaveText('Caption for item 1');
		expect(await gallery.cssVar('caption-title-lines')).toBe('2');
		expect(await clamp('title')).toBe('2');
		expect(await clamp('description')).toBe('4');

		await page.setViewportSize(MOBILE);
		expect(await clamp('title')).toBe('3');
		expect(await clamp('description')).toBe('1');

		setSettings(id, {
			caption_limit_title_length: 'no',
			caption_limit_description_length: 'no',
		});
		await page.goto(url);
		await expect(caption.title).toHaveText('Small 1');
		expect(await gallery.cssVar('caption-title-lines')).toBe('');
		expect(await clamp('description')).toBe('none');
	}
);

/** CAP-07: family, weight, style and per-breakpoint size reach both parts. */
test(
	'CAP-07: caption typography styles the title and the description, size per breakpoint',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'grid',
			caption_title_font_family: 'Georgia',
			caption_title_font_weight: '700',
			caption_title_font_style: 'italic',
			caption_title_font_size: { desktop: 22, tablet: 20, mobile: 13 },
			caption_description_font_family: 'Courier New',
			caption_description_font_weight: '300',
			caption_description_font_style: 'normal',
			caption_description_font_size: {
				desktop: 15,
				tablet: 14,
				mobile: 9,
			},
		});
		const gallery = new GalleryRender(page, id);
		const caption = firstCaption(gallery);
		const font = (part: 'title' | 'description') =>
			caption[part].evaluate((el) => {
				const s = getComputedStyle(el);
				return [s.fontFamily, s.fontWeight, s.fontStyle, s.fontSize];
			});

		await page.goto(url);
		await gallery.waitFor();

		expect(await font('title')).toEqual([
			'Georgia, sans-serif',
			'700',
			'italic',
			'22px',
		]);
		expect(await font('description')).toEqual([
			'"Courier New", sans-serif',
			'300',
			'normal',
			'15px',
		]);
		await expect(page.locator('#fotogrids-google-fonts-css')).toHaveCount(
			0
		);

		await page.setViewportSize(MOBILE);
		expect((await font('title'))[3]).toBe('13px');
		expect((await font('description'))[3]).toBe('9px');
	}
);

/** CAP-08: an overlay caption is dropped from videos that play in place. */
test(
	'CAP-08: inline-playing videos get no overlay caption; images, and videos in other modes, keep theirs',
	{ tag: '@visual' },
	async ({ page }) => {
		const image = fixture<number[]>('F-small', 'items')[0];
		const video = fixture<number>('F-mixed', 'video');
		const youtube = fixture<number>('F-mixed', 'youtube');
		const { id, url } = galleryPage(
			{
				layout: 'grid',
				caption_placement: 'overlay',
				video_playback_mode: 'inline',
				caption_title_source: 'item_title',
			},
			[image, video, youtube]
		);
		const gallery = new GalleryRender(page, id);
		const captioned = () =>
			gallery
				.items()
				.evaluateAll((items) =>
					items.map(
						(item) => null !== item.querySelector('figcaption')
					)
				);

		await page.goto(url);
		await gallery.waitFor();
		await expect(gallery.items()).toHaveCount(3);
		expect(await captioned()).toEqual([true, false, false]);

		setSettings(id, { video_playback_mode: 'lightbox' });
		await page.goto(url);
		expect(await captioned()).toEqual([true, true, true]);

		setSettings(id, {
			video_playback_mode: 'inline',
			caption_placement: 'bottom',
		});
		await page.goto(url);
		expect(await captioned()).toEqual([true, true, true]);
	}
);

/** CAP-10: items with nothing to show get no caption element at all. */
test(
	'CAP-10: an item with no title and no caption renders no caption box',
	{ tag: '@visual' },
	async ({ page }) => {
		const { id, url } = galleryPage({ layout: 'grid' }, [
			...fixture<number[]>('F-noalt', 'items'),
			fixture<number[]>('F-small', 'items')[0],
		]);
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		await expect(gallery.items()).toHaveCount(4);
		await expect(gallery.root.locator('figcaption')).toHaveCount(1);
		await expect(
			gallery.root.locator('.fg-caption-title:empty')
		).toHaveCount(0);
		await expect(
			gallery.items().nth(3).locator('figcaption .fg-caption-title')
		).toHaveText('Small 1');
	}
);

test.describe('captions that stress the layout', () => {
	let copies: number[] = [];

	const LONG = Array.from({ length: 250 }, (_, n) => `word${n}`).join(' ');

	test.beforeAll(() => {
		const source = fixture<number[]>('F-small', 'items')[0];
		copies = copyItems(source, [
			{ title: 'Long', caption: LONG.slice(0, 2000) },
			{ title: 'Unbroken', caption: 'x'.repeat(400) },
			{
				title: 'עברית',
				caption: 'כיתוב ארוך בעברית שזורם מימין לשמאל '.repeat(8),
			},
			{
				title: 'العربية',
				caption: 'تعليق طويل باللغة العربية '.repeat(10),
			},
		]);
	});

	test.afterAll(() => deleteItems(copies));

	/**
	 * CAP-11: long, unbroken, CJK and RTL captions stay inside their item and
	 * never widen the page.
	 */
	test(
		'CAP-11: long, unbroken, CJK and right-to-left captions stay inside their items',
		{ tag: '@visual' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'grid',
					caption_placement: 'bottom',
					caption_description_source: 'item_caption',
					caption_limit_description_length: 'no',
				},
				[...copies, ...fixture<number[]>('F-cjk', 'items')]
			);
			const gallery = new GalleryRender(page, id);

			for (const viewport of [{ width: 1280, height: 900 }, MOBILE]) {
				await page.setViewportSize(viewport);
				await page.goto(url);
				await gallery.waitFor();
				await expect(gallery.items()).toHaveCount(7);

				const overflow = await gallery.items().evaluateAll((items) =>
					items
						.map((item, index) => {
							const box = item.getBoundingClientRect();
							const caption = item.querySelector('figcaption');
							const text = caption?.getBoundingClientRect();
							return text &&
								(text.left < box.left - 1 ||
									text.right > box.right + 1 ||
									caption!.scrollWidth >
										caption!.clientWidth + 1)
								? index
								: -1;
						})
						.filter((index) => index >= 0)
				);
				expect(overflow, `${viewport.width}px`).toEqual([]);

				const pageWidth = await page.evaluate(() => [
					document.documentElement.scrollWidth,
					document.documentElement.clientWidth,
				]);
				expect(pageWidth[0], `${viewport.width}px`).toBeLessThanOrEqual(
					pageWidth[1]
				);
			}
		}
	);
});
