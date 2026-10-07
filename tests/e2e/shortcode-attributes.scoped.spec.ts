import { test, expect } from './support/test';
import { album, galleryPage, shortcodePage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * What a `[fotogrids_gallery]` or `[fotogrids_album]` attribute can change.
 *
 * `template` and `cols` apply per embed. `lightbox`, `captions` and `lazy` are
 * not shortcode attributes, so a shortcode carrying them renders with the
 * collection's saved settings.
 *
 * Scoped: every gallery, album and page here is created by the test that reads it.
 */

test( 'a lightbox attribute does not turn the lightbox on', { tag: [ '@lightbox', '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { layout: 'grid', item_click_behavior: 'nothing' } );
	const gallery = new GalleryRender( page, id );

	await page.goto( shortcodePage( id, 'lightbox="true"' ).url );
	await gallery.waitFor();

	await expect( gallery.items() ).toHaveCount( 5 );
	await expect( gallery.triggers() ).toHaveCount( 0 );
} );

test( 'a lightbox attribute does not turn the lightbox off', { tag: [ '@lightbox', '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { layout: 'grid', item_click_behavior: 'lightbox' } );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( shortcodePage( id, 'lightbox="false"' ).url );
	await gallery.waitFor();

	await expect( gallery.triggers() ).toHaveCount( 5 );
	await lightbox.openFrom( gallery );
	await lightbox.close();
} );

test( 'a captions attribute does not hide saved captions', { tag: [ '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { layout: 'grid' } );
	const gallery = new GalleryRender( page, id );

	await page.goto( shortcodePage( id, 'captions="false"' ).url );
	await gallery.waitFor();

	await expect( gallery.root.locator( '.fg-caption-title' ) ).toHaveCount( 5 );
} );

test( 'a captions attribute does not show hidden captions', { tag: [ '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( {
		layout: 'grid',
		caption_hide_title: true,
		caption_hide_description: true,
	} );
	const gallery = new GalleryRender( page, id );

	await page.goto( shortcodePage( id, 'captions="true"' ).url );
	await gallery.waitFor();

	await expect( gallery.items() ).toHaveCount( 5 );
	await expect( gallery.root.locator( '.fg-caption' ) ).toHaveCount( 0 );
} );

test( 'a lazy attribute does not change lazy loading', { tag: [ '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const on = galleryPage( { layout: 'grid', lazy_load: true } );
	const off = galleryPage( { layout: 'grid', lazy_load: false } );

	await page.goto( shortcodePage( on.id, 'lazy="false"' ).url );
	const lazy = new GalleryRender( page, on.id );
	await lazy.waitFor();
	expect( await lazy.attr( 'lazy' ) ).toBe( '1' );

	await page.goto( shortcodePage( off.id, 'lazy="true"' ).url );
	const eager = new GalleryRender( page, off.id );
	await eager.waitFor();
	expect( await eager.attr( 'lazy' ) ).toBeNull();
} );

test( 'template and cols change the layout of one embed', { tag: [ '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( {
		layout: 'grid',
		columns: { desktop: 4, tablet: 3, mobile: 2 },
	} );
	const gallery = new GalleryRender( page, id );

	await page.goto( shortcodePage( id, 'template="masonry" cols="2"' ).url );
	await gallery.waitFor();
	expect( await gallery.layout() ).toBe( 'masonry' );
	expect( await gallery.cssVar( 'cols' ) ).toBe( '2' );

	await page.goto( url );
	await gallery.waitFor();
	expect( await gallery.layout() ).toBe( 'grid' );
	expect( await gallery.cssVar( 'cols' ) ).toBe( '4' );
} );

test( 'an album renders its saved settings and takes a template', { tag: [ '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const first = galleryPage( { layout: 'grid' } );
	const second = galleryPage( { layout: 'grid' } );
	const { id } = album( [ first.id, second.id ], { layout: 'grid' } );
	const wrapper = page.locator( `[data-fg-album-id="${ id }"]` );

	await page.goto( shortcodePage( id, 'lightbox="false" captions="false" lazy="false"', 'album' ).url );
	await expect( wrapper ).toBeVisible();
	await expect( wrapper ).toHaveAttribute( 'data-fg-layout', 'grid' );
	await expect( wrapper ).toHaveAttribute( 'data-fg-lazy', '1' );
	await expect( wrapper.locator( '.fg-item' ) ).toHaveCount( 2 );

	await page.goto( shortcodePage( id, 'template="masonry"', 'album' ).url );
	await expect( wrapper ).toHaveAttribute( 'data-fg-layout', 'masonry' );
} );
