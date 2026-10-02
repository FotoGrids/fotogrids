import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { storageStateFor, wpCli } from './support/roles';
import { getOption, setOption } from './support/site';

/**
 * LIFE-04 and LIFE-05. The setup wizard opens once, on a fresh install only.
 *
 * Both halves drive a real activation rather than planting the transient, since
 * which activations set it is the thing under test. Freshness is decided by
 * `fotogrids_version`, so removing that option is what makes an activation look
 * like a first install; it is put back afterwards.
 *
 * Serial: the plugin is deactivated and reactivated under the running site.
 */

test.describe.configure( { mode: 'serial' } );
test.use( { storageState: storageStateFor( 'administrator' ) } );

const TRANSIENT = 'fotogrids_activation_redirect';
const WIZARD = 'page=fotogrids-dashboard&fotogrids_setup_step=1';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** Deactivated and activated as the admin, which is how a site does it. */
function reactivate(): void {
	wp( [ '--user=admin', 'plugin', 'deactivate', 'fotogrids' ] );
	wp( [ '--user=admin', 'plugin', 'activate', 'fotogrids' ] );
}

function redirectFlagged(): boolean {
	try {
		return '' !== wp( [ 'transient', 'get', TRANSIENT ] );
	} catch {
		// An absent transient exits non-zero, which is an answer.
		return false;
	}
}

let version: string | null;

test.beforeAll( () => {
	version = getOption( 'fotogrids_version' );
} );

test.afterAll( () => {
	setOption( 'fotogrids_version', version );
	wp( [ 'transient', 'delete', TRANSIENT ] );
} );

test( 'LIFE-05: reactivating an existing install does not flag the wizard', () => {
	expect( version, 'the site has no stored version, so it is not an existing install' )
		.not.toBeNull();

	wp( [ 'transient', 'delete', TRANSIENT ] );
	reactivate();

	expect( redirectFlagged(), 'a reactivation would have hijacked the next admin screen' )
		.toBe( false );
} );

test( 'LIFE-04: a fresh activation flags it, and one admin load spends it', {
	tag: '@critical',
}, async ( { page } ) => {
	setOption( 'fotogrids_version', null );
	reactivate();

	expect( redirectFlagged(), 'a fresh activation did not flag the redirect' ).toBe( true );

	// The transient lives 30s, so the first load has to be the next thing.
	await page.goto( '/wp-admin/' );
	expect( page.url(), 'the first admin load did not reach the wizard' ).toContain( WIZARD );

	// Consumed on read, so a reload stays where it was asked to go.
	await page.goto( '/wp-admin/' );
	expect( page.url(), 'the wizard opened twice' ).not.toContain( WIZARD );
	expect( redirectFlagged(), 'the transient outlived its one use' ).toBe( false );
} );
