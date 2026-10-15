import { test, expect } from './support/test';
import { firstItem } from './support/fixtures';
import { apiAs, storageStateFor, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The Item Edit modal's save route stores an item's title, caption,
 * description and alt text exactly as sent.
 *
 * Serial: creates an attachment of its own and deletes it afterwards.
 */

test.describe.configure( { mode: 'serial' } );

const SAVE_ROUTE = ( id: number ) => `/?rest_route=${ encodeURIComponent( `/fotogrids/v1/items/${ id }/save` ) }`;

type Text = { title: string; caption: string; description: string; alt: string };

const TEXT: Text = {
	title: 'Raw files in C:\\Photos\\raw',
	caption: 'Shrug ¯\\_(ツ)_/¯\nsecond line',
	description: 'Pattern \\d+\\.jpg and a trailing \\\\',
	alt: 'Path D:\\Shoots\\2026',
};

let itemId: number;

test.beforeAll( () => {
	itemId = Number(
		wpEval( `
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$up   = wp_upload_dir();
			$name = wp_unique_filename( $up['path'], 'fg-item-save-text.jpg' );
			$path = $up['path'] . '/' . $name;
			copy( wp_get_original_image_path( ${ firstItem( 'F-small' ) } ), $path );
			$id = wp_insert_attachment( array( 'post_mime_type' => 'image/jpeg', 'post_title' => 'fg-item-save-text', 'post_status' => 'inherit' ), $path );
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
			echo $id;
		` ).trim()
	);
} );

test.afterAll( () => {
	if ( itemId ) {
		wpEval( `wp_delete_attachment( ${ itemId }, true );` );
	}
} );

function textOf( id: number ): Text {
	return JSON.parse(
		wpEval(
			`$p = get_post( ${ id } ); echo wp_json_encode( array( 'title' => $p->post_title, 'caption' => $p->post_excerpt, 'description' => $p->post_content, 'alt' => get_post_meta( ${ id }, '_wp_attachment_image_alt', true ) ) );`
		)
	);
}

test( 'backslashes in title, caption, description and alt text are kept', { tag: [ '@api' ] }, async ( {
	playwright,
} ) => {
	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const response = await context.post( SAVE_ROUTE( itemId ), {
		headers: { 'X-WP-Nonce': nonce },
		data: TEXT,
	} );
	expect( response.status() ).toBe( 200 );
	await context.dispose();

	expect( textOf( itemId ) ).toEqual( TEXT );
} );
