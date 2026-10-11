import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';
import { NAVIGATION, cached, servedAndUncached, wp } from './support/album-header';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Site-wide screens that change a gallery's album header reach its cached
 * render: the View Pages settings, Maintenance > Reset settings and the
 * Import screen.
 *
 * Serial: each of these changes every collection on the site. The plugin's
 * options are put back after every test.
 */

let options = '';

test.beforeEach( () => {
	options = wpEval(
		`global $wpdb; echo base64_encode( wp_json_encode( $wpdb->get_results( "SELECT option_name, option_value, autoload FROM {$wpdb->options} WHERE option_name LIKE 'fotogrids\\\\_%'", ARRAY_A ) ) );`
	).trim();
} );

test.afterEach( () => {
	wpEval(
		`global $wpdb; foreach ( json_decode( base64_decode( '${ options }' ), true ) as $row ) { $wpdb->replace( $wpdb->options, $row ); } wp_cache_flush(); flush_rewrite_rules();`
	);
} );

async function openSettings( page: Page, tab: string ): Promise< void > {
	await page.goto( `/wp-admin/admin.php?page=fotogrids-settings&tab=${ tab }` );
	await page.waitForLoadState( 'networkidle' );
}

test( 'a new album segment on the View Pages screen reaches the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	album( [ gallery.id ], NAVIGATION );
	const segment = `shelf-${ Date.now() }`;

	await cached( browser, gallery.url, gallery.id );

	await openSettings( page, 'view_pages' );
	const saved = page.waitForResponse( ( r ) => r.url().includes( 'view-settings' ) && 'POST' === r.request().method() );
	await page.locator( '#fg-view-base-album' ).fill( segment );
	const save = page.getByRole( 'button', { name: /^Save/ } );
	if ( await save.count() ) {
		await save.first().click();
	}
	expect( ( await saved ).status() ).toBe( 200 );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( uncached );
	expect( seen.href ).toContain( `/${ segment }/` );
} );

test( 'Maintenance > Reset settings reaches the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	album( [ gallery.id ], NAVIGATION );
	const segment = `before-reset-${ Date.now() }`;
	wpEval(
		`$v = FotoGrids\\Settings\\View_Settings_Store::get(); $v['base_album_segment'] = '${ segment }'; FotoGrids\\Settings\\View_Settings_Store::save( $v ); flush_rewrite_rules();`
	);

	expect( ( await cached( browser, gallery.url, gallery.id ) ).href ).toContain( `/${ segment }/` );

	await openSettings( page, 'maintenance' );
	const reset = page.waitForResponse( ( r ) => r.url().includes( 'reset-options' ) );
	await page.getByRole( 'button', { name: /Reset (all )?settings/i } ).first().click();
	const dialog = page.locator( '.fg-modal' );
	const typed = dialog.locator( 'input[type=text]' );
	if ( await typed.count() ) {
		const word = ( await dialog.textContent() )?.match( /type\s+["“]?([A-Z]+)["”]?/i );
		await typed.fill( word ? word[ 1 ] : 'RESET' );
	}
	await dialog.getByRole( 'button', { name: /Reset/i } ).last().click();
	expect( ( await reset ).status() ).toBe( 200 );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( uncached );
	expect( seen.href ).not.toContain( `/${ segment }/` );
} );

test( 'an import through the Import screen that adds a gallery to an album reaches the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	album( [ gallery.id ], NAVIGATION );
	const second = album( [], NAVIGATION );
	const field = ( id: number ) => wp( [ 'post', 'get', String( id ), '--field=post_name' ] );
	const file = path.join( os.tmpdir(), `fg-album-import-${ gallery.id }.json` );
	fs.writeFileSync(
		file,
		JSON.stringify( {
			meta: { version: wpEval( 'echo FOTOGRIDS_VERSION;' ).trim() },
			galleries: [ { id: 880001, title: 'Imported', slug: field( gallery.id ), meta: {} } ],
			albums: [ { id: 990001, title: 'Imported', slug: field( second.id ), meta: {} } ],
			gallery_albums: [ { gallery_id: 880001, album_id: 990001, position: 0 } ],
		} )
	);

	expect( ( await cached( browser, gallery.url, gallery.id ) ).album ).not.toBeNull();

	await page.goto( '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export' );
	await page.waitForLoadState( 'networkidle' );
	await page.getByRole( 'tab', { name: 'Import' } ).or( page.locator( 'button:has-text("Import")' ).first() ).first().click();
	const analysed = page.waitForResponse( ( r ) => r.url().includes( 'import-export' ) && ( r.request().postData() ?? '' ).includes( 'analyse' ) );
	await page.setInputFiles( '#fg-ie-import-file', file );
	await analysed;
	const executed = page.waitForResponse( ( r ) => r.url().includes( 'import-export' ) && ( r.request().postData() ?? '' ).includes( 'execute' ) );
	await page.getByRole( 'button', { name: /^Import$/ } ).last().click();
	expect( ( await executed ).status() ).toBe( 200 );
	fs.unlinkSync( file );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( uncached );
	expect( seen.album, 'a gallery in two albums has no single parent' ).toBeNull();
} );
