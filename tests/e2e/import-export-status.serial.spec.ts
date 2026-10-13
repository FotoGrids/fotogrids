import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { adoptAll } from './support/collections';
import { fixture } from './support/fixtures';
import { storageStateFor, wpCli, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Tools > Import / Export: galleries and albums in every post status, and
 * collections without a slug, through the Export and Import tabs.
 *
 * Serial: an import writes the operation log, which is put back.
 */

test.describe.configure( { mode: 'serial' } );

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const ROUTE = '/fotogrids/v1/admin/tools/import-export/import';
const LOG_OPTION = 'fotogrids_import_export_log';
const STATUSES = [ 'publish', 'future', 'draft', 'pending', 'private' ] as const;
const CHOICES = { skip: 'Skip existing', overwrite: 'Overwrite', duplicate: 'Duplicate' } as const;

type Choice = keyof typeof CHOICES;

type Entry = { id: number; slug: string; meta: Record< string, unknown > };

type ExportFile = {
	meta: Record< string, unknown >;
	galleries: Entry[];
	albums: Entry[];
	gallery_albums: Array< { gallery_id: string; album_id: string; position: string } >;
};

type New = {
	type: 'fotogrids_gallery' | 'fotogrids_album';
	status: string;
	title: string;
	slug?: string;
	items?: number[];
	album?: string;
};

type Post = {
	id: number;
	type: string;
	title: string;
	status: string;
	slug: string;
	date: string;
	layout: string;
	items: number[];
	galleries: number[];
};

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

/**
 * Galleries and albums made the way WordPress makes them, so a draft or pending
 * one has no slug, each with a grid layout. Scheduled ones are dated ahead.
 * `album` names the album, made in the same call, that a gallery joins.
 *
 * @return Each title's post id.
 */
function make( rows: New[] ): Record< string, number > {
	const ids: Record< string, number > = JSON.parse(
		wpEval( `
			$rows = json_decode( base64_decode( '${ Buffer.from( JSON.stringify( rows ) ).toString( 'base64' ) }' ), true );
			$ids  = array();
			foreach ( $rows as $row ) {
				$ids[ $row['title'] ] = wp_insert_post( array(
					'post_type'   => $row['type'],
					'post_status' => $row['status'],
					'post_title'  => $row['title'],
					'post_name'   => $row['slug'] ?? '',
					'post_date'   => 'future' === $row['status'] ? '2031-05-06 07:08:09' : '2025-03-04 05:06:07',
				) );
				update_post_meta( $ids[ $row['title'] ], 'fotogrids_layout', 'grid' );
				if ( ! empty( $row['items'] ) ) {
					\\FotoGrids\\Galleries\\Gallery_Repository::set_item_ids( $ids[ $row['title'] ], $row['items'] );
				}
			}
			foreach ( $rows as $row ) {
				if ( ! empty( $row['album'] ) ) {
					\\FotoGrids\\Gallery_Album_Relations::add_gallery_to_album( $ids[ $row['title'] ], $ids[ $row['album'] ] );
				}
			}
			echo wp_json_encode( $ids );
		` )
	);
	adoptAll( Object.values( ids ) );

	return ids;
}

/** Every gallery and album whose title starts with `prefix`, in any status but trash, oldest first. */
function postsNamed( prefix: string ): Post[] {
	const posts: Post[] = JSON.parse(
		wpEval( `
			global $wpdb;
			$ids = $wpdb->get_col( $wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_type IN ( 'fotogrids_gallery', 'fotogrids_album' ) AND post_status IN ( 'publish', 'future', 'draft', 'pending', 'private' ) AND post_title LIKE %s ORDER BY ID",
				$wpdb->esc_like( base64_decode( '${ Buffer.from( prefix ).toString( 'base64' ) }' ) ) . '%'
			) );
			echo wp_json_encode( array_map( function ( $id ) {
				$p = get_post( $id );
				return array(
					'id'        => $p->ID,
					'type'      => $p->post_type,
					'title'     => $p->post_title,
					'status'    => $p->post_status,
					'slug'      => $p->post_name,
					'date'      => $p->post_date,
					'layout'    => get_post_meta( $p->ID, 'fotogrids_layout', true ),
					'items'     => array_map( 'intval', \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( $p->ID ) ),
					'galleries' => array_map( 'intval', \\FotoGrids\\Gallery_Album_Relations::get_gallery_ids_for_album( $p->ID ) ),
				);
			}, $ids ) );
		` )
	);
	adoptAll( posts.map( ( post ) => post.id ) );

	return posts;
}

function titled( posts: Post[], title: string ): Post[] {
	return posts.filter( ( post ) => post.title === title );
}

function remove( ...ids: number[] ): void {
	wpEval( ids.map( ( id ) => `wp_delete_post( ${ id }, true );` ).join( ' ' ) );
}

/** An auto-draft, as clicking Add New Gallery leaves behind: no title, no slug. */
function autoDraft(): number {
	return Number(
		wpEval(
			`$id = wp_insert_post( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'auto-draft' ) ); update_post_meta( $id, 'fotogrids_layout', 'grid' ); echo $id;`
		).trim()
	);
}

/** Export galleries and albums only, in the chosen format, through the Export tab. */
async function exportThroughUi( page: Page, format: 'JSON' | 'XML' ): Promise< string > {
	await page.goto( SCREEN );
	await page.getByRole( 'tab', { name: 'Export' } ).click();
	await page.locator( '#fg-ie-export-select-all' ).click();
	await page.locator( '#fg-ie-export-galleries' ).click();
	await page.locator( '#fg-ie-export-albums' ).click();
	await page
		.getByRole( 'radiogroup', { name: 'Export file format' } )
		.getByRole( 'radio', { name: format } )
		.click();

	const [ download ] = await Promise.all( [
		page.waitForEvent( 'download' ),
		page.getByRole( 'button', { name: 'Export', exact: true } ).click(),
	] );

	return readFileSync( ( await download.path() ) as string, 'utf8' );
}

/** The exported file cut down to these galleries and albums. */
function only( body: string, ids: number[] ): ExportFile {
	const file: ExportFile = JSON.parse( body );

	return {
		meta: file.meta,
		galleries: file.galleries.filter( ( g ) => ids.includes( g.id ) ),
		albums: file.albums.filter( ( a ) => ids.includes( a.id ) ),
		gallery_albums: file.gallery_albums.filter( ( row ) => ids.includes( Number( row.album_id ) ) ),
	};
}

/** Upload a file on the Import tab, pick one conflict choice for both types and import. */
async function importThroughUi(
	page: Page,
	body: string,
	format: 'json' | 'xml',
	choice: Choice
): Promise< Record< string, Record< string, number > > > {
	await page.goto( SCREEN );
	await page.getByRole( 'tab', { name: 'Import' } ).click();

	const isPhase = ( phase: string ) => ( r: Response ) =>
		decodeURIComponent( r.url() ).includes( ROUTE ) &&
		phase === r.request().postDataJSON()?.phase;

	const analysed = page.waitForResponse( isPhase( 'analyse' ) );
	await page.locator( '#fg-ie-import-file' ).setInputFiles( {
		name: `fotogrids-export.${ format }`,
		mimeType: 'xml' === format ? 'application/xml' : 'application/json',
		buffer: Buffer.from( body ),
	} );
	await analysed;

	for ( const label of [ 'Galleries', 'Albums' ] ) {
		const group = page.getByRole( 'radiogroup', { name: `${ label } conflict handling` } );
		if ( await group.count() ) {
			await group.getByRole( 'radio', { name: CHOICES[ choice ] } ).click();
		}
	}

	const executed = page.waitForResponse( isPhase( 'execute' ) );
	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	const response = await executed;
	expect( response.status() ).toBe( 200 );
	await expect( page.getByRole( 'heading', { name: 'Import result' } ) ).toBeVisible();

	return response.json();
}

let log: string | null;

test.beforeAll( () => {
	log = readLog();
} );

test.afterAll( () => {
	writeLog( log );
} );

for ( const format of [ 'JSON', 'XML' ] as const ) {
	test( `${ 'XML' === format ? 'an' : 'a' } ${ format } round trip brings each gallery and album back in its own status, with its date, items and album`, { tag: [ '@admin', '@api' ] }, async ( {
		page,
	} ) => {
		const name = `Status ${ format } ${ Date.now() }`;
		const items = fixture< number[] >( 'F-small', 'items' ).slice( 0, 2 );
		const ids = make(
			STATUSES.flatMap( ( status ): New[] => [
				{ type: 'fotogrids_album', status, title: `${ name } ${ status } album` },
				{ type: 'fotogrids_gallery', status, title: `${ name } ${ status } gallery`, items, album: `${ name } ${ status } album` },
			] )
		);
		const before = postsNamed( name );

		const body = await exportThroughUi( page, format );
		remove( ...Object.values( ids ) );

		const result = await importThroughUi( page, body, 'JSON' === format ? 'json' : 'xml', 'skip' );
		expect( result.imported.galleries ).toBeGreaterThanOrEqual( STATUSES.length );
		expect( result.imported.albums ).toBeGreaterThanOrEqual( STATUSES.length );

		const after = postsNamed( name );
		expect( after ).toHaveLength( before.length );

		for ( const status of STATUSES ) {
			const [ gallery ] = titled( after, `${ name } ${ status } gallery` );
			const [ albumPost ] = titled( after, `${ name } ${ status } album` );
			const [ galleryBefore ] = titled( before, `${ name } ${ status } gallery` );
			const [ albumBefore ] = titled( before, `${ name } ${ status } album` );

			expect( gallery, status ).toMatchObject( {
				status,
				slug: galleryBefore.slug,
				date: galleryBefore.date,
				items,
			} );
			expect( albumPost, status ).toMatchObject( {
				status,
				slug: albumBefore.slug,
				date: albumBefore.date,
				galleries: [ gallery.id ],
			} );
		}

		await page.goto( '/wp-admin/edit.php?post_type=fotogrids_gallery&post_status=draft' );
		await expect(
			page.getByRole( 'link', { name: `${ name } draft gallery`, exact: true } )
		).toBeVisible();
	} );
}

test( 'Skip on a restore leaves each draft as it is and matches none to another draft', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	const name = `Skip drafts ${ Date.now() }`;
	const ids = make( [
		{ type: 'fotogrids_gallery', status: 'draft', title: `${ name } draft` },
		{ type: 'fotogrids_album', status: 'pending', title: `${ name } pending` },
		{ type: 'fotogrids_gallery', status: 'draft', title: `${ name } other` },
	] );
	const auto = autoDraft();

	const file = only( await exportThroughUi( page, 'JSON' ), [
		ids[ `${ name } draft` ],
		ids[ `${ name } pending` ],
	] );
	expect( file.galleries.map( ( g ) => g.slug ) ).toEqual( [ '' ] );
	expect( file.albums.map( ( a ) => a.slug ) ).toEqual( [ '' ] );

	const result = await importThroughUi( page, JSON.stringify( file ), 'json', 'skip' );

	expect( result.imported ).toMatchObject( { galleries: 0, albums: 0 } );
	expect( result.skipped ).toMatchObject( { galleries: 1, albums: 1 } );
	expect( postsNamed( name ).map( ( post ) => post.id ) ).toEqual( Object.values( ids ) );
	expect( wpEval( `echo get_post_status( ${ auto } );` ).trim() ).toBe( 'auto-draft' );
	remove( auto );
} );

