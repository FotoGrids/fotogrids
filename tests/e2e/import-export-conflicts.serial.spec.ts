import { execFileSync } from 'child_process';
import type { Page, PlaywrightWorkerArgs, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, album, galleryPage } from './support/collections';
import { apiAs, storageStateFor, wpCli, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Tools > Import / Export: what each conflict choice on the Import tab does to a
 * gallery and an album that already exist.
 *
 * Serial: an import writes the operation log, which is put back, and Duplicate
 * creates collections, which are adopted for the purge.
 */

test.describe.configure( { mode: 'serial' } );

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const ROUTE = '/fotogrids/v1/admin/tools/import-export/import';
const LOG_OPTION = 'fotogrids_import_export_log';

const CHOICES = {
	skip: 'Skip existing',
	overwrite: 'Overwrite',
	duplicate: 'Duplicate',
} as const;

type Choice = keyof typeof CHOICES;

type ExportFile = {
	meta: Record< string, unknown >;
	galleries: Array< { id: number; slug: string; meta: Record< string, unknown > } >;
	albums: Array< { id: number; slug: string; meta: Record< string, unknown > } >;
	gallery_albums: Array< { gallery_id: string; album_id: string; position: string } >;
};

type Collections = { gallery: number; album: number; title: string };

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

/** A grid gallery inside a grid album, both titled after the test. */
function collections( name: string ): Collections {
	const title = `Import ${ name } ${ Date.now() }`;
	const gallery = galleryPage( { layout: 'grid' }, undefined, `${ title } gallery` ).id;
	const albumId = album( [ gallery ], { layout: 'grid' }, `${ title } album` ).id;

	return { gallery, album: albumId, title };
}

/** Published ids of one post type with this exact title, oldest first. */
function idsTitled( type: string, title: string ): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( array_map( 'intval', get_posts( array( 'post_type' => '${ type }', 'title' => '${ title }', 'post_status' => 'publish', 'fields' => 'ids', 'orderby' => 'ID', 'order' => 'ASC', 'posts_per_page' => -1 ) ) ) );`
		)
	);
}

function slugOf( id: number ): string {
	return wpEval( `echo get_post_field( 'post_name', ${ id } );` ).trim();
}

function layoutOf( id: number ): string {
	return wpEval( `echo get_post_meta( ${ id }, 'fotogrids_layout', true );` ).trim();
}

function galleriesIn( albumId: number ): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( array_map( 'intval', wp_list_pluck( \\FotoGrids\\Gallery_Album_Relations::get_galleries_for_album( ${ albumId }, array( 'include_meta' => false ) ), 'ID' ) ) );`
		)
	);
}

/** The export route's file, cut down to the test's own gallery and album. */
async function exportOf(
	playwright: PlaywrightWorkerArgs[ 'playwright' ],
	own: Collections
): Promise< ExportFile > {
	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const response = await context.get(
		'/wp-json/fotogrids/v1/admin/tools/import-export/export?include[]=galleries&include[]=albums',
		{ headers: { 'X-WP-Nonce': nonce } }
	);
	expect( response.status() ).toBe( 200 );
	const data: ExportFile = await response.json();
	await context.dispose();

	return {
		meta: data.meta,
		galleries: data.galleries.filter( ( g ) => g.id === own.gallery ),
		albums: data.albums.filter( ( a ) => a.id === own.album ),
		gallery_albums: data.gallery_albums.filter(
			( row ) => Number( row.album_id ) === own.album
		),
	};
}

/**
 * Upload a file on the Import tab, pick a conflict choice for each type and
 * import. Returns the execute request's body and the route's answer.
 */
