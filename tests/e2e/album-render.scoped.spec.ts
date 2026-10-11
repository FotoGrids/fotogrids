import { test, expect } from './support/test';
import {
	album,
	galleryPage,
	multiGalleryPage,
	shortcodePage,
} from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';

/**
 * What an album renders, and how a gallery finds its way back to one.
 *
 * scoped: each test makes its own galleries and albums.
 *
 * The breadcrumb's settings live on the album, not the gallery, so the rows set
 * them there and read the result off the gallery's own page.
 */

const five = (): number[] => fixture<number[]>('F-small', 'items');

/** Breadcrumbs on, on a direct visit too, so a row can switch one thing off. */
const CRUMBS = {
	navigation_show_breadcrumbs: true,
	navigation_show_breadcrumbs_on_direct_visit: true,
};

function gallery(settings: Record<string, unknown> = {}): number {
	return galleryPage({ layout: 'grid', ...settings }, five().slice(0, 2)).id;
}

/** The gallery's own view page. */
function viewOf(id: number): string {
	return wpEval(`echo get_permalink( ${id} );`).trim();
}

const BREADCRUMB = '.fg-breadcrumbs';

test.describe('an album', () => {
	test(
		'ALB-01: renders one tile per gallery under an album wrapper',
		{
			tag: ['@layout', '@critical'],
		},
		async ({ page }) => {
			const children = [gallery(), gallery(), gallery()];
			const { id, url } = album(children);

			await page.goto(url);

			const wrapper = page.locator(`[data-fg-album-id="${id}"]`);
			await expect(wrapper).toBeVisible();

			// The umbrella class the runtime discovers by, and the kind beside it.
			await expect(wrapper).toHaveClass(/\bfotogrids-collection\b/);
			await expect(wrapper).toHaveClass(/\bfotogrids-album\b/);
			await expect(wrapper).not.toHaveClass(/\bfotogrids-gallery\b/);

			// An album is not a gallery, so its gallery id is the zero the
			// runtime treats as "none".
			expect(await wrapper.getAttribute('data-fg-gallery-id')).toBe('0');

			await expect(wrapper.locator('.fg-item')).toHaveCount(
				children.length
			);
		}
	);

	/**
	 * ALB-02. A gallery with no featured image and no items has nothing to show
	 * for a cover, and is left out of the album rather than given an empty
	 * tile. Pinned as it is; whether a placeholder would be better is a
	 * product call, not this row's.
	 */
	test(
		'ALB-02: a gallery with nothing to show for a cover is left out',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const empty = galleryPage({ layout: 'grid' }, []).id;
			const children = [gallery(), empty, gallery()];
			const { id, url } = album(children);

			await page.goto(url);

			const wrapper = page.locator(`[data-fg-album-id="${id}"]`);
			await expect(wrapper.locator('.fg-item')).toHaveCount(2);
			await expect(
				wrapper.locator(`[data-fg-gallery-id="${empty}"]`),
				'the coverless gallery got a tile'
			).toHaveCount(0);
		}
	);

	/**
	 * ALB-04. With AJAX off, each tile is a link to the gallery's own page,
	 * carrying the album it came from so that page can point back at it.
	 */
	test(
		'ALB-04: tiles link to the gallery page and say which album they came from',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const child = gallery();
			const { id, url } = album([child], { use_ajax_from_album: false });

			await page.goto(url);

			const tile = page.locator(
				`[data-fg-album-id="${id}"] a[data-fg-album-target="view-page"][data-fg-gallery-id="${child}"]`
			);
			await expect(tile).toBeAttached();

			const href = new URL(String(await tile.getAttribute('href')));
			expect(`${href.origin}${href.pathname}`).toBe(viewOf(child));
			expect(href.searchParams.get('fg_via')).toBe(String(id));
		}
	);

	/**
	 * ALB-20. The gallery shortcode answers a missing id with an error an editor
	 * can see. The album shortcode answers with nothing at all. Pinned as the
	 * divergence it is.
	 */
	test(
		'ALB-20: a missing album renders nothing, where a missing gallery says so',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const missing = 987_654;

			await page.goto(shortcodePage(missing, '', 'album').url);
			await expect(page.locator('.fotogrids-error')).toHaveCount(0);
			await expect(page.locator('.fotogrids-collection')).toHaveCount(0);

			await page.goto(shortcodePage(missing, '', 'gallery').url);
			await expect(page.locator('.fotogrids-error')).toHaveCount(1);
		}
	);
});

