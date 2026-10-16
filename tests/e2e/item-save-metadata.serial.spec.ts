import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { firstItem } from './support/fixtures';
import { apiAs, storageStateFor, wpEval } from './support/roles';
import { galleryPage } from './support/collections';
import { GalleryEditor } from './support/gallery-editor';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The Item Edit modal's save route links tags by id, and people and locations
 * by id or by name. A request carrying a tag name is refused before anything
 * on the item changes.
 *
 * Serial: creates an attachment and library entries of its own and deletes
 * them afterwards.
 */

test.describe.configure( { mode: 'serial' } );

const PREFIX = 'e2e-item-meta-';

const SAVE_ROUTE = ( id: number ) => `/?rest_route=${ encodeURIComponent( `/fotogrids/v1/items/${ id }/save` ) }`;

type Linked = { tags: string[]; people: string[]; locations: string[] };

let itemId: number;
let tagA: number;
let tagB: number;
let personId: number;
let api: APIRequestContext;
let nonce: string;

test.beforeAll( async ( { playwright } ) => {
	( { item: itemId, tagA, tagB, person: personId } = JSON.parse(
		wpEval( `
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$up   = wp_upload_dir();
			$name = wp_unique_filename( $up['path'], 'fg-item-save-metadata.jpg' );
			$path = $up['path'] . '/' . $name;
			copy( wp_get_original_image_path( ${ firstItem( 'F-small' ) } ), $path );
			$id = wp_insert_attachment( array( 'post_mime_type' => 'image/jpeg', 'post_title' => 'fg-item-save-metadata', 'post_status' => 'inherit' ), $path );
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
			echo wp_json_encode( array(
				'item'   => $id,
				'tagA'   => (int) \\FotoGrids\\Metadata_Manager::add_or_get_tag( '${ PREFIX }tag-a' )->id,
				'tagB'   => (int) \\FotoGrids\\Metadata_Manager::add_or_get_tag( '${ PREFIX }tag-b' )->id,
				'person' => (int) \\FotoGrids\\Metadata_Manager::add_or_get_person( '${ PREFIX }person' )->id,
			) );
		` ).trim()
	) );
	( { context: api, nonce } = await apiAs( playwright, 'administrator' ) );
} );

test.afterAll( async () => {
	await api?.dispose();
	wpEval( `
		global $wpdb;
		$wpdb->delete( $wpdb->prefix . 'fotogrids_item_metadata', array( 'attachment_id' => ${ itemId ?? 0 } ) );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}fotogrids_tags WHERE name LIKE %s", '${ PREFIX }%' ) );
		${ itemId ? `wp_delete_attachment( ${ itemId }, true );` : '' }
	` );
} );

/** Names linked to the item, read from the database. */
function linked(): Linked {
	return JSON.parse(
		wpEval( `
			$m   = \\FotoGrids\\Metadata_Manager::get_item_metadata( ${ itemId } );
			$out = array();
			foreach ( array( 'tags', 'people', 'locations' ) as $k ) {
				$names = array_map( function ( $r ) { return $r->name; }, is_array( $m[ $k ] ) ? $m[ $k ] : array() );
				sort( $names );
				$out[ $k ] = $names;
			}
			echo wp_json_encode( $out );
		` )
	);
}

function libraryHas( name: string ): boolean {
	return '1' === wpEval( `
		global $wpdb;
		echo (int) (bool) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}fotogrids_tags WHERE name = %s", '${ name }' ) );
	` ).trim();
}

async function save( data: Record< string, unknown > ) {
	const response = await api.post( SAVE_ROUTE( itemId ), {
		headers: { 'X-WP-Nonce': nonce },
		data,
	} );
	return { status: response.status(), body: await response.json() };
}