async function importThroughUi(
	page: Page,
	file: ExportFile,
	choices: { galleries: Choice; albums: Choice }
): Promise< { sent: Record< string, unknown >; result: Record< string, Record< string, number > > } > {
	await page.goto( SCREEN );
	await page.getByRole( 'tab', { name: 'Import' } ).click();

	const isPhase = ( phase: string ) => ( r: Response ) =>
		decodeURIComponent( r.url() ).includes( ROUTE ) &&
		phase === r.request().postDataJSON()?.phase;

	const analysed = page.waitForResponse( isPhase( 'analyse' ) );
	await page.locator( '#fg-ie-import-file' ).setInputFiles( {
		name: 'fotogrids-export.json',
		mimeType: 'application/json',
		buffer: Buffer.from( JSON.stringify( file ) ),
	} );
	await analysed;

	for ( const [ type, label ] of [
		[ 'galleries', 'Galleries' ],
		[ 'albums', 'Albums' ],
	] as const ) {
		await page
			.getByRole( 'radiogroup', { name: `${ label } conflict handling` } )
			.getByRole( 'radio', { name: CHOICES[ choices[ type ] ] } )
			.click();
	}

	const executed = page.waitForResponse( isPhase( 'execute' ) );
	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	const response = await executed;

	expect( response.status() ).toBe( 200 );

	return { sent: response.request().postDataJSON(), result: await response.json() };
}

/** One row of the finished screen, each chip as "count label". */
async function resultRow( page: Page, title: string ): Promise< string[] > {
	const row = page
		.locator( '.fg-ie-done__result' )
		.filter( { has: page.locator( '.fg-ie-done__result-title', { hasText: title } ) } );

	if ( 0 === ( await row.count() ) ) {
		return [];
	}

	return row
		.locator( '.fg-ie-chip' )
		.evaluateAll( ( chips ) =>
			chips.map( ( chip ) =>
				Array.from( chip.children, ( part ) => part.textContent ).join( ' ' )
			)
		);
}

let log: string | null;

test.beforeAll( () => {
	log = readLog();
} );

test.afterAll( () => {
	writeLog( log );
} );

test( 'Skip existing leaves the gallery and album as they are', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const own = collections( 'skip' );
	const file = await exportOf( playwright, own );
	file.galleries[ 0 ].meta.fotogrids_layout = 'masonry';
	file.albums[ 0 ].meta.fotogrids_layout = 'masonry';

	const { sent, result } = await importThroughUi( page, file, {
		galleries: 'skip',
		albums: 'skip',
	} );

	expect( sent ).toMatchObject( { galleries: 'skip', albums: 'skip' } );
	expect( result.imported ).toMatchObject( { galleries: 0, albums: 0 } );
	expect( result.skipped ).toMatchObject( { galleries: 1, albums: 1 } );

	expect( idsTitled( 'fotogrids_gallery', `${ own.title } gallery` ) ).toEqual( [ own.gallery ] );
	expect( idsTitled( 'fotogrids_album', `${ own.title } album` ) ).toEqual( [ own.album ] );
	expect( layoutOf( own.gallery ) ).toBe( 'grid' );
	expect( layoutOf( own.album ) ).toBe( 'grid' );

	await expect( page.getByRole( 'heading', { name: 'Nothing was imported' } ) ).toBeVisible();
	await expect( page.getByText( 'Every record you selected was skipped.' ) ).toBeVisible();
	expect( await resultRow( page, 'Imported' ) ).toEqual( [] );
	expect( await resultRow( page, 'Skipped' ) ).toEqual( [ '1 Gallery', '1 Album' ] );
} );

