import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { wpCli } from './support/roles';
import { restoreRoles, snapshotRoles } from './support/site';

/**
 * ROLE-13. Which tools a role is offered.
 *
 * The registry falls back to `manage_fotogrids` for any tool whose own capability
 * the user lacks, so a per-tool capability can only be tested against a role
 * without it.
 *
 * Serial: roles and users are site-wide, and both are put back.
 */

test.describe.configure( { mode: 'serial' } );

const ROLE = 'fg-thumbnailer';
const USER = 'fg-thumbnailer-user';
const TOOL = 'regenerate-thumbnails';
const TOOL_CAP = 'fotogrids_regenerate_thumbnails';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** The tool ids offered to a login. */
function toolsFor( login: string ): string[] {
	const ids = wp( [
		'eval',
		`wp_set_current_user( get_user_by( 'login', '${ login }' )->ID );
		echo implode( ',', array_keys( \\FotoGrids\\Tools\\Tools_Registry::get_all_for_user() ) );`,
	] );

	return '' === ids ? [] : ids.split( ',' );
}

let roles: string;

test.beforeAll( () => {
	roles = snapshotRoles();

	wp( [ 'role', 'create', ROLE, 'FG Thumbnailer' ] );
	wp( [ 'eval', `get_role( '${ ROLE }' )->add_cap( 'read' );` ] );
	wp( [ 'eval', `get_role( '${ ROLE }' )->add_cap( '${ TOOL_CAP }' );` ] );
	wp( [
		'user',
		'create',
		USER,
		`${ USER }@example.test`,
		`--role=${ ROLE }`,
		'--user_pass=thumbnails',
	] );
} );

test.afterAll( () => {
	wp( [ 'user', 'delete', USER, '--yes' ] );
	wp( [ 'role', 'delete', ROLE ] );
	restoreRoles( roles );
} );

test( 'ROLE-13: a role with one tool capability is offered exactly that tool', { tag: '@permissions' }, () => {
	const offered = toolsFor( USER );

	expect( offered, 'the role was offered a tool it holds no capability for' ).toEqual( [
		TOOL,
	] );
} );

test( 'ROLE-13: the registry holds more tools than that, so the filter did the work', { tag: '@permissions' }, () => {
	const all = wp( [
		'eval',
		"echo implode( ',', array_keys( \\FotoGrids\\Tools\\Tools_Registry::get_all() ) );",
	] ).split( ',' );

	expect( all.length, 'there is only one tool, so filtering proves nothing' ).toBeGreaterThan(
		1
	);
	expect( all ).toContain( TOOL );
} );

// With the capability granted nowhere, the fallback is the only thing that
// could be offering the tool.
test( 'ROLE-13: manage_fotogrids still offers a tool nobody has been granted', { tag: '@permissions' }, () => {
	const admin = process.env.WP_ADMIN_USER ?? 'admin';

	wp( [
		'eval',
		`foreach ( wp_roles()->get_names() as $name => $label ) {
			$role = get_role( $name );
			if ( $role ) { $role->remove_cap( '${ TOOL_CAP }' ); }
		}`,
	] );

	expect(
		wp( [
			'eval',
			`echo user_can( get_user_by( 'login', '${ admin }' ), '${ TOOL_CAP }' ) ? 'yes' : 'no';`,
		] ),
		'the capability is still granted somewhere, so the fallback is untested'
	).toBe( 'no' );

	expect( toolsFor( admin ), 'the fallback did not offer the tool' ).toContain( TOOL );
} );
