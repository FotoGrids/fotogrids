import { execFileSync } from 'child_process';
import type { Page, PlaywrightWorkerArgs } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { getOption, setOption } from './support/site';
import { apiAs, storageStateFor, wpCli, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Caption colours stored with the white defaults of 1.2.0 are cleared on
 * upgrade and on import; any other colour is kept.
 *
 * Serial: the repair rewrites every collection and the defaults option.
 */

const DEFAULTS_OPTION = 'fotogrids_collection_defaults';
const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const EXPORT_ROUTE = '/wp-json/fotogrids/v1/admin/tools/import-export/export';
const IMPORT_ROUTE = '/fotogrids/v1/admin/tools/import-export/import';
const LOG_OPTION = 'fotogrids_import_export_log';

const OLD_TITLE = 'rgba(255, 255, 255, 1)';
const OLD_DESCRIPTION = 'rgba(255, 255, 255, 0.7)';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

function writeRawMeta( id: number, key: string, value: string ): void {
	wp( [ 'post', 'meta', 'update', String( id ), `fotogrids_${ key }`, value ] );
}

function storedMeta( id: number, key: string ): string {
	return wpEval( `echo get_post_meta( ${ id }, 'fotogrids_${ key }', true );` ).trim();
}

function snapshotOption( name: string ): string | null {
	return null === getOption( name ) ? null : wp( [ 'option', 'get', name, '--format=json' ] );
}

function restoreOption( name: string, snapshot: string | null ): void {
	if ( null === snapshot ) {
		setOption( name, null );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', name, '--format=json' ], { encoding: 'utf8', input: snapshot } );
}

async function runUpgrade( page: Page ): Promise< void > {
	setOption( 'fotogrids_db_version', '1.7' );
	await page.goto( '/' );
	expect( getOption( 'fotogrids_db_version' ) ).toBe( '1.8' );
}

test( 'CAP-59: the upgrade clears the 1.2.0 white caption colours and keeps chosen ones', { tag: [ '@critical', '@settings', '@lifecycle' ] }, async ( {
	page,
} ) => {
	const before = snapshotOption( DEFAULTS_OPTION );

	try {
		const old = galleryPage( { layout: 'grid', caption_placement: 'bottom' } );
		writeRawMeta( old.id, 'caption_title_color', OLD_TITLE );
		writeRawMeta( old.id, 'caption_description_color', OLD_DESCRIPTION );

		const spaced = galleryPage( { layout: 'grid' } );
		writeRawMeta( spaced.id, 'caption_title_color', 'RGBA(255,255,255,1)' );

		const chosen = galleryPage( { layout: 'grid' } );
		writeRawMeta( chosen.id, 'caption_title_color', 'rgba(200, 30, 30, 1)' );
		writeRawMeta( chosen.id, 'caption_description_color', 'rgba(255, 255, 255, 0.5)' );

		wpEval(
			`\\FotoGrids\\Settings\\Collection_Defaults_Store::replace( 'gallery', array( 'caption_title_color' => '${ OLD_TITLE }', 'layout' => 'masonry' ) );
			\\FotoGrids\\Settings\\Collection_Defaults_Store::replace( 'album', array( 'caption_description_color' => '${ OLD_DESCRIPTION }', 'caption_title_color' => 'rgba(1, 2, 3, 1)' ) );`
		);

		await runUpgrade( page );

		expect( storedMeta( old.id, 'caption_title_color' ) ).toBe( '' );
		expect( storedMeta( old.id, 'caption_description_color' ) ).toBe( '' );
		expect( storedMeta( spaced.id, 'caption_title_color' ) ).toBe( '' );
		expect( storedMeta( chosen.id, 'caption_title_color' ) ).toBe( 'rgba(200, 30, 30, 1)' );
		expect( storedMeta( chosen.id, 'caption_description_color' ) ).toBe( 'rgba(255, 255, 255, 0.5)' );
		expect( JSON.parse( snapshotOption( DEFAULTS_OPTION ) ?? '{}' ) ).toEqual( {
			gallery: { layout: 'masonry' },
			album: { caption_title_color: 'rgba(1, 2, 3, 1)' },
		} );

		const gallery = new GalleryRender( page, old.id );
		await page.goto( old.url );
		await gallery.waitFor();
		const title = gallery.root.locator( '.fg-caption-title' ).first();
		expect( await title.evaluate( ( element ) => getComputedStyle( element ).color ) ).toBe(
			await gallery.root.evaluate( ( element ) => getComputedStyle( element ).color )
		);
	} finally {
		restoreOption( DEFAULTS_OPTION, before );
	}
} );

async function exportGalleries( playwright: PlaywrightWorkerArgs[ 'playwright' ] ): Promise< Record< string, unknown > & { galleries: Array< { title: string } > } > {
	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const response = await context.get( `${ EXPORT_ROUTE }?include[]=galleries&format=json`, {
		headers: { 'X-WP-Nonce': nonce },
	} );
	expect( response.status() ).toBe( 200 );
	const body = await response.json();
	await context.dispose();

	return body;
}

async function importThroughUi( page: Page, body: string ): Promise< void > {
	await page.goto( SCREEN );
	await page.getByRole( 'tab', { name: 'Import' } ).click();

	const isPhase = ( phase: string ) => ( r: { url(): string; request(): { postDataJSON(): { phase?: string } | null } } ) =>
		decodeURIComponent( r.url() ).includes( IMPORT_ROUTE ) && phase === r.request().postDataJSON()?.phase;

	const analysed = page.waitForResponse( isPhase( 'analyse' ) );
	await page.locator( '#fg-ie-import-file' ).setInputFiles( {
		name: 'fotogrids-export.json',
		mimeType: 'application/json',
		buffer: Buffer.from( body ),
	} );
	await analysed;

	const executed = page.waitForResponse( isPhase( 'execute' ) );
	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	expect( ( await executed ).status() ).toBe( 200 );
}

test( 'CAP-59: an import carrying the 1.2.0 white caption colours clears them', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
	playwright,
} ) => {
	const log = snapshotOption( LOG_OPTION );
	const title = `Caption colours ${ Date.now() }`;

	try {
		const source = galleryPage( { layout: 'grid', caption_placement: 'bottom' }, undefined, title );
		writeRawMeta( source.id, 'caption_title_color', OLD_TITLE );
		writeRawMeta( source.id, 'caption_description_color', OLD_DESCRIPTION );

		const data = await exportGalleries( playwright );
		const file = { ...data, galleries: data.galleries.filter( ( g ) => g.title === title ) };
		expect( file.galleries ).toHaveLength( 1 );
		expect( JSON.stringify( file ) ).toContain( OLD_TITLE );

		wp( [ 'post', 'delete', String( source.id ), '--force' ] );
		await importThroughUi( page, JSON.stringify( file ) );

		const ids: number[] = JSON.parse(
			wpEval(
				`echo wp_json_encode( array_map( 'intval', get_posts( array( 'post_type' => 'fotogrids_gallery', 'title' => '${ title }', 'post_status' => 'any', 'fields' => 'ids', 'numberposts' => -1 ) ) ) );`
			)
		);
		expect( ids ).toHaveLength( 1 );
		adopt( ids[ 0 ] );

		expect( storedMeta( ids[ 0 ], 'caption_placement' ) ).toBe( 'bottom' );
		expect( storedMeta( ids[ 0 ], 'caption_title_color' ) ).toBe( '' );
		expect( storedMeta( ids[ 0 ], 'caption_description_color' ) ).toBe( '' );
	} finally {
		restoreOption( LOG_OPTION, log );
	}
} );
