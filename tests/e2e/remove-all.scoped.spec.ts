import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryEditor, PAST_DEBOUNCE } from './support/gallery-editor';
import { storageStateFor, wpEval } from './support/roles';
import { fixture } from './support/fixtures';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The gallery editor's Remove All dialog.
 *
 * Scoped: each test empties a gallery it created. Item data is only read.
 */

const CONFIRM = 'REMOVE ALL';

/** Stored item list of a gallery, as the save wrote it. */
function storedItems( galleryId: number ): string {
	return wpEval(
		`echo (string) get_post_meta( ${ galleryId }, 'fotogrids_gallery_items', true );`
	).trim();
}

/** Everything FotoGrids and WordPress hold for these attachments. */
function itemData( ids: number[] ): string {
	return wpEval( `
		global $wpdb;
		$out = array();
		foreach ( array( ${ ids.join( ',' ) } ) as $id ) {
			$out[ $id ] = array(
				'post'     => array_intersect_key( (array) get_post( $id ), array_flip( array( 'post_type', 'post_title', 'post_excerpt', 'post_content' ) ) ),
				'alt'      => get_post_meta( $id, '_wp_attachment_image_alt', true ),
				'meta'     => \\FotoGrids\\Galleries\\Item_Meta::get( $id ),
				'metadata' => $wpdb->get_results( $wpdb->prepare( "SELECT metadata_type, metadata_id FROM {$wpdb->prefix}fotogrids_item_metadata WHERE attachment_id = %d ORDER BY id", $id ), ARRAY_A ),
			);
		}
		echo wp_json_encode( $out );
	` ).trim();
}

async function removeAll( editor: GalleryEditor ): Promise< void > {
	await editor.removeAllButton().click();
	const dialog = editor.removeAllDialog();
	await dialog.getByRole( 'textbox' ).fill( CONFIRM );
	await dialog.getByRole( 'button', { name: 'Remove all items' } ).click();
	await expect( dialog ).toBeHidden();
}

test( 'the dialog asks only for the typed confirmation', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage();
	const editor = new GalleryEditor( page );

	await editor.open( id );
	await editor.removeAllButton().click();

	const dialog = editor.removeAllDialog();
	const confirm = dialog.getByRole( 'button', { name: 'Remove all items' } );
	const typed = dialog.getByRole( 'textbox' );

	await expect( dialog ).toBeVisible();
	await expect( dialog.getByRole( 'checkbox' ) ).toHaveCount( 0 );
	await expect( dialog ).not.toContainText( 'custom data' );

	await expect( confirm ).toBeDisabled();
	await typed.fill( CONFIRM.toLowerCase() );
	await expect( confirm ).toBeDisabled();
	await typed.fill( CONFIRM.slice( 0, -1 ) );
	await expect( confirm ).toBeDisabled();
	await typed.fill( CONFIRM );
	await expect( confirm ).toBeEnabled();
} );

test( 'cancelling or pressing Escape keeps every item', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage();
	const editor = new GalleryEditor( page );

	await editor.open( id );
	await expect( editor.items() ).toHaveCount( 5 );

	await editor.removeAllButton().click();
	await editor.removeAllDialog().getByRole( 'textbox' ).fill( CONFIRM );
	await editor.removeAllDialog().getByRole( 'button', { name: 'Cancel' } ).click();
	await expect( editor.removeAllDialog() ).toBeHidden();
	await expect( editor.items() ).toHaveCount( 5 );

	await editor.removeAllButton().click();
	await expect( editor.removeAllDialog().getByRole( 'textbox' ) ).toHaveValue( '' );
	await page.keyboard.press( 'Escape' );
	await expect( editor.removeAllDialog() ).toBeHidden();
	await expect( editor.items() ).toHaveCount( 5 );
} );

test( 'Remove All empties only this gallery and keeps item data', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	const ids = fixture< number[] >( 'F-tagged', 'items' ).slice( 0, 4 );
	const target = galleryPage( {}, ids );
	const other = galleryPage( {}, ids.slice( 0, 3 ) );
	const otherItems = storedItems( other.id );
	const dataBefore = itemData( ids );
	const editor = new GalleryEditor( page );

	await editor.open( target.id );

	// Autosave is on by default, so the emptied list is stored without Update.
	const autosaved = page.waitForResponse(
		( response ) =>
			response.url().includes( 'admin-ajax.php' ) &&
			( response.request().postData() ?? '' ).includes( 'fotogrids_save_collection' ),
		{ timeout: PAST_DEBOUNCE * 2 }
	);
	await removeAll( editor );
	await expect( editor.items() ).toHaveCount( 0 );
	expect( ( await autosaved ).ok() ).toBe( true );
	expect( storedItems( target.id ) ).toBe( '' );

	await editor.open( target.id );
	await expect( editor.items() ).toHaveCount( 0 );
	expect( storedItems( other.id ) ).toBe( otherItems );
	expect( itemData( ids ) ).toBe( dataBefore );
} );
