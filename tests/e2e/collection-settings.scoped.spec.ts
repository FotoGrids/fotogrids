import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The settings panel can be addressed by catalog key.
 *
 * Scoped: each test edits a gallery it created, and none of these saves.
 */

test( 'a field is found by its catalog key and shows the stored value', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { layout: 'masonry' } );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	await editor.open( id );
	await panel.switchTab( 'layout' );

	await expect( panel.field( 'layout' ) ).toBeVisible();
	await expect( panel.field( 'item_spacing' ) ).toBeVisible();
} );

test( 'switching tabs brings that tab’s fields into the panel', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage();
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	await editor.open( id );

	await panel.switchTab( 'layout' );
	await expect( panel.field( 'layout' ) ).toBeVisible();

	await panel.switchTab( 'lightbox' );
	await expect( panel.field( 'layout' ) ).toBeHidden();
} );

test( 'a gallery created with items shows them in the editor', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage();
	const editor = new GalleryEditor( page );

	await editor.open( id );

	await expect( editor.items() ).toHaveCount( 5 );
	expect( await editor.itemOrder() ).toHaveLength( 5 );
} );
