import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor, wpCli } from './support/roles';
import { ADMIN, ScratchSite, scratchSitesAvailable } from './support/scratch-site';

/**
 * Tools > Import / Export with Settings: an import never changes the Share
 * usage data choice, and every other setting is stored the way its settings
 * screen stores it.
 *
 * The consent tests run on a WordPress of their own, where the Freemius API is
 * answered by tests/harness/freemius-api.php and every request is recorded.
 */

test.describe.configure( { mode: 'serial' } );

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const ROUTE = '/fotogrids/v1/admin/tools/import-export/import';

const OPTIONS = [
	'fotogrids_share_statistics',
	'fotogrids_autosave',
	'fotogrids_preserve_data_on_uninstall',
	'fotogrids_media_settings',
	'fotogrids_gallery_defaults',
	'fotogrids_import_export_log',
];

const MEDIA = {
	thumbnail_width: 400,
	thumbnail_height: 300,
	thumbnail_crop: true,
	thumbnail_alignment: 'center',
	full_width: 1920,
	full_height: 0,
	full_crop: false,
	masonry_width: 600,
	justified_height: 400,
};

type Wp = ( ...args: string[] ) => string;

const sharedWp: Wp = ( ...args ) =>
	execFileSync( wpCli(), args, { encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'pipe' ] } ).trim();

function readOption( wp: Wp, name: string ): unknown {
	try {
		return JSON.parse( wp( 'option', 'get', name, '--format=json' ) );
	} catch {
		return undefined;
	}
}

function writeOption( wp: Wp, name: string, value: unknown ): void {
	if ( undefined === value ) {
		try {
			wp( 'option', 'delete', name );
		} catch {}
		return;
	}
	wp( 'option', 'update', name, JSON.stringify( value ), '--format=json' );
}

function exportFile( settings: Record< string, unknown > ): string {
	return JSON.stringify( { meta: { version: '1.2.0' }, settings } );
}

/** Choose a file on the Import tab, import it, and return the execute response body. */
async function importThroughUi( page: Page, base: string, name: string, body: string ): Promise< Record< string, unknown > > {
	await page.goto( `${ base }${ SCREEN }` );
	await page.getByRole( 'tab', { name: 'Import' } ).click();

	const analysed = page.waitForResponse(
		( r ) => decodeURIComponent( r.url() ).includes( ROUTE ) && 'analyse' === r.request().postDataJSON()?.phase
	);
	await page.locator( '#fg-ie-import-file' ).setInputFiles( {
		name,
		mimeType: name.endsWith( '.xml' ) ? 'application/xml' : 'application/json',
		buffer: Buffer.from( body ),
	} );
	expect( ( await analysed ).status() ).toBe( 200 );
	await expect( page.locator( '#fg-ie-import-settings' ) ).toBeVisible();

	const executed = page.waitForResponse(
		( r ) => decodeURIComponent( r.url() ).includes( ROUTE ) && 'execute' === r.request().postDataJSON()?.phase
	);
	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	const response = await executed;
	expect( response.status() ).toBe( 200 );
	await expect( page.getByRole( 'heading', { name: 'Import complete' } ) ).toBeVisible();

	return response.json();
}

async function openAdvanced( page: Page, base: string ): Promise< void > {
	await page.goto( `${ base }/wp-admin/admin.php?page=fotogrids-settings&tab=advanced` );
	await expect( page.locator( '#fotogrids_share_statistics' ) ).toBeVisible( { timeout: 20_000 } );
	await page.waitForLoadState( 'networkidle' );
}