test( 'Overwrite writes the file\'s settings onto the existing gallery and album', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const own = collections( 'overwrite' );
	const file = await exportOf( playwright, own );
	file.galleries[ 0 ].meta.fotogrids_layout = 'masonry';
	file.albums[ 0 ].meta.fotogrids_layout = 'masonry';

	const { sent, result } = await importThroughUi( page, file, {
		galleries: 'overwrite',
		albums: 'overwrite',
	} );

	expect( sent ).toMatchObject( { galleries: 'overwrite', albums: 'overwrite' } );
	expect( result.imported ).toMatchObject( { galleries: 1, albums: 1 } );
	expect( result.skipped ).toMatchObject( { galleries: 0, albums: 0 } );

	expect( idsTitled( 'fotogrids_gallery', `${ own.title } gallery` ) ).toEqual( [ own.gallery ] );
	expect( idsTitled( 'fotogrids_album', `${ own.title } album` ) ).toEqual( [ own.album ] );
	expect( layoutOf( own.gallery ) ).toBe( 'masonry' );
	expect( layoutOf( own.album ) ).toBe( 'masonry' );

	await expect( page.getByRole( 'heading', { name: 'Import complete' } ) ).toBeVisible();
	await expect( page.getByText( 'Your data has been imported successfully.' ) ).toBeVisible();
	expect( await resultRow( page, 'Imported' ) ).toEqual( [ '1 Gallery', '1 Album' ] );
	expect( await resultRow( page, 'Skipped' ) ).toEqual( [] );
} );

test( 'Duplicate adds a copy of each under a new slug, the copied album holding the copied gallery', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const own = collections( 'duplicate' );
	const file = await exportOf( playwright, own );

	const { sent, result } = await importThroughUi( page, file, {
		galleries: 'duplicate',
		albums: 'duplicate',
	} );

	const galleries = idsTitled( 'fotogrids_gallery', `${ own.title } gallery` );
	const albums = idsTitled( 'fotogrids_album', `${ own.title } album` );
	[ ...galleries, ...albums ].forEach( adopt );

	expect( sent ).toMatchObject( { galleries: 'duplicate', albums: 'duplicate' } );
	expect( result.imported ).toMatchObject( { galleries: 1, albums: 1 } );
	expect( result.skipped ).toMatchObject( { galleries: 0, albums: 0 } );

	expect( galleries ).toHaveLength( 2 );
	expect( albums ).toHaveLength( 2 );
	expect( galleries[ 0 ] ).toBe( own.gallery );
	expect( albums[ 0 ] ).toBe( own.album );

	const [ , galleryCopy ] = galleries;
	const [ , albumCopy ] = albums;
	expect( slugOf( galleryCopy ) ).not.toBe( slugOf( own.gallery ) );
	expect( slugOf( galleryCopy ) ).toContain( slugOf( own.gallery ) );
	expect( slugOf( albumCopy ) ).not.toBe( slugOf( own.album ) );
	expect( slugOf( albumCopy ) ).toContain( slugOf( own.album ) );
	expect( layoutOf( galleryCopy ) ).toBe( 'grid' );

	expect( galleriesIn( albumCopy ) ).toEqual( [ galleryCopy ] );
	expect( galleriesIn( own.album ) ).toEqual( [ own.gallery ] );

	await expect( page.getByRole( 'heading', { name: 'Import complete' } ) ).toBeVisible();
	expect( await resultRow( page, 'Imported' ) ).toEqual( [ '1 Gallery', '1 Album' ] );
} );

test( 'galleries and albums each follow their own choice', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const own = collections( 'mixed' );
	const file = await exportOf( playwright, own );

	const { sent, result } = await importThroughUi( page, file, {
		galleries: 'duplicate',
		albums: 'skip',
	} );

	const galleries = idsTitled( 'fotogrids_gallery', `${ own.title } gallery` );
	galleries.forEach( adopt );

	expect( sent ).toMatchObject( { galleries: 'duplicate', albums: 'skip' } );
	expect( result.imported ).toMatchObject( { galleries: 1, albums: 0 } );
	expect( result.skipped ).toMatchObject( { galleries: 0, albums: 1 } );

	expect( galleries ).toHaveLength( 2 );
	expect( idsTitled( 'fotogrids_album', `${ own.title } album` ) ).toEqual( [ own.album ] );

	await expect( page.getByRole( 'heading', { name: 'Import complete' } ) ).toBeVisible();
	await expect(
		page.getByText( 'Your data has been imported. Some records were skipped.' )
	).toBeVisible();
	expect( await resultRow( page, 'Imported' ) ).toEqual( [ '1 Gallery' ] );
	expect( await resultRow( page, 'Skipped' ) ).toEqual( [ '1 Album' ] );
} );
