import { renameSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { ADMIN, ScratchSite, scratchSitesAvailable } from './support/scratch-site';

/**
 * LIFE-10 and LIFE-11 through wp-admin. Deleting FotoGrids from the Plugins
 * screen honours "Delete all data on uninstall" however the plugin was
 * deactivated, and never fails the delete.
 *
 * Each test deletes the plugin, so each gets a WordPress of its own.
 *
 * Serial: every test starts a site and a server.
 */

test.describe.configure( { mode: 'serial' } );

test.skip( ! scratchSitesAvailable(), 'needs the ci-mode harness, which can build a scratch WordPress' );

/** Everything the plugin owns, counted. */
const OWNED = `
global $wpdb;
$caps = 0;
foreach ( wp_roles()->roles as $role ) {
	foreach ( array_keys( array_filter( $role['capabilities'] ) ) as $cap ) {
		$caps += false !== strpos( $cap, 'fotogrids' ) ? 1 : 0;
	}
}
$cron = 0;
foreach ( (array) _get_cron_array() as $hooks ) {
	foreach ( array_keys( (array) $hooks ) as $hook ) {
		$cron += false !== strpos( $hook, 'fotogrids' ) ? 1 : 0;
	}
}
echo wp_json_encode( array(
	'tables'      => count( $wpdb->get_col( "SHOW TABLES LIKE '{$wpdb->prefix}fotogrids\\\\_%'" ) ),
	'options'     => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE 'fotogrids\\\\_%'" ),
	'collections' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type IN ('fotogrids_gallery','fotogrids_album','fotogrids_embed')" ),
	'postmeta'    => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key LIKE 'fotogrids\\\\_%' OR meta_key LIKE '\\\\_fotogrids\\\\_%'" ),
	'usermeta'    => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key LIKE 'fotogrids\\\\_%' OR meta_key LIKE '\\\\_fotogrids\\\\_%'" ),
	'caps'        => $caps,
	'cron'        => $cron,
) );
`;

type Owned = Record< 'tables' | 'options' | 'collections' | 'postmeta' | 'usermeta' | 'caps' | 'cron', number >;

const NOTHING: Owned = { tables: 0, options: 0, collections: 0, postmeta: 0, usermeta: 0, caps: 0, cron: 0 };

let site: ScratchSite;

test.beforeEach( async ( {}, testInfo ) => {
	testInfo.setTimeout( 180_000 );
	site = await new ScratchSite( `uninstall_${ testInfo.testId }` ).create();

	// A fresh activation sends the first admin load to the setup wizard.
	site.wp( 'transient', 'delete', 'fotogrids_activation_redirect' );
	site.seed( 'F-small' );
	site.seed( 'F-album' );
	site.wp( 'user', 'meta', 'update', '1', 'fotogrids_user_templates', '[{"name":"saved"}]' );
	// A load, so the events scheduled on init exist.
	site.wp( 'option', 'get', 'fotogrids_version' );
	site.wp( 'post', 'create', '--post_type=page', '--post_title=Owned by the site', '--post_status=publish' );
} );

test.afterEach( () => {
	site?.destroy();
} );

function owned(): Owned {
	return JSON.parse( site.wp( 'eval', OWNED ) );
}

function sitePages(): number {
	return Number( site.wp( 'post', 'list', '--post_type=page', '--title=Owned by the site', '--format=count' ) );
}

/** Lands on the Plugins screen, not the Dashboard, whose widget is not under test. */
async function logIn( page: Page ): Promise< void > {
	await page.goto( `${ site.url }/wp-login.php?redirect_to=${ encodeURIComponent( `${ site.url }/wp-admin/plugins.php` ) }` );
	await page.fill( '#user_login', ADMIN.user );
	await page.fill( '#user_pass', ADMIN.pass );
	await page.click( '#wp-submit' );
	await page.waitForURL( /plugins\.php/ );
}

/** Settings > Advanced, through the typed confirmation. */
async function turnOnDataDeletion( page: Page ): Promise< void > {
	await page.goto( `${ site.url }/wp-admin/admin.php?page=fotogrids-settings&tab=advanced` );
	await page.locator( '#fotogrids_delete_on_uninstall' ).click( { force: true } );

	const dialog = page.getByRole( 'dialog' );
	await dialog.getByRole( 'textbox' ).fill( 'CONFIRM' );
	await dialog.getByRole( 'button', { name: 'Enable data deletion' } ).click();

	await expect
		.poll( () => site.wp( 'eval', 'echo (int) get_option( "fotogrids_preserve_data_on_uninstall", 1 );' ), {
			message: 'the Advanced tab did not save the choice',
		} )
		.toBe( '0' );
}

/** Deactivate from the Plugins screen, skipping the feedback question. */
async function deactivate( page: Page ): Promise< void > {
	await page.goto( `${ site.url }/wp-admin/plugins.php` );
	await page.click( '#deactivate-fotogrids' );
	await page.getByRole( 'button', { name: 'Skip & Deactivate' } ).click();
	await page.waitForURL( /deactivate=true/ );
}

/** Delete from the Plugins screen and return the row WordPress shows. */
async function deleteFromPluginsScreen( page: Page ): Promise< string > {
	await page.goto( `${ site.url }/wp-admin/plugins.php` );
	page.once( 'dialog', ( dialog ) => dialog.accept() );
	await page.click( '#delete-fotogrids' );

	const done = page.locator( 'tr.plugin-deleted-tr, .notice-error:visible' ).first();
	await done.waitFor( { timeout: 60_000 } );

	return done.innerText();
}

test( 'LIFE-10: deactivated and deleted in wp-admin, the data goes', { tag: [ '@lifecycle', '@admin' ] }, async ( { page } ) => {
	await logIn( page );
	await turnOnDataDeletion( page );
	await deactivate( page );

	expect( await deleteFromPluginsScreen( page ) ).toContain( 'FotoGrids was successfully deleted.' );
	expect( owned() ).toEqual( NOTHING );
	expect( sitePages(), 'a page the site owns was deleted' ).toBe( 1 );
	expect( site.phpErrors() ).toEqual( [] );
} );

test( 'LIFE-10: with deletion left off, a delete keeps everything', { tag: [ '@lifecycle', '@admin' ] }, async ( { page } ) => {
	const before = owned();

	await logIn( page );
	await deactivate( page );

	expect( await deleteFromPluginsScreen( page ) ).toContain( 'FotoGrids was successfully deleted.' );

	const after = owned();
	expect( after.tables ).toBe( before.tables );
	expect( after.collections ).toBe( before.collections );
	expect( after.postmeta ).toBe( before.postmeta );
	expect( after.usermeta ).toBe( before.usermeta );
	expect( after.caps ).toBe( before.caps );
	expect( site.phpErrors() ).toEqual( [] );
} );

test( 'LIFE-11: deactivated with nobody logged in, then deleted in wp-admin, the data goes', {
	tag: [ '@lifecycle', '@admin' ],
}, async ( { page } ) => {
	await logIn( page );
	await turnOnDataDeletion( page );

	// WP-CLI, a deploy script or a host's tooling.
	site.wp( 'plugin', 'deactivate', 'fotogrids' );

	expect( await deleteFromPluginsScreen( page ) ).toContain( 'FotoGrids was successfully deleted.' );
	expect( owned() ).toEqual( NOTHING );
	expect( site.phpErrors() ).toEqual( [] );
} );

test( 'LIFE-11: with the Freemius SDK files missing, the delete completes and the data goes', {
	tag: [ '@lifecycle', '@admin' ],
}, async ( { page } ) => {
	await logIn( page );
	await turnOnDataDeletion( page );
	await deactivate( page );

	// What a half-finished update or upload leaves behind.
	const sdk = path.join( site.dir, 'wp-content', 'plugins', 'fotogrids', 'freemius', 'start.php' );
	renameSync( sdk, `${ sdk }.away` );

	expect( await deleteFromPluginsScreen( page ) ).toContain( 'FotoGrids was successfully deleted.' );
	expect( owned() ).toEqual( NOTHING );
	expect( site.phpErrors() ).toEqual( [] );
} );

test( 'LIFE-11: deactivated by WordPress for missing files, the delete clears the scheduled events', {
	tag: [ '@lifecycle', '@admin' ],
}, async ( { page } ) => {
	const plugin = path.join( site.dir, 'wp-content', 'plugins', 'fotogrids' );
	const { cron: scheduled, tables } = owned();
	expect( scheduled, 'nothing was scheduled to strand' ).toBeGreaterThan( 0 );

	// WordPress deactivates a plugin whose main file is missing without running
	// its deactivation hook, so the events stay scheduled. Moved while the site
	// is idle, so no request is part-way through loading it.
	renameSync( plugin, `${ plugin }.away` );
	await logIn( page );
	await expect( page.getByText( 'Plugin file does not exist.' ) ).toBeVisible();
	renameSync( `${ plugin }.away`, plugin );

	expect( owned().cron ).toBe( scheduled );

	expect( await deleteFromPluginsScreen( page ) ).toContain( 'FotoGrids was successfully deleted.' );
	expect( owned().cron ).toBe( 0 );
	expect( owned().tables, 'deletion was off, so the data stays' ).toBe( tables );
	expect( site.phpErrors() ).toEqual( [] );
} );