test.describe( 'save route', () => {
	test( 'tags sent by id are linked, and each save replaces the last', { tag: [ '@api' ] }, async () => {
		const both = await save( { tags: [ tagA, tagB ] } );
		expect( both.status ).toBe( 200 );
		expect( both.body.metadata.tags ).toEqual( [ { id: tagA }, { id: tagB } ] );
		expect( both.body.metadata.errors ).toEqual( [] );
		expect( linked().tags ).toEqual( [ `${ PREFIX }tag-a`, `${ PREFIX }tag-b` ] );

		expect( ( await save( { tags: [ tagB ] } ) ).status ).toBe( 200 );
		expect( linked().tags ).toEqual( [ `${ PREFIX }tag-b` ] );

		expect( ( await save( { tags: [] } ) ).status ).toBe( 200 );
		expect( linked().tags ).toEqual( [] );
	} );

	test( 'a tag id sent as a numeric string is linked', { tag: [ '@api' ] }, async () => {
		const result = await save( { tags: [ String( tagA ) ] } );
		expect( result.status ).toBe( 200 );
		expect( result.body.metadata.tags ).toEqual( [ { id: tagA } ] );
		expect( linked().tags ).toEqual( [ `${ PREFIX }tag-a` ] );
	} );

	for ( const [ label, tag ] of [
		[ 'a name', `${ PREFIX }by-name` ],
		[ 'an object with a name', { name: `${ PREFIX }by-name` } ],
	] as const ) {
		test( `a tag sent as ${ label } is refused and the item is left as it was`, { tag: [ '@api' ] }, async () => {
			expect( ( await save( { tags: [ tagA ], people: [ { id: personId } ] } ) ).status ).toBe( 200 );
			const before = linked();
			const title = () => wpEval( `echo get_post( ${ itemId } )->post_title;` );
			const titleBefore = title();

			const result = await save( { title: 'not saved', tags: [ tagB, tag ] } );
			expect( result.status ).toBe( 400 );
			expect( result.body.code ).toBe( 'rest_invalid_param' );
			expect( Object.keys( result.body.data.params ) ).toEqual( [ 'tags' ] );

			expect( linked() ).toEqual( before );
			expect( libraryHas( `${ PREFIX }by-name` ) ).toBe( false );
			expect( title() ).toBe( titleBefore );
		} );
	}

	test( 'people and locations sent by name are created and linked beside tags sent by id', { tag: [ '@api' ] }, async () => {
		const result = await save( {
			tags: [ tagA ],
			people: [ { id: personId }, { name: `${ PREFIX }new-person`, details: 'Photographer' } ],
			locations: [ { name: `${ PREFIX }new-place`, latitude: 32.0853, longitude: 34.7818 } ],
		} );
		expect( result.status ).toBe( 200 );
		expect( result.body.metadata.errors ).toEqual( [] );
		expect( linked() ).toEqual( {
			tags: [ `${ PREFIX }tag-a` ],
			people: [ `${ PREFIX }new-person`, `${ PREFIX }person` ],
			locations: [ `${ PREFIX }new-place` ],
		} );
	} );
} );

test.describe( 'Item Edit modal', () => {
	async function openItem( page: Page, editor: GalleryEditor ): Promise< void > {
		await editor.item( itemId ).hover();
		await editor.editItem( itemId ).click();
		await expect( page.locator( '#fotogrids-item-title' ) ).toBeVisible();
	}

	async function openTab( page: Page, name: string ): Promise< void > {
		await page.locator( '.fg-modal' ).getByRole( 'tab', { name } ).click();
	}

	async function addTag( page: Page, name: string ): Promise< void > {
		const input = page.locator( '.fotogrids-item-edit-metadata-input input' );
		await input.fill( name );
		await input.press( 'Enter' );
		await expect( page.locator( '.fotogrids-tag', { hasText: name } ) ).toBeVisible();
	}

	async function saveModal( page: Page ): Promise< void > {
		const saved = page.waitForResponse( ( r ) =>
			decodeURIComponent( r.url() ).includes( `/items/${ itemId }/save` )
		);
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		expect( ( await saved ).status() ).toBe( 200 );
	}

	test( 'tags added by typing, new and existing, are saved and shown again on reopen', { tag: [ '@admin', '@critical' ] }, async ( {
		page,
	} ) => {
		await save( { tags: [], people: [], locations: [] } );
		const { id } = galleryPage( {}, [ itemId ] );
		const editor = new GalleryEditor( page );
		const fresh = `${ PREFIX }typed`;

		await editor.open( id );
		await openItem( page, editor );
		await openTab( page, 'Tags' );
		await addTag( page, `${ PREFIX }tag-a` );
		await addTag( page, fresh );
		await saveModal( page );

		expect( libraryHas( fresh ) ).toBe( true );
		expect( linked().tags ).toEqual( [ `${ PREFIX }tag-a`, fresh ] );

		await page.reload();
		await expect( editor.metabox() ).toBeVisible( { timeout: 15000 } );
		await openItem( page, editor );
		await openTab( page, 'Tags' );
		const chips = page.locator( '.fotogrids-item-edit-metadata-list .fotogrids-tag' );
		await expect( chips ).toHaveCount( 2 );

		await chips.filter( { hasText: fresh } ).locator( '.fotogrids-tag-remove-button' ).click();
		await saveModal( page );
		expect( linked().tags ).toEqual( [ `${ PREFIX }tag-a` ] );
	} );
} );