test.describe( 'Share usage data', () => {
	test.skip( ! scratchSitesAvailable(), 'needs the ci-mode harness, which can build a scratch WordPress' );

	let site: ScratchSite;

	test.beforeEach( async ( {}, testInfo ) => {
		testInfo.setTimeout( 300_000 );
		site = await new ScratchSite( `import_consent_${ testInfo.testId }` ).create();
		site.wp( 'transient', 'delete', 'fotogrids_activation_redirect' );

		const muPlugins = path.join( site.dir, 'wp-content', 'mu-plugins' );
		mkdirSync( muPlugins, { recursive: true } );
		copyFileSync( path.resolve( 'tests/harness/freemius-api.php' ), path.join( muPlugins, 'freemius-api.php' ) );
	} );

	test.afterEach( () => {
		site?.destroy();
	} );

	const wp: Wp = ( ...args ) => site.wp( ...args );

	function freemius(): string {
		return site.wp(
			'eval',
			'$fs = freemius( "fotogrids" ); echo wp_json_encode( array( "registered" => $fs->is_registered(), "tracking" => $fs->is_tracking_allowed() ) );'
		);
	}

	function requests(): unknown[] {
		return readOption( wp, 'fs_test_log' ) as unknown[];
	}

	async function logIn( page: Page ): Promise< void > {
		await page.goto( `${ site.url }/wp-login.php` );
		await page.waitForLoadState( 'networkidle' );
		await page.fill( '#user_login', ADMIN.user );
		await page.fill( '#user_pass', ADMIN.pass );
		await page.click( '#wp-submit' );
		await page.waitForURL( /wp-admin/ );
	}

	test( 'a file with sharing on leaves a site that has not opted in as it is', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
		await logIn( page );
		const before = freemius();
		site.wp( 'option', 'update', 'fs_test_log', '[]', '--format=json' );

		const result = await importThroughUi( page, site.url, 'from-another-site.json', exportFile( { share_statistics: '1', autosave: '0' } ) );

		expect( result.imported ).toEqual( { settings: true } );
		expect( readOption( wp, 'fotogrids_share_statistics' ), 'the import switched usage-data sharing on' ).toBeUndefined();
		expect( readOption( wp, 'fotogrids_autosave' ), 'the rest of the settings block was not imported' ).toBe( '0' );
		expect( freemius() ).toBe( before );
		expect( requests(), 'the import talked to Freemius' ).toEqual( [] );

		await openAdvanced( page, site.url );
		await expect( page.locator( '#fotogrids_share_statistics' ) ).toHaveAttribute( 'aria-checked', 'false' );

		expect( site.phpErrors() ).toEqual( [] );
	} );

	test( 'a file with sharing off leaves a site that has opted in sharing', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
		await logIn( page );
		await openAdvanced( page, site.url );
		const write = page.waitForResponse(
			( r ) => decodeURIComponent( r.url() ).includes( '/admin/advanced-settings' ) && 'POST' === r.request().method(),
			{ timeout: 30_000 }
		);
		await page.locator( '#fotogrids_share_statistics' ).click();
		expect( ( await write ).status() ).toBe( 200 );
		await expect.poll( () => JSON.parse( freemius() ).registered, { message: 'opting in did not register the site' } ).toBe( true );

		const before = freemius();
		site.wp( 'option', 'update', 'fs_test_log', '[]', '--format=json' );

		await importThroughUi( page, site.url, 'from-another-site.json', exportFile( { share_statistics: '0' } ) );

		expect( readOption( wp, 'fotogrids_share_statistics' ), 'the import switched usage-data sharing off' ).toBe( '1' );
		expect( freemius() ).toBe( before );
		expect( requests(), 'the import talked to Freemius' ).toEqual( [] );

		await openAdvanced( page, site.url );
		await expect( page.locator( '#fotogrids_share_statistics' ) ).toHaveAttribute( 'aria-checked', 'true' );

		expect( site.phpErrors() ).toEqual( [] );
	} );
} );

