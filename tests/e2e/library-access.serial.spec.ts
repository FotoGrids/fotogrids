import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { roles as sessions, storageStateFor, wpEval } from './support/roles';
import type { Role } from './support/roles';
import { restoreRoles, snapshotRoles } from './support/site';

/**
 * LIB-01 to LIB-08. Who is shown the Library screen and who can open it, when
 * access comes from the fotogrids/permissions/check filter, from a role's
 * capabilities, or from the manage_fotogrids fallback.
 *
 * Serial: installs a mu-plugin, edits roles and creates a user.
 */

test.describe.configure( { mode: 'serial' } );

const MU_PLUGIN = 'fg-e2e-library-access.php';
const DECISIONS = 'fg_e2e_library_decisions';
const PASSWORD = 'fg-library-pass';
const REFUSED = 'a refused screen answers 403, which the browser logs';

/** Answers the filter for manage_fotogrids_library from a login => bool option. */
const PLUGIN = `<?php
add_filter( 'fotogrids/permissions/check', function ( $allowed, $capability, $user ) {
	if ( 'manage_fotogrids_library' !== $capability ) {
		return $allowed;
	}
	$decisions = (array) get_option( '${ DECISIONS }', array() );
	$login     = ( $user ?: wp_get_current_user() )->user_login;
	return array_key_exists( $login, $decisions ) ? (bool) $decisions[ $login ] : $allowed;
}, 10, 3 );
`;

function decide( decisions: Partial< Record< Role, boolean > > ): void {
	const byLogin: Record< string, boolean > = {};
	for ( const [ role, allowed ] of Object.entries( decisions ) ) {
		byLogin[ sessions().roles[ role as Role ].user ] = allowed as boolean;
	}
	wpEval(
		`update_option( '${ DECISIONS }', json_decode( '${ JSON.stringify( byLogin ) }', true ) );`
	);
}

function fotogridsMenu( page: Page ) {
	return page
		.locator( '#adminmenu li.menu-top' )
		.filter( { has: page.locator( 'a.menu-top', { hasText: 'FotoGrids' } ) } );
}

async function follow( page: Page, click: () => Promise< void > ): Promise< Response > {
	const landed = page.waitForResponse(
		( r ) => r.request().isNavigationRequest() && r.request().frame() === page.mainFrame()
	);
	await click();
	return landed;
}

async function submenu( page: Page ): Promise< string[] > {
	await page.goto( '/wp-admin/' );
	return fotogridsMenu( page ).locator( '.wp-submenu a' ).allInnerTexts();
}

/** Library is served, highlighted, and offers the management controls. */
async function expectLibrary( page: Page, response: Response ) {
	expect( response.status(), `Library answered ${ response.status() }` ).toBe( 200 );
	expect( page.url() ).toContain( 'page=fotogrids-library' );
	await expect( fotogridsMenu( page ).locator( '.wp-submenu li.current a' ) ).toHaveText(
		'Library'
	);
	await expect( page.getByRole( 'button', { name: 'Add Tag' } ) ).toBeVisible();
}

async function openLibraryFromMenu( page: Page ): Promise< Response > {
	await page.goto( '/wp-admin/' );
	const menu = fotogridsMenu( page );
	await menu.hover();
	return follow( page, () =>
		menu.locator( '.wp-submenu' ).getByRole( 'link', { name: 'Library', exact: true } ).click()
	);
}

async function expectRefused( page: Page ) {
	expect( await submenu( page ) ).not.toContain( 'Library' );

	const refused = await page.goto( '/wp-admin/admin.php?page=fotogrids-library' );
	expect( refused?.status() ).toBe( 403 );
}

