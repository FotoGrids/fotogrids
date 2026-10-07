import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { firstItem, twelveItems } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * The lightbox opens from a gallery, moves between items and closes.
 *
 * Scoped: each test renders a gallery it created, so a view it records cannot
 * change what another spec reads.
 */

test( 'the lightbox opens from an item and closes again', { tag: [ '@critical', '@lightbox' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( { layout: 'grid' } );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();

	await lightbox.openFrom( gallery );
	await lightbox.close();
} );

test( 'the lightbox moves to the next item', { tag: [ '@critical', '@lightbox' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( {
		layout: 'grid',
		lightbox_show_dots: true,
	} );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();
	await lightbox.openFrom( gallery );

	expect( await lightbox.index() ).toBe( 0 );
	await lightbox.goNext();
	expect( await lightbox.index() ).toBe( 1 );
} );

test( 'a single-item gallery offers nothing to navigate to', { tag: '@lightbox' }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( { layout: 'grid' }, [
		firstItem( 'F-small' ),
	] );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();
	await expect( gallery.items() ).toHaveCount( 1 );

	await lightbox.openFrom( gallery );

	await expect( lightbox.next() ).toBeHidden();
	await expect( lightbox.prev() ).toBeHidden();
} );

test( 'an item added by Load More is one Tab stop, shows focus, and opens on Enter', { tag: '@lightbox' }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage(
		{
			layout: 'grid',
			lightbox_show_dots: true,
			pagination_type: 'paginated',
			pagination_method: 'load_more',
			items_per_page: { desktop: 6, tablet: 6, mobile: 6 },
		},
		twelveItems()
	);
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await page.locator( '[data-fg-pagination-trigger="load-more"]' ).click();
	await expect( gallery.items() ).toHaveCount( 12 );

	await gallery.triggers().nth( 5 ).focus();
	await page.keyboard.press( 'Tab' );

	const added = gallery.triggers().nth( 6 );
	await expect( added ).toBeFocused();
	await expect( added ).toHaveCSS( 'outline-style', 'solid' );

	await page.keyboard.press( 'Enter' );
	await expect( lightbox.dialog() ).toBeVisible();
	expect( await lightbox.index() ).toBe( 6 );
} );