test( 'Overwrite writes a draft\'s settings onto that draft and not onto another draft or an auto-draft', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	const name = `Overwrite drafts ${ Date.now() }`;
	const auto = autoDraft();
	const ids = make( [
		{ type: 'fotogrids_gallery', status: 'draft', title: `${ name } other` },
		{ type: 'fotogrids_gallery', status: 'draft', title: `${ name } draft` },
	] );

	const file = only( await exportThroughUi( page, 'JSON' ), [ ids[ `${ name } draft` ] ] );
	file.galleries[ 0 ].meta.fotogrids_layout = 'masonry';

	const result = await importThroughUi( page, JSON.stringify( file ), 'json', 'overwrite' );

	expect( result.imported ).toMatchObject( { galleries: 1 } );
	const after = postsNamed( name );
	expect( titled( after, `${ name } draft` ) ).toEqual( [
		expect.objectContaining( { id: ids[ `${ name } draft` ], status: 'draft', layout: 'masonry' } ),
	] );
	expect( titled( after, `${ name } other` )[ 0 ].layout ).toBe( 'grid' );
	expect( wpEval( `echo get_post_meta( ${ auto }, 'fotogrids_layout', true );` ).trim() ).toBe( 'grid' );
	remove( auto );
} );

test( 'Duplicate copies a draft as a second draft and a private gallery under a new slug', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	const name = `Duplicate status ${ Date.now() }`;
	const slug = `duplicate-status-${ Date.now() }`;
	const ids = make( [
		{ type: 'fotogrids_gallery', status: 'draft', title: `${ name } draft` },
		{ type: 'fotogrids_gallery', status: 'private', title: `${ name } private`, slug },
	] );

	const file = only( await exportThroughUi( page, 'JSON' ), Object.values( ids ) );
	const result = await importThroughUi( page, JSON.stringify( file ), 'json', 'duplicate' );

	expect( result.imported ).toMatchObject( { galleries: 2 } );

	const after = postsNamed( name );
	const drafts = titled( after, `${ name } draft` );
	expect( drafts.map( ( p ) => [ p.status, p.slug ] ) ).toEqual( [ [ 'draft', '' ], [ 'draft', '' ] ] );
	const privates = titled( after, `${ name } private` );
	expect( privates.map( ( p ) => [ p.status, p.slug ] ) ).toEqual( [
		[ 'private', slug ],
		[ 'private', `${ slug }-1` ],
	] );
} );

