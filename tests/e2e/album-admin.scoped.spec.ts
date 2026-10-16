import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { storageStateFor, wpEval } from './support/roles';

/**
 * The two places an editor puts galleries into albums: the album's Galleries
 * box, and the Albums box on the gallery screen. Each row checks the change
 * survives a reload and reaches what a visitor is shown.
 *
 * scoped: each test makes its own galleries and albums.
 */

test.use({ storageState: storageStateFor('administrator') });

const five = (): number[] => fixture<number[]>('F-small', 'items');

let serial = 0;

/** A title no other row's search will match. */
function unique(prefix: string): string {
	serial += 1;
	return `${prefix} ${Date.now()}-${process.pid}-${serial}`;
}

/** A gallery with a title of its own and two items. */
function gallery(title: string, items = five().slice(0, 2)): number {
	return galleryPage({ layout: 'grid' }, items, title).id;
}

/** The galleries an album holds, in order, as stored. */
function children(albumId: number): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( array_map( 'intval', wp_list_pluck( FotoGrids\\Gallery_Album_Relations::get_galleries_for_album( ${albumId} ), 'ID' ) ) );`
		).trim()
	);
}

/** The albums a gallery is in, as stored. */
function parents(galleryId: number): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( array_map( 'intval', wp_list_pluck( FotoGrids\\Gallery_Album_Relations::get_albums_for_gallery( ${galleryId} ), 'ID' ) ) );`
		).trim()
	);
}

/** The gallery ids of an album's tiles, in the order a visitor sees them. */
async function tiles(page: Page, url: string, albumId: number) {
	await page.goto(url);
	return page
		.locator(
			`[data-fg-album-id="${albumId}"] .fg-item [data-fg-gallery-id]`
		)
		.evaluateAll((links) =>
			links.map((link) => Number(link.getAttribute('data-fg-gallery-id')))
		);
}

function stem(attachmentId: number): string {
	return wpEval(
		`echo pathinfo( get_attached_file( ${attachmentId} ), PATHINFO_FILENAME );`
	).trim();
}

/** Run `act` and wait for the REST write it makes to succeed. */
async function restWrite(
	page: Page,
	route: string,
	act: () => Promise<void>
): Promise<void> {
	const response = page.waitForResponse(
		(r) => r.url().includes(route) && 'GET' !== r.request().method()
	);
	await act();
	expect((await response).status(), route).toBe(200);
}

async function openAlbum(page: Page, albumId: number): Promise<void> {
	await page.goto(`/wp-admin/post.php?post=${albumId}&action=edit`);
	await expect(page.locator('.fotogrids-album-galleries')).toBeVisible({
		timeout: 15000,
	});
}

async function openGallery(page: Page, galleryId: number): Promise<void> {
	await page.goto(`/wp-admin/post.php?post=${galleryId}&action=edit`);
	await expect(page.locator('.fotogrids-album-assignment')).toBeVisible({
		timeout: 15000,
	});
}

/** The titles in the album's assigned list, top to bottom. */
function assignedTitles(page: Page) {
	return page
		.locator('.fotogrids-assigned-galleries .fotogrids-gallery-title')
		.allInnerTexts();
}