/**
 * The breadcrumb's three branches. The parent is the album the visitor came
 * through when that is one of the gallery's albums, otherwise the only album it
 * is in, otherwise nothing - two albums and no hint is ambiguous, so no trail is
 * better than a wrong one.
 */
test.describe('the breadcrumb', () => {
	test(
		'ALB-08: a gallery in one album shows the trail back to it',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const child = gallery();
			const parent = album([child], CRUMBS);

			await page.goto(viewOf(child));

			const crumbs = page.locator(BREADCRUMB);
			await expect(crumbs).toBeVisible();
			await expect(
				crumbs.locator(`a[href="${parent.view}"]`)
			).toHaveCount(1);
		}
	);

	test(
		'ALB-11: a direct visit hides it unless the album asks otherwise',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const child = gallery();
			const parent = album([child], {
				...CRUMBS,
				navigation_show_breadcrumbs_on_direct_visit: false,
			});

			await page.goto(viewOf(child));
			await expect(
				page.locator(BREADCRUMB),
				'shown on a direct visit'
			).toHaveCount(0);

			// Arriving through the album is not a direct visit.
			await page.goto(`${viewOf(child)}?fg_via=${parent.id}`);
			await expect(page.locator(BREADCRUMB)).toBeVisible();
		}
	);

	test(
		'ALB-09: a gallery in two albums shows nothing without a hint',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const child = gallery();
			album([child], CRUMBS);
			album([child], CRUMBS);

			await page.goto(viewOf(child));

			await expect(
				page.locator(BREADCRUMB),
				'guessed between two albums'
			).toHaveCount(0);
		}
	);

	test(
		'ALB-09: with a hint, it follows the album the visitor came through',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const child = gallery();
			const first = album([child], CRUMBS);
			const second = album([child], CRUMBS);

			for (const parent of [first, second]) {
				await page.goto(`${viewOf(child)}?fg_via=${parent.id}`);

				const crumbs = page.locator(BREADCRUMB);
				await expect(crumbs).toBeVisible();
				await expect(
					crumbs.locator(`a[href="${parent.view}"]`)
				).toHaveCount(1);
			}
		}
	);

	/**
	 * ALB-10. A hint naming an album the gallery is not in is treated as no
	 * hint at all, so a single-album gallery still finds its real parent - the
	 * query string cannot point a breadcrumb anywhere else.
	 */
	test(
		'ALB-10: a hint naming the wrong album is ignored',
		{ tag: '@layout' },
		async ({ page }) => {
			const child = gallery();
			const parent = album([child], CRUMBS);
			const unrelated = album([gallery()], CRUMBS);

			await page.goto(`${viewOf(child)}?fg_via=${unrelated.id}`);

			const crumbs = page.locator(BREADCRUMB);
			await expect(crumbs).toBeVisible();
			await expect(
				crumbs.locator(`a[href="${parent.view}"]`)
			).toHaveCount(1);
			await expect(
				crumbs.locator(`a[href="${unrelated.view}"]`)
			).toHaveCount(0);
		}
	);

	/**
	 * ALB-19. The header memoises its resolution once per request. Two
	 * galleries from different albums on one page are the case that would
	 * catch a memo keyed on too little: the second would inherit the first's
	 * trail.
	 */
	test(
		'ALB-19: two galleries on one page each point at their own album',
		{
			tag: '@layout',
		},
		async ({ page }) => {
			const one = gallery();
			const two = gallery();
			const firstAlbum = album([one], CRUMBS);
			const secondAlbum = album([two], CRUMBS);

			await page.goto(multiGalleryPage([one, two]).url);

			const crumbsOf = (id: number) =>
				new GalleryRender(page, id).root.locator(BREADCRUMB);

			await expect(crumbsOf(one)).toBeVisible();
			await expect(crumbsOf(two)).toBeVisible();

			await expect(
				crumbsOf(one).locator(`a[href="${firstAlbum.view}"]`)
			).toHaveCount(1);
			await expect(
				crumbsOf(two).locator(`a[href="${secondAlbum.view}"]`),
				"the second gallery shows the first gallery's album"
			).toHaveCount(1);
		}
	);
});
