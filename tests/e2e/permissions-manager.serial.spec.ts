import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { apiAs, storageStateFor, wpCli } from './support/roles';
import { getOption, restoreRoles, setOption, snapshotRoles } from './support/site';
import { SettingsPage } from './support/settings-page';

/**
 * ROLE-10 to ROLE-12. What the Permissions Manager writes, and what the
 * capability resync grants a role it has never heard of.
 *
 * Serial: role capabilities are site-wide, so each test puts them back.
 */

test.describe.configure( { mode: 'serial' } );

const STATS_KEY = 'fg_view_stats';
const STATS_CAP = 'view_fotogrids_stats';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** Whether a role holds a capability, read from the stored roles. */
function roleHas( role: string, cap: string ): boolean {
	return (
		'yes' ===
		wp( [
			'eval',
			`$r = get_role( '${ role }' ); echo ( $r && ! empty( $r->capabilities['${ cap }'] ) ) ? 'yes' : 'no';`,
		] )
	);
}

let roles: string;

test.beforeEach( () => {
	roles = snapshotRoles();
} );

test.afterEach( () => {
	restoreRoles( roles );
} );

test( 'ROLE-10: the lowest-role write moves the capability down the ladder and back', async ( {
	playwright,
} ) => {
	const { context, nonce } = await apiAs( playwright, 'administrator' );

	const setLowest = async ( lowestRole: string ) => {
		const response = await context.post(
			`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/permissions/simple' ) }`,
			{
				headers: { 'X-WP-Nonce': nonce },
				data: { key: STATS_KEY, lowest_role: lowestRole },
			}
		);

		expect( response.status(), `setting ${ STATS_KEY } to ${ lowestRole }` ).toBe( 200 );
	};

	// The shipped default, which the rest of this test moves away from.
	expect( roleHas( 'editor', STATS_CAP ) ).toBe( true );
	expect( roleHas( 'author', STATS_CAP ) ).toBe( false );

	await setLowest( 'author' );
	expect( roleHas( 'author', STATS_CAP ), 'the author was not granted the cap' ).toBe(
		true
	);
	expect( roleHas( 'editor', STATS_CAP ), 'a role above the floor lost the cap' ).toBe(
		true
	);

	await setLowest( 'editor' );
	expect( roleHas( 'author', STATS_CAP ), 'the author kept the cap' ).toBe( false );
	expect( roleHas( 'editor', STATS_CAP ) ).toBe( true );

	await context.dispose();
} );

test.describe( 'the matrix screen', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	// ROLE-11. No floor describes a grant that skips a role, so the dropdown
	// grows a synthetic option rather than showing one that would be wrong.
	test( 'ROLE-11: a grant that skips a role shows as custom', async ( { page } ) => {
		const settings = new SettingsPage( page );

		// Author holds it, editor does not: no single floor describes that.
		wp( [ 'eval', `get_role( 'author' )->add_cap( '${ STATS_CAP }' );` ] );
		wp( [ 'eval', `get_role( 'editor' )->remove_cap( '${ STATS_CAP }' );` ] );

		await settings.open( 'permissions_manager' );

		const row = page.locator( `#fg-perm-${ STATS_KEY }` );
		await expect( row ).toBeVisible( { timeout: 20000 } );

		await expect(
			row.locator( 'option[value="__custom__"]' ),
			'the row offered no custom option'
		).toHaveCount( 1 );
		expect( await row.inputValue() ).toBe( '__custom__' );

		// A laddered row does not, so the option tracks the grant.
		const laddered = page.locator( '#fg-perm-fg_manage_library' );
		await expect( laddered.locator( 'option[value="__custom__"]' ) ).toHaveCount( 0 );
	} );
} );

test( 'ROLE-12: a role the plugin has never heard of is granted nothing', async () => {
	const CAPS_VERSION = 'fotogrids_caps_version';
	const version = getOption( CAPS_VERSION );

	wp( [ 'role', 'create', 'fg-photographer', 'FG Photographer' ] );

	try {
		// The resync returns early once the version is current; without this the
		// call does nothing and the row passes for the wrong reason.
		setOption( CAPS_VERSION, '0' );

		wp( [ 'eval', '\\FotoGrids\\Activator::maybe_resync_capabilities();' ] );

		expect(
			getOption( CAPS_VERSION ),
			'the resync did not run, so nothing was proven'
		).not.toBe( '0' );

		const granted = wp( [
			'eval',
			`$r = get_role( 'fg-photographer' );
			$caps = $r ? array_keys( array_filter( $r->capabilities ) ) : array();
			echo implode( ',', array_filter( $caps, fn( $c ) => false !== strpos( $c, 'fotogrids' ) ) );`,
		] );

		expect( granted, 'a custom role picked up plugin capabilities' ).toBe( '' );

		// Known roles were granted theirs by the same run.
		expect( roleHas( 'editor', STATS_CAP ) ).toBe( true );
	} finally {
		wp( [ 'role', 'delete', 'fg-photographer' ] );
		setOption( CAPS_VERSION, version );
	}
} );
