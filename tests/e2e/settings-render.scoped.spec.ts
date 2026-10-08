import { test, expect } from './support/test';
import { galleryPage, setSettings } from './support/collections';
import { GalleryRender } from './support/gallery-render';

/**
 * A setting written outside the UI reaches the rendered gallery.
 *
 * Scoped: every gallery and page here is created by the test that reads it.
 * Nothing touches a seeded fixture or a site-wide option, so these run at full
 * parallelism alongside the readonly specs.
 */

test( 'a gallery renders with the layout its settings ask for', { tag: [ '@critical', '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( { layout: 'masonry' } );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	expect( await gallery.layout() ).toBe( 'masonry' );
	await expect( gallery.items() ).toHaveCount( 5 );
} );

test( 'a column count reaches the wrapper as a CSS variable', { tag: [ '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( {
		layout: 'grid',
		columns: { desktop: 5, tablet: 3, mobile: 1 },
	} );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	expect( await gallery.cssVar( 'cols' ) ).toBe( '5' );
} );

test( 'changing a setting changes the next render', { tag: [ '@critical', '@settings', '@layout' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( { layout: 'grid' } );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();
	expect( await gallery.layout() ).toBe( 'grid' );

	setSettings( id, { layout: 'masonry' } );

	await page.goto( url );
	await gallery.waitFor();
	expect( await gallery.layout() ).toBe( 'masonry' );
} );

test( 'a mode setting reaches the wrapper as an attribute', { tag: [ '@settings', '@layout' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( { layout: 'grid', columns_mode: 'auto' } );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	expect( await gallery.attr( 'columns-mode' ) ).toBe( 'auto' );
} );
