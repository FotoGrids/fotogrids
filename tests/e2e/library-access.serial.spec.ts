import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { apiAs, roles as sessions, storageStateFor, wpEval } from './support/roles';
import { restoreRoles, snapshotRoles } from './support/site';

/**
 * LIB-01 to LIB-03. Reaching the Library screen when access comes from the
 * fotogrids/permissions/check filter or from a role below the collection caps.
 *
 * Serial: installs a mu-plugin and grants capabilities.
 */

test.describe.configure( { mode: 'serial' } );

const MU_PLUGIN = 'fg-e2e-library-access.php';

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

async function submenuLinks( page: Page ): Promise< string[] > {
	await page.goto( '/wp-admin/' );
	return fotogridsMenu( page ).locator( '.wp-submenu a' ).allInnerTexts();
}

async function expectLibrary( page: Page, response: Response ) {
	expect( response.status(), `Library answered ${ response.status() }` ).toBe( 200 );
	expect( page.url() ).toContain( 'page=fotogrids-library' );
	await expect( page.locator( '#fotogrids-library-page' ) ).toHaveCount( 1 );
}

test.describe( 'the fotogrids/permissions/check filter', () => {
	test.use( {
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	test.beforeAll( () => {
		const { author, editor } = sessions().roles;
		const plugin = `<?php
add_filter( 'fotogrids/permissions/check', function ( $allowed, $capability, $user ) {
	if ( 'manage_fotogrids_library' !== $capability ) {
		return $allowed;
	}
	$login = ( $user ?: wp_get_current_user() )->user_login;
	if ( '${ author.user }' === $login ) {
		return true;
	}
	if ( '${ editor.user }' === $login ) {
		return false;
	}
	return $allowed;
}, 10, 3 );
`;
		wpEval(
			`wp_mkdir_p( WPMU_PLUGIN_DIR ); file_put_contents( WPMU_PLUGIN_DIR . '/${ MU_PLUGIN }', base64_decode( '${ Buffer.from( plugin ).toString( 'base64' ) }' ) );`
		);
	} );

	test.afterAll( () => {
		wpEval( `wp_delete_file( WPMU_PLUGIN_DIR . '/${ MU_PLUGIN }' );` );
	} );

	test.describe( 'granting an author', () => {
		test.use( { storageState: storageStateFor( 'author' ) } );

		test( 'LIB-01: opens Library from the menu and creates an entry', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
			playwright,
		} ) => {
			const menu = fotogridsMenu( page );
			await page.goto( '/wp-admin/' );
			await menu.hover();

			const response = await follow( page, () =>
				menu.locator( '.wp-submenu' ).getByRole( 'link', { name: 'Library', exact: true } ).click()
			);
			await expectLibrary( page, response );

			const { context, nonce } = await apiAs( playwright, 'author' );
			const created = await context.post(
				`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/library/tags' ) }`,
				{ headers: { 'X-WP-Nonce': nonce }, data: { name: `LIB-01 ${ Date.now() }` } }
			);
			expect( created.status() ).toBeLessThan( 300 );
			const { id } = ( await created.json() ) as { id: number };

			await context.delete(
				`/?rest_route=${ encodeURIComponent( `/fotogrids/v1/library/tags/${ id }` ) }`,
				{ headers: { 'X-WP-Nonce': nonce } }
			);
			await context.dispose();
		} );
	} );

	test.describe( 'denying an editor', () => {
		test.use( { storageState: storageStateFor( 'editor' ) } );

		test( 'LIB-02: Library is not in the menu and its URL is refused', { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			const links = await submenuLinks( page );
			expect( links ).toContain( 'Galleries' );
			expect( links ).not.toContain( 'Library' );

			const refused = await page.goto( '/wp-admin/admin.php?page=fotogrids-library' );
			expect( refused?.status() ).toBe( 403 );
		} );
	} );
} );

test.describe( 'a contributor given the Library capability', () => {
	test.use( {
		storageState: storageStateFor( 'contributor' ),
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	let roles: string;

	test.beforeAll( () => {
		roles = snapshotRoles();
		wpEval( "get_role( 'contributor' )->add_cap( 'manage_fotogrids_library' );" );
	} );

	test.afterAll( () => {
		restoreRoles( roles );
	} );

	test( 'LIB-03: the menu leads to Library and the Dashboard stays refused', { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		expect( await submenuLinks( page ) ).toEqual( [ 'Library' ] );

		const top = fotogridsMenu( page ).locator( 'a.menu-top' );
		const response = await follow( page, () => top.click() );
		await expectLibrary( page, response );

		const dashboard = await page.goto( '/wp-admin/admin.php?page=fotogrids' );
		expect( dashboard?.status() ).toBe( 403 );
	} );
} );
