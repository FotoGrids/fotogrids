import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { request } from '@playwright/test';
import { purgeScoped } from './support/collections';
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
 * Prepares the site once, before any project runs: the fixture sets, and a
 * signed-in session per role.
 */

const PASSWORD = 'fg-role-password';

/**
 * Build the fixture sets. Idempotent.
 *
 * FG_SEED_SETS narrows it to a comma-separated list of set names; a cold runner
 * builds every named set from nothing, and F-huge alone is 40MB.
 */
function seed(): void {
	const script = path.resolve( 'tests/harness/seed.sh' );
	const sets = process.env.FG_SEED_SETS;
	const args = sets ? [ script, `only=${ sets }` ] : [ script ];

	execFileSync( 'bash', args, { encoding: 'utf8', stdio: 'pipe' } );
}

/**
 * Create the four non-administrator roles with a known password. Idempotent:
 * the password is set on every run, not only at creation.
 */
function ensureUsers( adminUser: string ): Record< Role, string > {
	const logins: Record< string, string > = { administrator: adminUser };

	for ( const role of ROLES ) {
		if ( role === 'administrator' ) {
			continue;
		}
		logins[ role ] = `fg-${ role }`;
	}

	// The administrator is left alone; resetting its password would invalidate
	// the credentials passed in.
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
 * The GET before the POST sets the test cookie WordPress requires before it
 * will issue an auth cookie. A freshly installed site can still answer the
 * first attempt with the login page, hence the retry.
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

	// Collections a scoped spec created on an earlier run. Left behind they
	// accumulate, and a spec counting galleries would see them.
	purgeScoped();

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
