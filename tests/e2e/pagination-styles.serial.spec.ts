import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';

/**
 * PAG-12. The stylesheets a Load More response names: one already on the page
 * is not linked again, one the page lacks is linked once ahead of the site's
 * CSS, and a site rule that styles the gallery keeps applying to new items.
 *
 * Serial: the site's Additional CSS is site-wide.
 */

test.describe.configure({ mode: 'serial' });

const PER_PAGE = (n: number) => ({ desktop: n, tablet: n, mobile: n });

/** The ids of the page's stylesheets, in document order. */
function stylesheets(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll('link[rel="stylesheet"], style')
		).map((el) => el.id)
	);
}

function setAdditionalCss(css: string): void {
	wpEval(
		`wp_update_custom_css_post( base64_decode( '${Buffer.from(css).toString('base64')}' ) );`
	);
}

test(
	'PAG-12: Load More keeps the site CSS winning and links each stylesheet once',
	{ tag: '@layout' },
	async ({ page }) => {
		const { id, url } = galleryPage(
			{
				layout: 'grid',
				pagination_type: 'paginated',
				pagination_method: 'load_more',
				items_per_page: PER_PAGE(12),
			},
			fixture<number[]>('F-large', 'items').slice(0, 36)
		);
		const before = wpEval(
			`echo base64_encode( wp_get_custom_css() );`
		).trim();
		// Same specificity as grid.css's `[data-fg-layout="grid"] .fg-item`,
		// so the order of the two stylesheets decides.
		setAdditionalCss(
			`[data-fg-gallery-id="${id}"] .fg-item { min-width: 7px; }`
		);

		try {
			await page.goto(url);
			const gallery = new GalleryRender(page, id);
			await gallery.waitFor();
			const minWidth = (index: number) =>
				gallery
					.items()
					.nth(index)
					.evaluate((el) => getComputedStyle(el).minWidth);

			const initial = await stylesheets(page);
			// Block themes print Additional CSS inside the global styles.
			const siteCss = await page.evaluate(
				(rule) =>
					Array.from(document.querySelectorAll('style')).find((el) =>
						(el.textContent ?? '').includes(rule)
					)?.id ?? '',
				`[data-fg-gallery-id="${id}"] .fg-item`
			);
			expect(siteCss, 'the site CSS is not on the page').not.toBe('');
			expect(await minWidth(0)).toBe('7px');

			await gallery.root.locator('.fg-pagination__load-more').click();
			await expect(gallery.items()).toHaveCount(24);
			expect(await minWidth(12), 'a new item lost the site rule').toBe(
				'7px'
			);
			expect(
				await stylesheets(page),
				'Load More linked a stylesheet again'
			).toEqual(initial);

			// A FotoGrids stylesheet the page lacks comes back once, ahead of
			// the site's CSS.
			const missing = initial.find((sheet) =>
				/^fotogrids-.*grid.*-css$/.test(sheet)
			);
			expect(missing, 'no grid stylesheet on the page').toBeTruthy();
			await page.evaluate(
				(sheet) => document.getElementById(sheet as string)?.remove(),
				missing
			);
			const handle = (missing as string).replace(/-css$/, '');

			await gallery.root.locator('.fg-pagination__load-more').click();
			await expect(gallery.items()).toHaveCount(36);

			const after = await stylesheets(page);
			const injected = `fotogrids-css-${handle}`;
			expect(after.filter((sheet) => sheet === injected)).toHaveLength(1);
			expect(after.indexOf(injected)).toBeLessThan(
				after.indexOf(siteCss)
			);
			expect(await minWidth(24)).toBe('7px');
		} finally {
			setAdditionalCss(Buffer.from(before, 'base64').toString());
		}
	}
);