test.describe("the album's Galleries box", () => {
	test(
		'ALB-17: a gallery found by search and added joins the album',
		{
			tag: '@admin',
		},
		async ({ page }) => {
			const title = unique('Joins');
			const joining = gallery(title);
			const parent = album([]);

			await openAlbum(page, parent.id);
			await page
				.locator('.fotogrids-available-section .fotogrids-search-input')
				.fill(title);
			const found = page.locator(
				'.fotogrids-available-galleries .fotogrids-gallery-item'
			);
			await expect(found).toHaveCount(1);
			await expect(found).toContainText(title);

			await restWrite(page, `/admin/albums/${parent.id}/galleries`, () =>
				found.locator('.fg-action-button--add').click()
			);

			expect(children(parent.id)).toEqual([joining]);

			await openAlbum(page, parent.id);
			expect(await assignedTitles(page)).toEqual([title]);
			expect(await tiles(page, parent.url, parent.id)).toEqual([joining]);
		}
	);

	test(
		'ALB-17: dragging a gallery changes the order the album shows',
		{
			tag: '@admin',
		},
		async ({ page }) => {
			const first = unique('First');
			const second = unique('Second');
			const ids = [gallery(first), gallery(second)];
			const parent = album(ids);

			await openAlbum(page, parent.id);
			const rows = page.locator(
				'.fotogrids-assigned-galleries [draggable="true"]'
			);
			await restWrite(
				page,
				`/admin/albums/${parent.id}/galleries/reorder`,
				() => rows.nth(1).dragTo(rows.nth(0))
			);

			expect(children(parent.id)).toEqual([ids[1], ids[0]]);

			await openAlbum(page, parent.id);
			expect(await assignedTitles(page)).toEqual([second, first]);
			expect(await tiles(page, parent.url, parent.id)).toEqual([
				ids[1],
				ids[0],
			]);
		}
	);

	/**
	 * The featured gallery is the album's share image when the album has no
	 * Featured / Share image of its own. Without one, the first gallery's
	 * cover stands in.
	 */
	test(
		"ALB-17: the featured gallery becomes the album's share image, survives a reload, and one click clears it",
		{
			tag: '@admin',
		},
		async ({ page, context }) => {
			const [a1, a2, b1, b2] = five();
			const firstTitle = unique('Opens');
			const featuredTitle = unique('Featured');
			const parent = album([
				gallery(firstTitle, [a1, a2]),
				gallery(featuredTitle, [b1, b2]),
			]);

			// The view page in a tab of its own, so the editor stays as loaded.
			const view = await context.newPage();
			const shareImage = view.locator('meta[property="og:image"]');
			const sharedCover = async (attachmentId: number) => {
				await view.goto(parent.view);
				await expect(shareImage).toHaveAttribute(
					'content',
					new RegExp(stem(attachmentId))
				);
			};

			await sharedCover(a1);

			await openAlbum(page, parent.id);
			const button = page
				.locator(
					'.fotogrids-assigned-galleries .fotogrids-gallery-item'
				)
				.filter({ hasText: featuredTitle })
				.locator('.fotogrids-featured-button');

			await restWrite(page, `/album/${parent.id}/featured-gallery`, () =>
				button.click()
			);
			await expect(button).toHaveAttribute('aria-pressed', 'true');
			await sharedCover(b1);

			await openAlbum(page, parent.id);
			await expect(button).toHaveAttribute('aria-pressed', 'true');

			await restWrite(page, `/album/${parent.id}/featured-gallery`, () =>
				button.click()
			);
			await expect(button).toHaveAttribute('aria-pressed', 'false');
			await sharedCover(a1);

			await view.close();
		}
	);

	test(
		'ALB-17: a removed gallery leaves the album',
		{
			tag: '@admin',
		},
		async ({ page }) => {
			const leaving = unique('Leaves');
			const staying = unique('Stays');
			const ids = [gallery(leaving), gallery(staying)];
			const parent = album(ids);

			await openAlbum(page, parent.id);
			await restWrite(
				page,
				`/admin/albums/${parent.id}/galleries/${ids[0]}`,
				() =>
					page
						.locator(
							'.fotogrids-assigned-galleries .fotogrids-gallery-item'
						)
						.filter({ hasText: leaving })
						.locator('.fg-action-button--remove')
						.click()
			);

			expect(children(parent.id)).toEqual([ids[1]]);

			await openAlbum(page, parent.id);
			expect(await assignedTitles(page)).toEqual([staying]);
			expect(await tiles(page, parent.url, parent.id)).toEqual([ids[1]]);
		}
	);
});

/**
 * ALB-18. The gallery screen's Albums box, which assigns from the other side.
 */
test.describe("the gallery's Albums box", () => {
	test(
		'ALB-18: search narrows the albums, and adding then removing one assigns and unassigns the gallery',
		{
			tag: '@admin',
		},
		async ({ page }) => {
			const id = gallery(unique('Assigned'));
			const wanted = unique('Wanted album');
			const target = album([], {}, wanted);
			album([], {}, unique('Other album'));

			await openGallery(page, id);
			await page
				.locator('.fotogrids-album-assignment .fotogrids-search-input')
				.fill(wanted);
			const found = page.locator('.fotogrids-album-item.available');
			await expect(found).toHaveCount(1);
			await expect(found).toContainText(wanted);

			await restWrite(page, `/admin/galleries/${id}/albums`, () =>
				found.locator('.fg-action-button--add').click()
			);
			expect(parents(id)).toEqual([target.id]);

			await openGallery(page, id);
			const assigned = page.locator('.fotogrids-assigned-album');
			await expect(assigned).toHaveCount(1);
			await expect(assigned).toContainText(wanted);
			expect(await tiles(page, target.url, target.id)).toEqual([id]);

			await openGallery(page, id);
			await restWrite(
				page,
				`/admin/galleries/${id}/albums/${target.id}`,
				() => assigned.locator('.fg-action-button--remove').click()
			);
			expect(parents(id)).toEqual([]);

			await openGallery(page, id);
			await expect(page.locator('.fotogrids-assigned-album')).toHaveCount(
				0
			);
		}
	);

	test(
		'ALB-18: Create New Album opens a new album screen in another tab',
		{
			tag: '@admin',
		},
		async ({ page, context }) => {
			const id = gallery(unique('Creates'));

			await openGallery(page, id);
			const opened = context.waitForEvent('page');
			await page.locator('.fotogrids-create-album button').click();
			const tab = await opened;
			await tab.waitForLoadState();

			const url = new URL(tab.url());
			expect(url.pathname).toMatch(/\/wp-admin\/post-new\.php$/);
			expect(url.searchParams.get('post_type')).toBe('fotogrids_album');

			await tab.close();
		}
	);
});
