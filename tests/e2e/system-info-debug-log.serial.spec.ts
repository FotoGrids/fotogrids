import { execFileSync } from 'child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import type { APIRequestContext, Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { apiAs, storageStateFor, wpCli, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The WordPress debug log panel on Tools > System Info > Error Log.
 *
 * Serial: the debug log and wp-config.php are site-wide. Both are put back.
 */

test.describe.configure( { mode: 'serial' } );

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=system-info';
const ROUTE = '/fotogrids/v1/admin/tools/system-info/debug-log';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** The file WordPress logs to, or an empty string when WP_DEBUG_LOG is off. */
function resolveLogPath(): string {
	return wpEval(
		`echo ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) ? ( is_string( WP_DEBUG_LOG ) ? WP_DEBUG_LOG : WP_CONTENT_DIR . '/debug.log' ) : '';`
	).trim();
}

/** A wp-config.php constant as raw PHP, or null when it is not defined there. */
function rawConstant( name: string ): string | null {
	try {
		const value = JSON.parse(
			execFileSync(
				wpCli(),
				[ 'config', 'get', name, '--type=constant', '--format=json' ],
				{ encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'ignore' ] }
			)
		);

		return 'string' === typeof value
			? `'${ value.replace( /\\/g, '\\\\' ).replace( /'/g, "\\'" ) }'`
			: JSON.stringify( value );
	} catch {
		return null;
	}
}

function setConstant( name: string, raw: string | null ): void {
	if ( null === raw ) {
		try {
			execFileSync( wpCli(), [ 'config', 'delete', name, '--type=constant' ], {
				stdio: 'ignore',
			} );
		} catch {
			// Already absent.
		}
		return;
	}

	wp( [ 'config', 'set', name, raw, '--raw', '--type=constant' ] );
}

function numbered( count: number, label = 'fg-e2e debug line' ): string {
	return Array.from( { length: count }, ( _, i ) => `${ label } ${ i + 1 }` ).join( '\n' ) + '\n';
}

async function openErrorLog( page: Page ): Promise< Response > {
	await page.goto( SCREEN );

	const [ response ] = await Promise.all( [
		page.waitForResponse( ( r ) => decodeURIComponent( r.url() ).includes( ROUTE ) ),
		page.getByRole( 'tab', { name: 'Error Log' } ).click(),
	] );

	return response;
}

function panelHeading( page: Page ) {
	return page.getByRole( 'heading', { name: 'WordPress debug log' } );
}

async function fetchLog( api: APIRequestContext, nonce: string, query = '' ) {
	return api.get( `/index.php?rest_route=${ encodeURIComponent( ROUTE ) }${ query }`, {
		headers: { 'X-WP-Nonce': nonce },
	} );
}

/**
 * Status and body of the route, as one value `expect.poll` can wait on.
 *
 * PHP's opcache can serve the previous wp-config.php for up to
 * `opcache.revalidate_freq` seconds after it is rewritten.
 */
async function logState( api: APIRequestContext, nonce: string ) {
	const response = await fetchLog( api, nonce );
	const body = 200 === response.status() ? await response.json() : {};

	return { status: response.status(), available: body.available, path: body.path, lines: body.lines };
}

let logPath = '';
let original: string | null = null;
let debugLogRaw: string | null = null;
let fsMethodRaw: string | null = null;

test.beforeAll( () => {
	logPath = resolveLogPath();
	original = logPath && existsSync( logPath ) ? readFileSync( logPath, 'utf8' ) : null;
	debugLogRaw = rawConstant( 'WP_DEBUG_LOG' );
	fsMethodRaw = rawConstant( 'FS_METHOD' );
} );

test.afterAll( () => {
	if ( ! logPath ) {
		return;
	}

	if ( null === original ) {
		rmSync( logPath, { force: true } );
	} else {
		writeFileSync( logPath, original );
	}
} );

test.beforeEach( () => {
	test.skip( '' === logPath, 'WP_DEBUG_LOG is off on this site, so there is no log to show' );
} );

