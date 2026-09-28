import { test, expect } from '@playwright/test';
import { galleryPage } from './support/collections';
import { firstItem } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * The lightbox opens from a gallery, moves between items and closes.
 *
 * Scoped: each test renders a gallery it created, so a view it records cannot
 * change what another spec reads.
 */

test( 'the lightbox opens from an item and closes again', async ( { page } ) => {
	const { id, url } = galleryPage( { layout: 'grid' } );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();

	await lightbox.openFrom( gallery );
	await lightbox.close();
} );

test( 'the lightbox moves to the next item', async ( { page } ) => {
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

test( 'a single-item gallery offers nothing to navigate to', async ( {
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
