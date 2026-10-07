import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * Keyboard access to gallery items: each item is one Tab stop, its link,
 * which shows a focus ring and opens the lightbox from the keyboard. This
 * holds for items present at load and for items added later.
 *
 * Scoped: every gallery here is created by the spec.
 */

function paginated( settings: Settings = {} ): { id: number; url: string } {
	return galleryPage(
		{
			layout: 'grid',
			lightbox_show_dots: true,
			pagination_type: 'paginated',
			pagination_method: 'load_more',
			items_per_page: { desktop: 6, tablet: 6, mobile: 6 },
			...settings,
		},
		fixture< number[] >( 'F-large', 'items' ).slice( 0, 12 )
	);
}

/** Tab from `start` and report the trigger index each press lands on. */
async function tabStops( page: Page, gallery: GalleryRender, start: Locator, presses: number ): Promise< number[] > {
	await start.focus();
	const stops: number[] = [];
	for ( let i = 0; i < presses; i++ ) {
		await page.keyboard.press( 'Tab' );
		stops.push(
			await gallery.root.evaluate( ( root ) =>
				Array.from( root.querySelectorAll( '[data-fg-lightbox-trigger]' ) ).indexOf(
					document.activeElement as Element
				)
			)
		);
	}
	return stops;
}

test( 'items present at load are one Tab stop each, with a visible ring', { tag: '@lightbox' }, async ( {
	page,
} ) => {
	const { id, url } = paginated();
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	expect( await tabStops( page, gallery, gallery.triggers().first(), 5 ) ).toEqual( [ 1, 2, 3, 4, 5 ] );
	await expect( gallery.items().first() ).not.toHaveAttribute( 'tabindex' );
	await expect( gallery.triggers().nth( 5 ) ).toHaveCSS( 'outline-style', 'solid' );
} );

test( 'items added by Load More continue the Tab order', { tag: '@lightbox' }, async ( { page } ) => {
	const { id, url } = paginated();
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await page.locator( '[data-fg-pagination-trigger="load-more"]' ).click();
	await expect( gallery.items() ).toHaveCount( 12 );

	expect( await tabStops( page, gallery, gallery.triggers().nth( 4 ), 4 ) ).toEqual( [ 5, 6, 7, 8 ] );
	await expect( gallery.triggers().nth( 8 ) ).toHaveCSS( 'outline-style', 'solid' );
} );

test( 'items swapped in by a page button are reachable and open on Enter', { tag: '@lightbox' }, async ( {
	page,
} ) => {
	const { id, url } = paginated( { pagination_method: 'pages' } );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	const firstAlt = await gallery.items().first().locator( 'img' ).getAttribute( 'alt' );
	await page.locator( '[data-fg-pagination-trigger="next"]' ).click();
	await expect( gallery.items().first().locator( 'img' ) ).not.toHaveAttribute( 'alt', firstAlt ?? '' );

	expect( await tabStops( page, gallery, gallery.triggers().first(), 1 ) ).toEqual( [ 1 ] );
	await expect( gallery.triggers().nth( 1 ) ).toHaveCSS( 'outline-style', 'solid' );

	await page.keyboard.press( 'Enter' );
	await expect( lightbox.dialog() ).toBeVisible();
	expect( await lightbox.index() ).toBe( 7 );
} );

test( 'Space opens the lightbox, and Escape returns focus to the item', { tag: '@lightbox' }, async ( {
	page,
} ) => {
	const { id, url } = paginated();
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	expect( await tabStops( page, gallery, gallery.triggers().first(), 2 ) ).toEqual( [ 1, 2 ] );

	await page.keyboard.press( 'Space' );
	await expect( lightbox.dialog() ).toBeVisible();
	expect( await lightbox.index() ).toBe( 2 );
	expect( page.url() ).not.toContain( '.jpg' );

	await page.keyboard.press( 'Escape' );
	await expect( lightbox.dialog() ).toBeHidden();
	await expect( gallery.triggers().nth( 2 ) ).toBeFocused();
} );

for ( const layout of [ 'justified', 'masonry' ] ) {
	test( `the ring shows on a focused ${ layout } item`, { tag: '@lightbox' }, async ( { page } ) => {
		const { id, url } = paginated( { layout } );
		const gallery = new GalleryRender( page, id );

		await page.goto( url );
		expect( await tabStops( page, gallery, gallery.triggers().first(), 1 ) ).toEqual( [ 1 ] );
		await expect( gallery.triggers().nth( 1 ) ).toHaveCSS( 'outline-style', 'solid' );
		await expect( gallery.triggers().nth( 1 ) ).toHaveCSS( 'outline-width', '2px' );
	} );
}

test( 'a mouse click shows no ring', { tag: '@lightbox' }, async ( { page } ) => {
	const { id, url } = paginated();
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await lightbox.openFrom( gallery, 1 );
	await lightbox.close();
	await expect( gallery.triggers().nth( 1 ) ).toHaveCSS( 'outline-style', 'none' );
} );

const VARIANTS: Array< [ string, string ] > = [
	[ 'mini', '.fg-lb-mv' ],
	[ 'grid', '.fg-lb-grid' ],
];

for ( const [ variant, overlay ] of VARIANTS ) {
	test( `Enter on an item opens the ${ variant } lightbox`, { tag: '@lightbox' }, async ( { page } ) => {
		const { id, url } = paginated( { lightbox_variant: variant } );
		const gallery = new GalleryRender( page, id );

		await page.goto( url );
		expect( await tabStops( page, gallery, gallery.triggers().first(), 1 ) ).toEqual( [ 1 ] );
		await expect( gallery.triggers().nth( 1 ) ).toHaveCSS( 'outline-style', 'solid' );

		await page.keyboard.press( 'Enter' );
		await expect( page.locator( overlay ) ).toBeVisible();
	} );
}
