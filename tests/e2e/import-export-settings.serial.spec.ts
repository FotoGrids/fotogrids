import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor, wpCli } from './support/roles';
import { ADMIN, ScratchSite, scratchSitesAvailable } from './support/scratch-site';

/**
 * Tools > Import / Export with Settings: an import changes only the settings
 * ticked for it, Share usage data goes through the same consent path as the
 * Advanced tab, and every other setting is stored the way its settings screen
 * stores it.
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
	'fotogrids_collection_defaults',
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

/** Choose a file on the Import tab and wait for the route to analyse it. */
async function chooseFile( page: Page, base: string, name: string, body: string ): Promise< void > {
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
}

/**
 * Choose a file on the Import tab, tick Settings and each of `settings`, import
 * it, and return the execute response body. An empty `settings` leaves Settings
 * as the screen sets it.
 */
async function importThroughUi(
	page: Page,
	base: string,
	name: string,
	body: string,
	settings: string[]
): Promise< Record< string, unknown > > {
	await chooseFile( page, base, name, body );

	const toggle = page.locator( '#fg-ie-import-settings' );
	await expect( toggle ).toBeVisible();
	await expect( toggle, 'Settings was ticked by default' ).toHaveAttribute( 'aria-checked', 'false' );

	if ( settings.length ) {
		await toggle.click();
		const rows = page.locator( '[id^="fg-ie-import-setting-"]' );
		for ( const row of await rows.all() ) {
			await expect( row, 'a setting was ticked by default' ).toHaveAttribute( 'aria-checked', 'false' );
		}
		for ( const key of settings ) {
			await page.locator( `#fg-ie-import-setting-${ key }` ).click();
		}
	}

	const executed = page.waitForResponse(
		( r ) => decodeURIComponent( r.url() ).includes( ROUTE ) && 'execute' === r.request().postDataJSON()?.phase
	);
	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	const response = await executed;
	expect( response.status() ).toBe( 200 );
	await expect( page.getByRole( 'heading', { name: 'Import complete' } ) ).toBeVisible();

	return response.json();
}