test( 'a gallery whose slug an image also has is imported and kept apart from the image', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	const name = `Image slug ${ Date.now() }`;
	const slug = `image-slug-${ Date.now() }`;
	const image = fixture< number[] >( 'F-small', 'items' )[ 0 ];
	const imageSlug = wpEval( `echo get_post_field( 'post_name', ${ image } );` ).trim();
	wpEval( `wp_update_post( array( 'ID' => ${ image }, 'post_name' => '${ slug }' ) );` );

	try {
		const ids = make( [ { type: 'fotogrids_gallery', status: 'publish', title: name, slug } ] );
		const file = only( await exportThroughUi( page, 'JSON' ), [ ids[ name ] ] );
		remove( ids[ name ] );

		const result = await importThroughUi( page, JSON.stringify( file ), 'json', 'skip' );

		expect( result.imported ).toMatchObject( { galleries: 1 } );
		expect( postsNamed( name ) ).toEqual( [
			expect.objectContaining( { type: 'fotogrids_gallery', status: 'publish', slug } ),
		] );
		expect( wpEval( `echo get_post_type( ${ image } );` ).trim() ).toBe( 'attachment' );
	} finally {
		wpEval( `wp_update_post( array( 'ID' => ${ image }, 'post_name' => '${ imageSlug }' ) );` );
	}
} );

test( 'a file exported before statuses were carried imports its galleries and albums as published', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	const stamp = Date.now();
	const name = `Older file ${ stamp }`;
	const file = {
		meta: { version: '1.1.4' },
		galleries: [ { id: 990001, title: `${ name } gallery`, slug: `older-file-${ stamp }`, meta: {} } ],
		albums: [ { id: 990002, title: `${ name } album`, slug: `older-file-${ stamp }`, meta: {} } ],
		gallery_albums: [ { gallery_id: '990001', album_id: '990002', position: '0' } ],
	};

	const result = await importThroughUi( page, JSON.stringify( file ), 'json', 'skip' );

	expect( result.imported ).toMatchObject( { galleries: 1, albums: 1 } );
	const after = postsNamed( name );
	const [ gallery ] = titled( after, `${ name } gallery` );
	const [ albumPost ] = titled( after, `${ name } album` );
	expect( gallery.status ).toBe( 'publish' );
	expect( albumPost ).toMatchObject( { status: 'publish', galleries: [ gallery.id ] } );
} );
