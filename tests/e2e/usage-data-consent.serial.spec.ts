import { copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { ADMIN, ScratchSite, scratchSitesAvailable } from './support/scratch-site';

/**
 * LIFE-19 through wp-admin: Share usage data, switched off and on from the
 * Advanced tab and from the setup wizard, on a site with a Freemius account.
 *
 * The Freemius API is answered by tests/harness/freemius-api.php, which records
 * every request in the fs_test_log option, on a WordPress of its own so no
 * other spec ever talks to it.
 */

test.describe.configure( { mode: 'serial' } );

test.skip( ! scratchSitesAvailable(), 'needs the ci-mode harness, which can build a scratch WordPress' );

let site: ScratchSite;

test.beforeEach( async ( {}, testInfo ) => {
	testInfo.setTimeout( 300_000 );
	site = await new ScratchSite( `consent_${ testInfo.testId }` ).create();
	site.wp( 'transient', 'delete', 'fotogrids_activation_redirect' );

	const muPlugins = path.join( site.dir, 'wp-content', 'mu-plugins' );
	mkdirSync( muPlugins, { recursive: true } );
	copyFileSync( path.resolve( 'tests/harness/freemius-api.php' ), path.join( muPlugins, 'freemius-api.php' ) );
} );

test.afterEach( () => {
	site?.destroy();
} );

function freemius( expression: string ): string {
	return site.wp( 'eval', `$fs = freemius( 'fotogrids' ); echo ${ expression };` );
}

function requests(): string[] {
	return JSON.parse( site.wp( 'eval', 'echo wp_json_encode( array_map( function ( $r ) { return $r["m"] . " " . strtok( $r["u"], "?" ) . " " . $r["b"]; }, (array) get_option( "fs_test_log", array() ) ) );' ) );
}

function clearRequests(): void {
	site.wp( 'option', 'update', 'fs_test_log', '[]', '--format=json' );
}

function syncScheduled(): string {
	return site.wp( 'eval', 'echo wp_next_scheduled( "fs_data_sync_fotogrids" ) ? "yes" : "no";' );
}

async function logIn( page: Page ): Promise< void > {
	await page.goto( `${ site.url }/wp-login.php` );
	await page.waitForLoadState( 'networkidle' );
	await page.fill( '#user_login', ADMIN.user );
	await page.fill( '#user_pass', ADMIN.pass );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
}

async function openAdvanced( page: Page ): Promise< void > {
	await page.goto( `${ site.url }/wp-admin/admin.php?page=fotogrids-settings&tab=advanced` );
	await expect( page.locator( '#fotogrids_share_statistics' ) ).toBeVisible( { timeout: 20_000 } );
	await page.waitForLoadState( 'networkidle' );
}

/** Flip a switch on the Advanced tab and wait for autosave to write it. */
async function flip( page: Page, id: string, on: boolean ): Promise< void > {
	const toggle = page.locator( `#${ id }` );
	await expect( toggle ).toHaveAttribute( 'aria-checked', String( ! on ) );

	const write = page.waitForResponse( ( r ) => decodeURIComponent( r.url() ).includes( '/admin/advanced-settings' ) && 'POST' === r.request().method(), { timeout: 30_000 } );
	await toggle.click();
	expect( ( await write ).status() ).toBe( 200 );
	await expect( toggle ).toHaveAttribute( 'aria-checked', String( on ) );
}

/** Opt in from the Advanced tab, then load an admin screen the way the next visit would. */
async function optIn( page: Page ): Promise< void > {
	await openAdvanced( page );
	await flip( page, 'fotogrids_share_statistics', true );
	await expect.poll( () => freemius( '(int) $fs->is_registered()' ), { message: 'opting in did not register the site' } ).toBe( '1' );

	await openAdvanced( page );
	await expect.poll( syncScheduled, { message: 'the first admin load after opting in did not schedule the daily sync' } ).toBe( 'yes' );
}

test( 'LIFE-19: Share usage data off and on again from the Advanced tab', { tag: [ '@settings', '@admin', '@lifecycle' ] }, async ( { page } ) => {
	await logIn( page );
	await optIn( page );

	await flip( page, 'fotogrids_marketing_allowed', true );
	await expect.poll( () => site.wp( 'option', 'get', 'fotogrids_marketing_allowed' ) ).toBe( '1' );

	clearRequests();
	await flip( page, 'fotogrids_share_statistics', false );
	await expect( page.locator( '#fotogrids_marketing_allowed' ), 'Product emails is offered only while usage data is shared' ).toHaveCount( 0 );

	const off = requests().join( '\n' );
	expect( off ).toContain( '/users/11.json {"is_marketing_allowed":false}' );
	expect( off ).toContain( '/installs/22/permissions.json {"permissions":"user,site,extensions","is_enabled":false}' );
	expect( syncScheduled(), 'the daily Freemius sync is still scheduled' ).toBe( 'no' );
	expect( freemius( '(int) $fs->is_anonymous()' ), 'the Freemius account is still connected' ).toBe( '1' );
	expect( site.wp( 'option', 'get', 'fotogrids_marketing_allowed' ) ).toBe( '0' );

	clearRequests();
	await openAdvanced( page );
	await expect( page.locator( '#fotogrids_share_statistics' ) ).toHaveAttribute( 'aria-checked', 'false' );
	expect( requests(), 'an admin load after opting out still talked to Freemius' ).toEqual( [] );

	await flip( page, 'fotogrids_share_statistics', true );
	const on = requests().join( '\n' );
	expect( on ).toContain( '/installs/22/permissions.json {"permissions":"user,site,extensions","is_enabled":true}' );
	expect( on, 'switching back on registered the site a second time' ).not.toContain( '/action/service/user/install/' );
	await expect.poll( () => freemius( '(int) $fs->is_registered()' ) ).toBe( '1' );
	expect( syncScheduled() ).toBe( 'yes' );
	await expect( page.locator( '#fotogrids_marketing_allowed' ) ).toHaveAttribute( 'aria-checked', 'false' );

	expect( site.phpErrors() ).toEqual( [] );
} );

test( 'LIFE-19: Share usage data off while Freemius refuses it still stops the site sending', { tag: [ '@settings', '@admin', '@lifecycle' ] }, async ( { page } ) => {
	await logIn( page );
	await optIn( page );

	site.wp( 'option', 'update', 'fs_test_fail', '1' );
	clearRequests();
	await flip( page, 'fotogrids_share_statistics', false );
	expect( requests().join( '\n' ), 'the opt-out never reached the Freemius API' ).toContain( '/installs/22/permissions.json' );
	expect( site.wp( 'option', 'get', 'fotogrids_share_statistics' ) ).toBe( '0' );
	expect( freemius( '(int) $fs->is_tracking_allowed()' ), 'tracking is still allowed after a refused opt-out' ).toBe( '0' );
	expect( freemius( '(int) $fs->is_anonymous()' ), 'the account is still connected after a refused opt-out' ).toBe( '1' );
	site.wp( 'option', 'delete', 'fs_test_fail' );

	clearRequests();
	await flip( page, 'fotogrids_share_statistics', true );
	expect( requests().join( '\n' ) ).toContain( '/installs/22/permissions.json {"permissions":"user,site,extensions","is_enabled":true}' );
	await expect.poll( () => freemius( '(int) $fs->is_registered()' ) ).toBe( '1' );

	expect( site.phpErrors() ).toEqual( [] );
} );

test( 'LIFE-19: Share usage data off from the setup wizard', { tag: [ '@settings', '@admin', '@lifecycle' ] }, async ( { page } ) => {
	await logIn( page );
	await optIn( page );

	await page.goto( `${ site.url }/wp-admin/admin.php?page=fotogrids-dashboard&fotogrids_setup_step=1` );
	const telemetry = page.locator( '#fotogrids-setup-telemetry' );
	await expect( telemetry ).toBeVisible( { timeout: 20_000 } );
	await page.waitForLoadState( 'networkidle' );
	await expect( telemetry ).toHaveAttribute( 'aria-checked', 'true' );

	clearRequests();
	const write = page.waitForResponse( ( r ) => r.url().includes( 'admin-ajax.php' ) && 'POST' === r.request().method(), { timeout: 30_000 } );
	await telemetry.click();
	await write;

	await expect.poll( () => requests().join( '\n' ) ).toContain( '/installs/22/permissions.json {"permissions":"user,site,extensions","is_enabled":false}' );
	expect( syncScheduled() ).toBe( 'no' );
	expect( freemius( '(int) $fs->is_anonymous()' ) ).toBe( '1' );
	// The wizard's AJAX write runs through the Settings API sanitizer, which stores off as ''.
	expect( [ '', '0' ] ).toContain( site.wp( 'option', 'get', 'fotogrids_share_statistics' ) );

	expect( site.phpErrors() ).toEqual( [] );
} );

test( 'LIFE-18: Reset all settings leaves the usage-data choice and Freemius alone', { tag: [ '@settings', '@admin', '@lifecycle' ] }, async ( { page } ) => {
	await logIn( page );
	await optIn( page );

	clearRequests();
	await page.goto( `${ site.url }/wp-admin/admin.php?page=fotogrids-settings&tab=maintenance` );
	await page.getByRole( 'button', { name: 'Reset settings' } ).first().click();
	const dialog = page.getByRole( 'dialog' );
	await dialog.getByRole( 'textbox' ).fill( 'CONFIRM' );
	const done = page.waitForResponse( ( r ) => decodeURIComponent( r.url() ).includes( '/admin/maintenance/reset-options' ) );
	await dialog.getByRole( 'button', { name: 'Reset settings' } ).click();
	expect( ( await done ).status() ).toBe( 200 );

	expect( site.wp( 'option', 'get', 'fotogrids_share_statistics' ) ).toBe( '1' );
	expect( requests().filter( ( r ) => r.includes( 'permissions' ) || r.includes( 'is_marketing_allowed' ) ), 'the reset changed Freemius consent' ).toEqual( [] );
	expect( freemius( '(int) $fs->is_registered()' ) ).toBe( '1' );
	expect( syncScheduled() ).toBe( 'yes' );

	await openAdvanced( page );
	await expect( page.locator( '#fotogrids_share_statistics' ) ).toHaveAttribute( 'aria-checked', 'true' );

	expect( site.phpErrors() ).toEqual( [] );
} );