/** POST an execute request from the admin screen, returning the body or the error. */
async function executeThroughApi( page: Page, base: string, file: string, params: Record< string, unknown > ): Promise< Record< string, unknown > > {
	await page.goto( `${ base }${ SCREEN }` );

	return page.evaluate(
		async ( { route, body, extra } ) => {
			try {
				return await window.wp.apiFetch( { path: route, method: 'POST', data: { phase: 'execute', file: body, ...extra } } );
			} catch ( error ) {
				return { error };
			}
		},
		{ route: ROUTE, body: file, extra: params }
	);
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

	test( 'a file with sharing on, left unticked, leaves a site that has not opted in as it is', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
		await logIn( page );
		const before = freemius();
		site.wp( 'option', 'update', 'fs_test_log', '[]', '--format=json' );

		const result = await importThroughUi( page, site.url, 'from-another-site.json', exportFile( { share_statistics: '1', autosave: '0' } ), [ 'autosave' ] );

		expect( result.imported ).toEqual( { settings: true, settings_detail: [ 'autosave' ] } );
		await expect( page.locator( '.fg-ie-done' ) ).toContainText( 'Autosave' );
		expect( readOption( wp, 'fotogrids_share_statistics' ), 'the import switched usage-data sharing on' ).toBeUndefined();
		expect( readOption( wp, 'fotogrids_autosave' ), 'the ticked setting was not imported' ).toBe( '0' );
		expect( freemius() ).toBe( before );
		expect( requests(), 'the import talked to Freemius' ).toEqual( [] );

		await openAdvanced( page, site.url );
		await expect( page.locator( '#fotogrids_share_statistics' ) ).toHaveAttribute( 'aria-checked', 'false' );

		expect( site.phpErrors() ).toEqual( [] );
	} );

	async function optIn( page: Page ): Promise< void > {
		await openAdvanced( page, site.url );
		const write = page.waitForResponse(
			( r ) => decodeURIComponent( r.url() ).includes( '/admin/advanced-settings' ) && 'POST' === r.request().method(),
			{ timeout: 30_000 }
		);
		await page.locator( '#fotogrids_share_statistics' ).click();
		expect( ( await write ).status() ).toBe( 200 );
		await expect.poll( () => JSON.parse( freemius() ).registered, { message: 'opting in did not register the site' } ).toBe( true );
	}

	test( 'a file with sharing off, left unticked, leaves a site that has opted in sharing', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
		await logIn( page );
		await optIn( page );

		const before = freemius();
		site.wp( 'option', 'update', 'fs_test_log', '[]', '--format=json' );

		await importThroughUi( page, site.url, 'from-another-site.json', exportFile( { share_statistics: '0', autosave: '0' } ), [ 'autosave' ] );

		expect( readOption( wp, 'fotogrids_share_statistics' ), 'the import switched usage-data sharing off' ).toBe( '1' );
		expect( freemius() ).toBe( before );
		expect( requests(), 'the import talked to Freemius' ).toEqual( [] );

		await openAdvanced( page, site.url );
		await expect( page.locator( '#fotogrids_share_statistics' ) ).toHaveAttribute( 'aria-checked', 'true' );

		expect( site.phpErrors() ).toEqual( [] );
	} );

	test( 'ticking Share usage data opts the site out the way the Advanced tab does', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
		await logIn( page );
		await optIn( page );
		site.wp( 'option', 'update', 'fs_test_log', '[]', '--format=json' );

		const result = await importThroughUi( page, site.url, 'from-another-site.json', exportFile( { share_statistics: '0' } ), [ 'share_statistics' ] );

		expect( result.imported ).toEqual( { settings: true, settings_detail: [ 'share_statistics' ] } );
		expect( readOption( wp, 'fotogrids_share_statistics' ) ).toBe( '0' );
		expect( JSON.parse( freemius() ).tracking, 'Freemius still tracks the site' ).toBe( false );

		await openAdvanced( page, site.url );
		await expect( page.locator( '#fotogrids_share_statistics' ) ).toHaveAttribute( 'aria-checked', 'false' );

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
		writeOption( sharedWp, 'fotogrids_collection_defaults', {
			gallery: { layout: 'justified' },
			album: { layout: 'justified' },
		} );
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
			} ),
			[ 'media', 'collection_defaults', 'autosave', 'preserve_data_on_uninstall' ]
		);

		expect( readOption( sharedWp, 'fotogrids_autosave' ) ).toBe( '0' );
		expect( readOption( sharedWp, 'fotogrids_preserve_data_on_uninstall' ) ).toBe( '0' );
		expect( readOption( sharedWp, 'fotogrids_media_settings' ) ).toEqual( {
			...MEDIA,
			thumbnail_width: 1,
			thumbnail_crop: false,
		} );
		// An export from before 1.3.0 holds one map for galleries and albums alike.
		const imported = { layout: 'masonry', columns: { desktop: 5, tablet: 2, mobile: 1 } };
		expect( readOption( sharedWp, 'fotogrids_collection_defaults' ) ).toEqual( {
			gallery: imported,
			album: imported,
		} );

		await openAdvanced( page, baseURL as string );
		await expect( page.locator( '#fotogrids_autosave' ) ).toHaveAttribute( 'aria-checked', 'false' );
		await expect( page.locator( '#fotogrids_delete_on_uninstall' ) ).toHaveAttribute( 'aria-checked', 'true' );
	} );

	test( 'a media or defaults block that is not a map is not offered and leaves the site’s own in place', { tag: [ '@admin', '@settings' ] }, async ( { page, baseURL } ) => {
		const file = exportFile( { media: 'not a map', gallery_defaults: 42 } );
		await chooseFile( page, baseURL as string, 'not-a-map.json', file );
		await expect( page.locator( '#fg-ie-import-settings' ) ).toHaveCount( 0 );

		const result = await executeThroughApi( page, baseURL as string, file, {
			include: [ 'settings' ],
			settings: [ 'media', 'collection_defaults' ],
		} );
		expect( result.imported, 'settings the file does not hold were imported' ).not.toHaveProperty( 'settings' );

		expect( readOption( sharedWp, 'fotogrids_media_settings' ) ).toEqual( MEDIA );
		expect( readOption( sharedWp, 'fotogrids_collection_defaults' ) ).toEqual( {
			gallery: { layout: 'justified' },
			album: { layout: 'justified' },
		} );

		await importThroughUi(
			page,
			baseURL as string,
			'not-a-map-per-type.json',
			exportFile( { collection_defaults: { gallery: 42, album: 'not a map' } } ),
			[ 'collection_defaults' ]
		);

		expect( readOption( sharedWp, 'fotogrids_collection_defaults' ) ).toEqual( {
			gallery: { layout: 'justified' },
			album: { layout: 'justified' },
		} );
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
		await importThroughUi( page, baseURL as string, 'fotogrids-export.xml', xml, [ 'media' ] );

		expect( readOption( sharedWp, 'fotogrids_media_settings' ) ).toEqual( { ...MEDIA, thumbnail_crop: false, thumbnail_width: 512 } );

		await page.goto( `${ baseURL }/wp-admin/admin.php?page=fotogrids-settings&tab=media` );
		const crop = page.getByRole( 'radiogroup', { name: 'Crop mode' } );
		await expect( crop.getByRole( 'radio', { name: 'Soft crop' } ) ).toHaveAttribute( 'aria-checked', 'true' );
	} );

	test( 'a file with galleries and settings, imported with the defaults, changes no setting', { tag: [ '@admin', '@settings' ] }, async ( { page, baseURL } ) => {
		const slug = `settings-defaults-${ Date.now() }`;
		const before = OPTIONS.filter( ( name ) => 'fotogrids_import_export_log' !== name ).map( ( name ) => [ name, readOption( sharedWp, name ) ] );

		try {
			const result = await importThroughUi(
				page,
				baseURL as string,
				'galleries-and-settings.json',
				JSON.stringify( {
					meta: { version: '1.3.0' },
					galleries: [ { id: 880101, title: 'Settings defaults', slug, status: 'draft', date: '2026-01-01 00:00:00', meta: {} } ],
					settings: {
						media: { ...MEDIA, thumbnail_width: 999 },
						collection_defaults: { gallery: {}, album: {} },
						autosave: '0',
						preserve_data_on_uninstall: '0',
						share_statistics: '1',
					},
				} ),
				[]
			);

			expect( result.imported ).toMatchObject( { galleries: 1 } );
			expect( result.imported ).not.toHaveProperty( 'settings' );
			for ( const [ name, value ] of before ) {
				expect( readOption( sharedWp, name as string ), `${ name } changed` ).toEqual( value );
			}
		} finally {
			for ( const id of sharedWp( 'post', 'list', '--post_type=fotogrids_gallery', '--post_status=any', `--name=${ slug }`, '--field=ID' ).split( /\s+/ ).filter( Boolean ) ) {
				sharedWp( 'post', 'delete', id, '--force' );
			}
		}
	} );

	test.describe( 'refused', () => {
		test.use( { allowConsoleErrors: 'the import request is refused with a 400 on purpose' } );

		test( 'ticking Settings without choosing which ones is refused over REST, and nothing is imported', { tag: [ '@admin', '@settings', '@api' ] }, async ( { page, baseURL } ) => {
			const slug = `settings-refused-${ Date.now() }`;
			const result = await executeThroughApi(
				page,
				baseURL as string,
				JSON.stringify( {
					meta: { version: '1.3.0' },
					galleries: [ { id: 880102, title: 'Refused', slug, status: 'draft', date: '2026-01-01 00:00:00', meta: {} } ],
					settings: { autosave: '0' },
				} ),
				{ include: [ 'galleries', 'settings' ], galleries: 'duplicate' }
			);

			expect( result.error ).toMatchObject( { code: 'settings_keys_required', data: { status: 400 } } );
			expect( readOption( sharedWp, 'fotogrids_autosave' ) ).toBe( '1' );
			expect( sharedWp( 'post', 'list', '--post_type=fotogrids_gallery', '--post_status=any', `--name=${ slug }`, '--format=count' ) ).toBe( '0' );
		} );
	} );
} );
