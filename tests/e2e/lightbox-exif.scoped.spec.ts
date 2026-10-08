import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { firstItem } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * A visitor's lightbox reads EXIF and credit straight from the file when the
 * item has none stored. F-exif carries camera EXIF and an XMP credit but no
 * EXIF Artist or Copyright, so every read here goes on to WordPress's own
 * IPTC reader for the credit as well.
 *
 * Scoped: each test renders a gallery it created.
 */

const EXIF_PANEL: Settings = {
	layout: 'grid',
	lightbox_variant: 'full',
	lightbox_info_panel_enabled: true,
	lightbox_info_blocks: JSON.stringify( [ 'title', 'credit', 'exif', 'file_info' ] ),
	exif_fields: JSON.stringify( [ 'camera', 'aperture', 'iso' ] ),
};

function isItemRequest( url: string ): boolean {
	return decodeURIComponent( url ).includes( '/fotogrids/v1/lightbox/item/' );
}

test( 'the info panel shows a visitor EXIF read from the file', { tag: [ '@critical', '@lightbox' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage(
		{ ...EXIF_PANEL, display_exif: true, lightbox_credit_source: 'item_meta' },
		[ firstItem( 'F-exif' ) ]
	);
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();

	const details = page.waitForResponse( ( response ) => isItemRequest( response.url() ) );
	await lightbox.openFrom( gallery );
	expect( ( await details ).status() ).toBe( 200 );

	const exif = lightbox.dialog().locator( '[data-fg-lb-block="exif"]' );
	await expect( exif ).toContainText( 'Fixture One' );
	await expect( exif ).toContainText( 'f/2.8' );
} );

test( 'EXIF as the credit source answers a visitor with EXIF display off', { tag: '@lightbox' }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage(
		{ ...EXIF_PANEL, display_exif: false, lightbox_credit_source: 'exif' },
		[ firstItem( 'F-exif' ) ]
	);
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();

	const details = page.waitForResponse( ( response ) => isItemRequest( response.url() ) );
	await lightbox.openFrom( gallery );
	expect( ( await details ).status() ).toBe( 200 );
	await expect( lightbox.dialog().locator( '[data-fg-lb-block="file_info"]' ) ).toBeVisible();
} );

test( 'a paginated lightbox loads EXIF for an item beyond the first page', { tag: '@lightbox' }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage(
		{
			...EXIF_PANEL,
			display_exif: true,
			lightbox_show_dots: true,
			pagination_type: 'paginated',
			pagination_method: 'load_more',
			items_per_page: { desktop: 1, tablet: 1, mobile: 1 },
		},
		[ firstItem( 'F-small' ), firstItem( 'F-exif' ) ]
	);
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();

	const slides = page.waitForResponse( ( response ) =>
		decodeURIComponent( response.url() ).includes( '/fotogrids/v1/gallery/lightbox/slides' )
	);
	await lightbox.openFrom( gallery );
	await lightbox.goNext();
	expect( ( await slides ).status() ).toBe( 200 );
	await expect( lightbox.image() ).toHaveJSProperty( 'complete', true );
	await expect( lightbox.dialog().locator( '[data-fg-lb-block="exif"]' ) ).toContainText( 'Fixture One' );
} );
