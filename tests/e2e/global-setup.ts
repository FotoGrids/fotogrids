import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { request } from '@playwright/test';
import {
	ROLES,
	authDir,
	roleFilePath,
	wpCli,
	wpEval,
	type Role,
	type RoleFile,
	type RoleSession,
} from './support/roles';

/**
 * Prepares the site once, before any project runs.
 *
 * Two things every spec would otherwise repeat. The fixture sets, so no spec
 * builds its own state; and a signed-in session per role, because reaching
 * wp-admin through the login form costs about six seconds and doing that per
 * test is what makes role coverage look expensive.
 */

const PASSWORD = 'fg-role-password';

/**
 * Run the seeder, so a spec can rely on the sets existing.
 *
 * FG_SEED_SETS narrows it to a comma-separated list. Seeding is idempotent and
 * takes half a second once a site is warm, but a cold CI runner builds every
 * set from nothing - and F-huge alone is 40MB and twenty seconds. CI therefore
 * names the sets the suite actually reads; a spec asking for one that was not
 * seeded fails with a message listing what was.
 */
function seed(): void {
	const script = path.resolve( 'tests/harness/seed.sh' );
	const sets = process.env.FG_SEED_SETS;
	const args = sets ? [ script, `only=${ sets }` ] : [ script ];

	execFileSync( 'bash', args, { encoding: 'utf8', stdio: 'pipe' } );
}

/**
 * Create the four non-administrator roles, and give all five a known password.
 *
 * Idempotent: the password is set every time rather than only on creation, so a
 * site where someone changed it by hand still yields a working session.
 */
function ensureUsers( adminUser: string ): Record< Role, string > {
	const logins: Record< string, string > = { administrator: adminUser };

	for ( const role of ROLES ) {
		if ( role === 'administrator' ) {
			continue;
		}
		logins[ role ] = `fg-${ role }`;
	}

	// The administrator is left alone: boot.sh already set its password, and
	// resetting it here would invalidate the credentials this function was
	// handed.
	const php = Object.entries( logins )
		.filter( ( [ role ] ) => role !== 'administrator' )
		.map(
			( [ role, login ] ) => `
$user = username_exists( '${ login }' );
if ( ! $user ) {
	$user = wp_insert_user( array(
		'user_login' => '${ login }',
		'user_pass'  => '${ PASSWORD }',
		'user_email' => '${ login }@example.com',
		'role'       => '${ role }',
	) );
}
if ( ! is_wp_error( $user ) ) {
	wp_set_password( '${ PASSWORD }', $user );
	$u = new WP_User( $user );
	$u->set_role( '${ role }' );
}`
		)
		.join( "\n" );

	wpEval( php );

	return logins as Record< Role, string >;
}

/**
 * Sign in through the login form and keep the cookies.
 *
 * WordPress issues the auth cookie only once the test cookie has landed, so the
 * GET before the POST is load-bearing rather than tidiness - and on a site
 * still warming up the first attempt can come back with the login page anyway,
 * which is why this retries rather than failing the whole run.
 */
async function captureSession(
	baseURL: string,
	role: Role,
	user: string,
	pass: string,
	attempts = 3
): Promise< RoleSession > {
	let last = '';

	for ( let attempt = 1; attempt <= attempts; attempt++ ) {
		const context = await request.newContext( { baseURL } );

		await context.get( '/wp-login.php' );
		await context.post( '/wp-login.php', {
			form: {
				log: user,
				pwd: pass,
				'wp-submit': 'Log In',
				redirect_to: '/wp-admin/',
				testcookie: '1',
			},
			maxRedirects: 0,
		} );

		const nonce = (
			await (
				await context.get( '/wp-admin/admin-ajax.php?action=rest-nonce' )
			).text()
		).trim();

		if ( /^[0-9a-f]{10}$/.test( nonce ) ) {
			const storageState = path.join( authDir(), `${ role }.json` );
			await context.storageState( { path: storageState } );
			await context.dispose();
			return { user, pass, storageState, nonce };
		}

		last = nonce;
		await context.dispose();
	}

	throw new Error(
		`Could not sign in as ${ role } (${ user }) in ${ attempts } attempts: admin-ajax answered "${ last
			.replace( /\s+/g, ' ' )
			.slice( 0, 80 ) }" instead of a REST nonce.`
	);
}

async function globalSetup(): Promise< void > {
	const baseURL = process.env.WP_BASE_URL;
	if ( ! baseURL ) {
		throw new Error(
			'WP_BASE_URL is not set. Boot a site with tests/harness/boot.sh and source tests/harness/.env first.'
		);
	}

	wpCli();
	seed();

	mkdirSync( authDir(), { recursive: true } );

	const adminUser = process.env.WP_ADMIN_USER ?? 'admin';
	const adminPass = process.env.WP_ADMIN_PASS ?? 'password';
	const logins = ensureUsers( adminUser );

	const roles: Partial< Record< Role, RoleSession > > = {};
	for ( const role of ROLES ) {
		roles[ role ] = await captureSession(
			baseURL,
			role,
			logins[ role ],
			role === 'administrator' ? adminPass : PASSWORD
		);
	}

	// A nonce minted for user 0, which a signed-out visitor would carry. The
	// template-preview route has to refuse it even so.
	const guestNonce = wpEval(
		"wp_set_current_user( 0 ); echo wp_create_nonce( 'wp_rest' );"
	).trim();

	const file: RoleFile = {
		roles: roles as Record< Role, RoleSession >,
		guestNonce,
	};

	writeFileSync( roleFilePath(), JSON.stringify( file, null, '\t' ) );
}

export default globalSetup;