test.describe( 'stored values', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	const saved: Record< string, unknown > = {};

	test.beforeAll( () => {
		for ( const name of OPTIONS ) {
			saved[ name ] = readOption( sharedWp, name );
		}
	} );

	test.afterAll( () => {
		for ( const name of OPTIONS ) {
			writeOption( sharedWp, name, saved[ name ] );
		}
	} );

	test.beforeEach( () => {
		writeOption( sharedWp, 'fotogrids_share_statistics', '0' );
		writeOption( sharedWp, 'fotogrids_autosave', '1' );
		writeOption( sharedWp, 'fotogrids_preserve_data_on_uninstall', '1' );
		writeOption( sharedWp, 'fotogrids_media_settings', MEDIA );
		writeOption( sharedWp, 'fotogrids_gallery_defaults', { layout: 'justified' } );
	} );

	test( 'odd values are stored the way the settings screens store them', { tag: [ '@admin', '@settings' ] }, async ( { page, baseURL } ) => {
		await importThroughUi(
			page,
			baseURL as string,
			'odd-values.json',
			exportFile( {
				autosave: 'yes',
				preserve_data_on_uninstall: 'false',
				media: {
					thumbnail_width: '-50',
					thumbnail_crop: 'false',
					thumbnail_alignment: '<script>alert(1)</script>',
					full_crop: true,
					unknown_key: 'x',
				},
				gallery_defaults: {
					layout: '<b>masonry</b>',
					columns: { desktop: 5, tablet: 2, mobile: 1 },
					fotogrids_not_a_setting: 'x',
				},
			} )
		);

		expect( readOption( sharedWp, 'fotogrids_autosave' ) ).toBe( '0' );
		expect( readOption( sharedWp, 'fotogrids_preserve_data_on_uninstall' ) ).toBe( '0' );
		expect( readOption( sharedWp, 'fotogrids_media_settings' ) ).toEqual( {
			...MEDIA,
			thumbnail_width: 1,
			thumbnail_crop: false,
		} );
		expect( readOption( sharedWp, 'fotogrids_gallery_defaults' ) ).toEqual( {
			layout: 'masonry',
			columns: { desktop: 5, tablet: 2, mobile: 1 },
		} );

		await openAdvanced( page, baseURL as string );
		await expect( page.locator( '#fotogrids_autosave' ) ).toHaveAttribute( 'aria-checked', 'false' );
		await expect( page.locator( '#fotogrids_delete_on_uninstall' ) ).toHaveAttribute( 'aria-checked', 'true' );
	} );

	test( 'a media or defaults block that is not a map leaves the site’s own in place', { tag: [ '@admin', '@settings' ] }, async ( { page, baseURL } ) => {
		await importThroughUi( page, baseURL as string, 'not-a-map.json', exportFile( { media: 'not a map', gallery_defaults: 42 } ) );

		expect( readOption( sharedWp, 'fotogrids_media_settings' ) ).toEqual( MEDIA );
		expect( readOption( sharedWp, 'fotogrids_gallery_defaults' ) ).toEqual( { layout: 'justified' } );
	} );

	test( 'an XML round trip keeps Soft crop', { tag: [ '@admin', '@settings' ] }, async ( { page, baseURL } ) => {
		writeOption( sharedWp, 'fotogrids_media_settings', { ...MEDIA, thumbnail_crop: false, thumbnail_width: 512 } );

		await page.goto( `${ baseURL }${ SCREEN }` );
		await page.getByRole( 'tab', { name: 'Export' } ).click();
		await page.locator( '#fg-ie-export-select-all' ).click();
		await page.locator( '#fg-ie-export-settings' ).click();
		await page.getByRole( 'radiogroup', { name: 'Export file format' } ).getByRole( 'radio', { name: 'XML' } ).click();
		const [ download ] = await Promise.all( [
			page.waitForEvent( 'download' ),
			page.getByRole( 'button', { name: 'Export', exact: true } ).click(),
		] );
		const xml = readFileSync( ( await download.path() ) as string, 'utf8' );
		expect( xml ).toContain( '<thumbnail_crop>false</thumbnail_crop>' );

		writeOption( sharedWp, 'fotogrids_media_settings', MEDIA );
		await importThroughUi( page, baseURL as string, 'fotogrids-export.xml', xml );

		expect( readOption( sharedWp, 'fotogrids_media_settings' ) ).toEqual( { ...MEDIA, thumbnail_crop: false, thumbnail_width: 512 } );

		await page.goto( `${ baseURL }/wp-admin/admin.php?page=fotogrids-settings&tab=media` );
		const crop = page.getByRole( 'radiogroup', { name: 'Crop mode' } );
		await expect( crop.getByRole( 'radio', { name: 'Soft crop' } ) ).toHaveAttribute( 'aria-checked', 'true' );
	} );
} );