test( 'the Error Log tab shows the last lines of a non-empty debug log', { tag: '@admin' }, async ( {
	page,
} ) => {
	writeFileSync( logPath, numbered( 5 ) );

	const response = await openErrorLog( page );
	expect( response.status(), 'the debug-log request failed' ).toBe( 200 );

	await expect( panelHeading( page ) ).toBeVisible();
	await page.getByRole( 'button', { name: 'Show log' } ).click();

	await expect(
		page.getByText( `Showing all 5 lines of ${ ( await response.json() ).path }.` )
	).toBeVisible();
	await expect( page.locator( 'pre' ).filter( { hasText: 'fg-e2e debug line 1' } ) ).toHaveText(
		numbered( 5 ).trimEnd()
	);

	await page.getByRole( 'button', { name: 'Hide log' } ).click();
	await expect( page.getByText( 'fg-e2e debug line 1' ) ).toBeHidden();
} );

test( 'an empty debug log is reported as empty', { tag: '@admin' }, async ( { page } ) => {
	writeFileSync( logPath, '' );

	expect( ( await openErrorLog( page ) ).status() ).toBe( 200 );

	await page.getByRole( 'button', { name: 'Show log' } ).click();
	await expect( page.getByText( 'The debug log is empty.' ) ).toBeVisible();
} );

test( 'the panel stays hidden when the log file does not exist', { tag: '@admin' }, async ( {
	page,
} ) => {
	rmSync( logPath, { force: true } );

	try {
		const response = await openErrorLog( page );
		expect( response.status() ).toBe( 200 );
		expect( ( await response.json() ).available ).toBe( false );

		await expect( page.getByRole( 'heading', { name: 'PHP error log' } ) ).toBeVisible();
		await expect( panelHeading( page ) ).toBeHidden();
	} finally {
		// The PHP-notice guard reads the log after every test.
		writeFileSync( logPath, '' );
	}
} );

test( 'a log larger than the tail window returns its last lines and says so', { tag: [ '@admin', '@api' ] }, async ( {
	playwright,
} ) => {
	writeFileSync( logPath, numbered( 20000, 'fg-e2e bulk line padded to widen the file' ) );

	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const response = await fetchLog( context, nonce, '&lines=50' );
	expect( response.status() ).toBe( 200 );

	const body = await response.json();
	expect( body.truncated ).toBe( true );
	expect( body.shown ).toBe( 50 );
	expect( body.lines[ 0 ] ).toBe( 'fg-e2e bulk line padded to widen the file 19951' );
	expect( body.lines[ 49 ] ).toBe( 'fg-e2e bulk line padded to widen the file 20000' );

	await context.dispose();
} );

test( 'a WP_DEBUG_LOG path outside wp-content/debug.log is read', { tag: [ '@admin', '@api' ] }, async ( {
	playwright,
} ) => {
	const custom = path.join( path.dirname( logPath ), 'fg-e2e-custom-debug.log' );
	writeFileSync( custom, numbered( 3, 'fg-e2e custom line' ) );

	const { context, nonce } = await apiAs( playwright, 'administrator' );

	setConstant( 'WP_DEBUG_LOG', `'${ custom.replace( /\\/g, '\\\\' ).replace( /'/g, "\\'" ) }'` );

	try {
		await expect
			.poll( async () => ( await logState( context, nonce ) ).path )
			.toMatch( /fg-e2e-custom-debug\.log$/ );

		const state = await logState( context, nonce );
		expect( state.status ).toBe( 200 );
		expect( state.available ).toBe( true );
		expect( state.lines ).toEqual( [ 'fg-e2e custom line 1', 'fg-e2e custom line 2', 'fg-e2e custom line 3' ] );
	} finally {
		setConstant( 'WP_DEBUG_LOG', debugLogRaw );
		await expect
			.poll( async () => ( await logState( context, nonce ) ).path ?? '' )
			.not.toMatch( /fg-e2e-custom-debug\.log$/ );
		rmSync( custom, { force: true } );
		await context.dispose();
	}
} );

test( 'a site without direct filesystem access gets no log and no error', { tag: [ '@admin', '@api' ] }, async ( {
	playwright,
} ) => {
	writeFileSync( logPath, numbered( 5 ) );

	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const state = async () => {
		const { status, available } = await logState( context, nonce );
		return { status, available };
	};

	await expect.poll( state ).toEqual( { status: 200, available: true } );

	setConstant( 'FS_METHOD', "'ftpext'" );

	try {
		await expect.poll( state ).toEqual( { status: 200, available: false } );
	} finally {
		setConstant( 'FS_METHOD', fsMethodRaw );
		await expect.poll( state ).toEqual( { status: 200, available: true } );
		await context.dispose();
	}
} );
