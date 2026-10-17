import { execFileSync } from 'child_process';
import type { Page, PlaywrightWorkerArgs } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, galleryPage, pageFor, setSettings } from './support/collections';
import { firstItem } from './support/fixtures';
import { GalleryEditor } from './support/gallery-editor';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { apiAs, storageStateFor, wpCli, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Tools > Import / Export: an item's title, caption, description and alt text
 * through an export and an import, read back where the Item Edit modal and the
 * Lightbox read them.
 *
 * Serial: the tests share two attachments of their own and the export taken in
 * the first test, and an import writes the operation log, which is put back.
 */

test.describe.configure( { mode: 'serial' } );

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const EXPORT_ROUTE = '/wp-json/fotogrids/v1/admin/tools/import-export/export';
const IMPORT_ROUTE = '/fotogrids/v1/admin/tools/import-export/import';
const LOG_OPTION = 'fotogrids_import_export_log';

type Text = { title: string; caption: string; description: string; alt: string };
type Entry = Record< string, unknown > & { attachment_id: number | string };
type ExportFile = {
	meta: Record< string, unknown >;
	galleries: Array< { id: number; title: string } & Record< string, unknown > >;
	items: Entry[];
};

const TEXT: Record< 'edited' | 'unedited', Text > = {
	edited: {
		title: 'Harbour at dawn',
		caption: 'Boats leaving\nbefore sunrise',
		description: 'Shot from the north pier & the quay, C:\\Photos\\raw — «early» light',
		alt: 'Fishing boats in a harbour at dawn',
	},
	unedited: {
		title: 'Lighthouse in fog',
		caption: 'The lamp still turning',
		description: 'Long exposure, 30 seconds',
		alt: 'A lighthouse half hidden by fog',
	},
};

const CREDIT = 'Jane Doe';

function phpString( value: unknown ): string {
	return `json_decode( base64_decode( '${ Buffer.from( JSON.stringify( value ) ).toString( 'base64' ) }' ), true )`;
}

/** A new attachment, a copy of a seeded image, carrying the given text. */
function attachment( text: Text ): number {
	return Number(
		wpEval( `
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$t    = ${ phpString( text ) };
			$up   = wp_upload_dir();
			$name = wp_unique_filename( $up['path'], 'fg-item-text.jpg' );
			$path = $up['path'] . '/' . $name;
			copy( wp_get_original_image_path( ${ firstItem( 'F-small' ) } ), $path );
			$id = wp_insert_attachment( wp_slash( array(
				'post_mime_type' => 'image/jpeg',
				'post_title'     => $t['title'],
				'post_excerpt'   => $t['caption'],
				'post_content'   => $t['description'],
				'post_status'    => 'inherit',
			) ), $path );
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
			update_post_meta( $id, '_wp_attachment_image_alt', wp_slash( $t['alt'] ) );
			echo $id;
		` ).trim()
	);
}

function textOf( id: number ): Text {
	return JSON.parse(
		wpEval(
			`$p = get_post( ${ id } ); echo wp_json_encode( array( 'title' => $p->post_title, 'caption' => $p->post_excerpt, 'description' => $p->post_content, 'alt' => get_post_meta( ${ id }, '_wp_attachment_image_alt', true ) ) );`
		)
	);
}

function setText( id: number, text: Partial< Text > ): void {
	wpEval( `
		$t    = ${ phpString( text ) };
		$post = array( 'ID' => ${ id } );
		foreach ( array( 'title' => 'post_title', 'caption' => 'post_excerpt', 'description' => 'post_content' ) as $k => $f ) {
			if ( array_key_exists( $k, $t ) ) {
				$post[ $f ] = $t[ $k ];
			}
		}
		wp_update_post( wp_slash( $post ) );
		if ( array_key_exists( 'alt', $t ) ) {
			update_post_meta( ${ id }, '_wp_attachment_image_alt', wp_slash( $t['alt'] ) );
		}
	` );
}

/** The item row's columns, or null when the item has none. */
function rowOf( id: number ): Record< string, string | null > | null {
	return JSON.parse(
		wpEval( `echo wp_json_encode( \\FotoGrids\\Galleries\\Item_Meta::get( ${ id } ) );` )
	);
}

/** Leave the media in place, as on a site that has the files but not the FotoGrids data or the text. */
function forget( ids: number[] ): void {
	wpEval( `
		global $wpdb;
		foreach ( array( ${ ids.join( ',' ) } ) as $id ) {
			$wpdb->delete( \\FotoGrids\\Galleries\\Item_Meta::table(), array( 'attachment_id' => $id ) );
			wp_update_post( array( 'ID' => $id, 'post_title' => 'untitled', 'post_excerpt' => '', 'post_content' => '' ) );
			delete_post_meta( $id, '_wp_attachment_image_alt' );
		}
		foreach ( get_posts( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'any', 'numberposts' => -1 ) ) as $g ) {
			if ( array_intersect( array( ${ ids.join( ',' ) } ), \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( $g->ID ) ) ) {
				wp_delete_post( $g->ID, true );
			}
		}
	` );
}

/** Attachment ids that have an item row. */
function itemsWithRows(): number[] {
	return JSON.parse(
		wpEval(
			`global $wpdb; echo wp_json_encode( array_map( 'intval', $wpdb->get_col( $wpdb->prepare( 'SELECT DISTINCT attachment_id FROM %i', \\FotoGrids\\Galleries\\Item_Meta::table() ) ) ) );`
		)
	);
}

function galleryTitled( title: string ): number {
	const ids: number[] = JSON.parse(
		wpEval(
			`echo wp_json_encode( array_map( 'intval', get_posts( array( 'post_type' => 'fotogrids_gallery', 'title' => ${ phpString( title ) }, 'post_status' => 'publish', 'fields' => 'ids', 'numberposts' => -1 ) ) ) );`
		)
	);
	expect( ids ).toHaveLength( 1 );

	return ids[ 0 ];
}

function readLog(): string | null {
	try {
		return execFileSync( wpCli(), [ 'option', 'get', LOG_OPTION, '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}
}

function writeLog( value: string | null ): void {
	if ( null === value ) {
		execFileSync( wpCli(), [ 'option', 'delete', LOG_OPTION ], { encoding: 'utf8' } );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', LOG_OPTION, '--format=json', value ], {
		encoding: 'utf8',
	} );
}

async function exportFile(
	playwright: PlaywrightWorkerArgs[ 'playwright' ],
	query: string
): Promise< string > {
	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const response = await context.get( `${ EXPORT_ROUTE }?${ query }`, {
		headers: { 'X-WP-Nonce': nonce },
	} );
	expect( response.status() ).toBe( 200 );
	const body = await response.text();
	await context.dispose();

	return body;
}

/** Upload a file on the Import tab and import it with the default choices. */
async function importThroughUi(
	page: Page,
	name: string,
	body: string
): Promise< Record< string, Record< string, number > > > {
	await page.goto( SCREEN );
	await page.getByRole( 'tab', { name: 'Import' } ).click();

	const isPhase = ( phase: string ) => ( r: { url(): string; request(): { postDataJSON(): { phase?: string } | null } } ) =>
		decodeURIComponent( r.url() ).includes( IMPORT_ROUTE ) && phase === r.request().postDataJSON()?.phase;

	const analysed = page.waitForResponse( isPhase( 'analyse' ) );
	await page.locator( '#fg-ie-import-file' ).setInputFiles( {
		name,
		mimeType: name.endsWith( '.xml' ) ? 'application/xml' : 'application/json',
		buffer: Buffer.from( body ),
	} );
	await analysed;

	const executed = page.waitForResponse( isPhase( 'execute' ) );
	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	const response = await executed;
	expect( response.status() ).toBe( 200 );

	return response.json();
}

let edited: number;
let unedited: number;
let title: string;
let file: ExportFile;
let log: string | null;

test.beforeAll( () => {
	log = readLog();
	edited = attachment( TEXT.edited );
	unedited = attachment( TEXT.unedited );
	wpEval(
		`\\FotoGrids\\Galleries\\Item_Meta::save( ${ edited }, array( 'credit' => '${ CREDIT }', 'external_url' => 'https://example.com/harbour', 'link_target' => '_blank' ) );`
	);
	title = `Item text ${ Date.now() }`;
	galleryPage( {}, [ edited, unedited ], title );
} );

test.afterAll( () => {
	writeLog( log );
	for ( const id of [ edited, unedited ] ) {
		wpEval( `
			global $wpdb;
			$wpdb->delete( \\FotoGrids\\Galleries\\Item_Meta::table(), array( 'attachment_id' => ${ id } ) );
			wp_delete_attachment( ${ id }, true );
		` );
	}
} );

test( 'the export carries each item\'s title, caption, description and alt text, edited in FotoGrids or not', { tag: [ '@admin', '@api' ] }, async ( {
	playwright,
} ) => {
	expect( rowOf( unedited ) ).toBeNull();

	const data: ExportFile = JSON.parse(
		await exportFile( playwright, 'include[]=galleries&include[]=items&format=json' )
	);
	const byId = new Map( data.items.map( ( item ) => [ Number( item.attachment_id ), item ] ) );

	expect( byId.get( edited ) ).toMatchObject( { ...TEXT.edited, credit: CREDIT, link_target: '_blank' } );
	expect( byId.get( unedited ) ).toMatchObject( TEXT.unedited );

	file = {
		meta: data.meta,
		galleries: data.galleries.filter( ( g ) => g.title === title ),
		items: data.items.filter( ( item ) => [ edited, unedited ].includes( Number( item.attachment_id ) ) ),
	};
	expect( file.galleries ).toHaveLength( 1 );
	expect( file.items ).toHaveLength( 2 );
} );

test( 'importing on a site without the text puts it back where the Item Edit modal and the Lightbox read it', { tag: [ '@admin', '@api', '@lightbox' ] }, async ( {
	page,
} ) => {
	forget( [ edited, unedited ] );
	expect( textOf( edited ).caption ).toBe( '' );

	const result = await importThroughUi( page, 'fotogrids-export.json', JSON.stringify( file ) );
	expect( result.imported ).toMatchObject( { galleries: 1, items: 2 } );

	const gallery = galleryTitled( title );
	adopt( gallery );

	expect( textOf( edited ) ).toEqual( TEXT.edited );
	expect( textOf( unedited ) ).toEqual( TEXT.unedited );
	expect( rowOf( edited ) ).toMatchObject( { credit: CREDIT, link_target: '_blank' } );
	expect( rowOf( unedited ) ).toBeNull();

	const editor = new GalleryEditor( page );
	await editor.open( gallery );
	await editor.item( edited ).hover();
	await editor.editItem( edited ).click();
	await expect( page.locator( '#fotogrids-item-title' ) ).toHaveValue( TEXT.edited.title );
	await expect( page.locator( '#fotogrids-item-alt' ) ).toHaveValue( TEXT.edited.alt );
	await expect( page.locator( '#fotogrids-item-caption' ) ).toHaveValue( TEXT.edited.caption );
	await expect( page.locator( '#fotogrids-item-description' ) ).toHaveValue( TEXT.edited.description );
	await expect( page.locator( '#fotogrids-item-credit' ) ).toHaveValue( CREDIT );

	setSettings( gallery, { lightbox_info_blocks: JSON.stringify( [ 'caption', 'description', 'credit' ] ) } );
	const { url } = pageFor( gallery );
	const render = new GalleryRender( page, gallery );
	const lightbox = new Lightbox( page );
	await page.goto( url );
	await render.waitFor();
	await lightbox.openFrom( render );

	await expect( lightbox.image() ).toHaveAttribute( 'alt', TEXT.edited.alt );
	await expect( lightbox.info() ).toContainText( 'Boats leaving' );
	await expect( lightbox.info() ).toContainText( TEXT.edited.description );
	await expect( lightbox.info() ).toContainText( CREDIT );
} );

test( 'an XML export round-trips the text the same way', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const xml = await exportFile( playwright, 'include[]=items&format=xml' );
	forget( [ edited, unedited ] );
	const before = itemsWithRows();

	const result = await importThroughUi( page, 'fotogrids-export.xml', xml );
	expect( result.imported.items ).toBeGreaterThanOrEqual( 2 );
	expect( itemsWithRows().filter( ( id ) => ! before.includes( id ) ) ).toEqual( [ edited ] );

	expect( textOf( edited ) ).toEqual( TEXT.edited );
	expect( textOf( unedited ) ).toEqual( TEXT.unedited );
} );

test( 'importing again keeps the text edited since the export, for an item with a row and for one only in a gallery', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	galleryPage( {}, [ unedited ], `${ title } kept` );
	setText( edited, { caption: 'Edited after the export', alt: '' } );
	setText( unedited, { title: 'Renamed after the export' } );

	const result = await importThroughUi( page, 'fotogrids-export.json', JSON.stringify( { ...file, galleries: [] } ) );
	expect( result.skipped ).toMatchObject( { items: 2 } );
	expect( rowOf( unedited ) ).toBeNull();

	expect( textOf( edited ) ).toEqual( { ...TEXT.edited, caption: 'Edited after the export', alt: '' } );
	expect( textOf( unedited ) ).toEqual( { ...TEXT.unedited, title: 'Renamed after the export' } );
} );

test( 'a file from an earlier version, with empty captions and no title or alt, clears nothing', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	forget( [ edited ] );
	setText( edited, TEXT.edited );

	const older = {
		meta: { version: '1.1.4', site_url: wpEval( 'echo get_site_url();' ).trim() },
		items: [ { attachment_id: String( edited ), gallery_id: '0', item_type: 'image', caption: '', description: '', credit: CREDIT } ],
	};
	const result = await importThroughUi( page, 'fotogrids-export.json', JSON.stringify( older ) );
	expect( result.imported ).toMatchObject( { items: 1 } );

	expect( textOf( edited ) ).toEqual( TEXT.edited );
	expect( rowOf( edited ) ).toMatchObject( { credit: CREDIT } );
} );