test.describe( 'the fotogrids/permissions/check filter', () => {
	test.use( { allowConsoleErrors: REFUSED } );

	test.beforeAll( () => {
		wpEval(
			`wp_mkdir_p( WPMU_PLUGIN_DIR ); file_put_contents( WPMU_PLUGIN_DIR . '/${ MU_PLUGIN }', base64_decode( '${ Buffer.from( PLUGIN ).toString( 'base64' ) }' ) );`
		);
		decide( { author: true, subscriber: true, editor: false, administrator: false } );
	} );

	test.afterAll( () => {
		wpEval(
			`wp_delete_file( WPMU_PLUGIN_DIR . '/${ MU_PLUGIN }' ); delete_option( '${ DECISIONS }' );`
		);
	} );

	test.describe( 'granting an author', () => {
		test.use( { storageState: storageStateFor( 'author' ) } );

		const name = `LIB-01 ${ Date.now() }`;

		test.afterAll( () => {
			wpEval(
				`global $wpdb; $wpdb->delete( $wpdb->prefix . 'fotogrids_tags', array( 'name' => '${ name }' ) );`
			);
		} );

		test( 'LIB-01: opens Library from the menu and adds a tag', { tag: [ '@critical', '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			expect( await submenu( page ) ).toEqual( [ 'Galleries', 'Albums', 'Library' ] );

			await expectLibrary( page, await openLibraryFromMenu( page ) );

			await page.getByRole( 'button', { name: 'Add Tag' } ).click();
			const dialog = page.getByRole( 'dialog' );
			await dialog.getByRole( 'textbox' ).first().fill( name );
			await dialog.getByRole( 'button', { name: 'Create' } ).click();

			await expect(
				page.locator( '.fotogrids-library-table tbody tr', { hasText: name } )
			).toHaveCount( 1 );
		} );
	} );

	test.describe( 'granting a subscriber', () => {
		test.use( { storageState: storageStateFor( 'subscriber' ) } );

		test( 'LIB-02: a user holding no FotoGrids capability is led to Library and nowhere else', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			expect( await submenu( page ) ).toEqual( [ 'Library' ] );

			const top = fotogridsMenu( page ).locator( 'a.menu-top' );
			await expectLibrary( page, await follow( page, () => top.click() ) );

			for ( const slug of [ 'fotogrids', 'fotogrids-dashboard', 'fotogrids-stats', 'fotogrids-settings' ] ) {
				const response = await page.goto( `/wp-admin/admin.php?page=${ slug }` );
				expect( response?.status(), slug ).toBe( 403 );
			}
		} );
	} );

	test.describe( 'denying an editor', () => {
		test.use( { storageState: storageStateFor( 'editor' ) } );

		test( 'LIB-03: the editor is not shown Library and its URL is refused', { tag: [ '@critical', '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			await expectRefused( page );
			expect( await submenu( page ) ).toEqual( [ 'Galleries', 'Albums', 'Statistics' ] );
		} );
	} );

	test.describe( 'denying an administrator', () => {
		test.use( { storageState: storageStateFor( 'administrator' ) } );

		test( 'LIB-04: the administrator is not shown Library and keeps every other screen', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			await expectRefused( page );
			expect( await submenu( page ) ).toEqual(
				expect.arrayContaining( [ 'Dashboard', 'Galleries', 'Albums', 'Templates', 'Statistics', 'Settings', 'Tools' ] )
			);
		} );
	} );
} );

test.describe( 'without the filter', () => {
	test.use( { allowConsoleErrors: REFUSED } );

	test.describe( 'an editor', () => {
		test.use( { storageState: storageStateFor( 'editor' ) } );

		test( 'LIB-05: the editor opens Library with its controls by default', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			await expectLibrary( page, await openLibraryFromMenu( page ) );
		} );
	} );

	test.describe( 'an author', () => {
		test.use( { storageState: storageStateFor( 'author' ) } );

		test( 'LIB-06: the author is not shown Library by default', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			await expectRefused( page );
		} );
	} );

	test.describe( 'a contributor given Library in the Permissions Manager', () => {
		test.use( { storageState: storageStateFor( 'contributor' ) } );

		let roles: string;

		test.beforeAll( () => {
			roles = snapshotRoles();
			wpEval( "get_role( 'contributor' )->add_cap( 'manage_fotogrids_library' );" );
		} );

		test.afterAll( () => {
			restoreRoles( roles );
		} );

		test( 'LIB-07: the menu leads to Library and the Dashboard stays refused', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			expect( await submenu( page ) ).toEqual( [ 'Library' ] );

			const top = fotogridsMenu( page ).locator( 'a.menu-top' );
			await expectLibrary( page, await follow( page, () => top.click() ) );

			const dashboard = await page.goto( '/wp-admin/admin.php?page=fotogrids' );
			expect( dashboard?.status() ).toBe( 403 );
		} );
	} );

	test.describe( 'a role holding only manage_fotogrids', () => {
		test.use( { storageState: { cookies: [], origins: [] } } );

		let roles: string;

		test.beforeAll( () => {
			roles = snapshotRoles();
			wpEval( `
add_role( 'fg_library_manage_only', 'FG manage only', array( 'read' => true, 'manage_fotogrids' => true ) );
$id = username_exists( 'fg-library-manage' ) ?: wp_insert_user( array( 'user_login' => 'fg-library-manage', 'user_pass' => '${ PASSWORD }', 'user_email' => 'fg-library-manage@example.com' ) );
( new WP_User( $id ) )->set_role( 'fg_library_manage_only' );
wp_set_password( '${ PASSWORD }', $id );` );
		} );

		test.afterAll( () => {
			wpEval( `
require_once ABSPATH . 'wp-admin/includes/user.php';
$id = username_exists( 'fg-library-manage' );
if ( $id ) { wp_delete_user( $id ); }` );
			restoreRoles( roles );
		} );

		test( 'LIB-08: manage_fotogrids reaches Library through the fallback, as the library routes do', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			await page.goto( '/wp-login.php' );
			await page.locator( '#user_login' ).fill( 'fg-library-manage' );
			await page.locator( '#user_pass' ).fill( PASSWORD );
			await follow( page, () => page.locator( '#wp-submit' ).click() );

			expect( await submenu( page ) ).toContain( 'Library' );
			await expectLibrary( page, await openLibraryFromMenu( page ) );
		} );
	} );
} );
