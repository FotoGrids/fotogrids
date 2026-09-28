import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';

/**
 * The five roles the suite signs in as, and where global setup leaves their
 * sessions.
 *
 * Signing in through the login form costs about six seconds. Doing it once per
 * role in global setup and reloading the cookies turns a role test into a
 * context load, which is what makes role coverage affordable at all.
 */

export const ROLES = [
	'administrator',
	'editor',
	'author',
	'contributor',
	'subscriber',
] as const;

export type Role = ( typeof ROLES )[ number ];

export type RoleSession = {
	user: string;
	pass: string;
	storageState: string;
	nonce: string;
};

export type RoleFile = {
	roles: Record< Role, RoleSession >;
	guestNonce: string;
};

/** Where global setup writes sessions; alongside the harness's own state. */
export function authDir(): string {
	return path.resolve( 'tests/harness/.state/auth' );
}

export function roleFilePath(): string {
	return path.join( authDir(), 'roles.json' );
}

let cached: RoleFile | null = null;

/**
 * The sessions global setup captured.
 *
 * @throws When global setup has not run, rather than letting a spec fail later
 *         with an unauthenticated request and a confusing status code.
 */
export function roles(): RoleFile {
	if ( cached ) {
		return cached;
	}

	try {
		cached = JSON.parse( readFileSync( roleFilePath(), 'utf8' ) ) as RoleFile;
	} catch ( e ) {
		throw new Error(
			`No role sessions at ${ roleFilePath() }. They are written by tests/e2e/global-setup.ts; run the suite through Playwright rather than invoking a spec directly.`
		);
	}

	return cached;
}

/**
 * Where a role's cookies live.
 *
 * Built from the role name rather than read out of roles.json, so a spec can
 * call it at module scope - `test.use()` runs while the file is being loaded,
 * before anything has had a chance to read a file.
 */
export function storageStateFor( role: Role ): string {
	return path.join( authDir(), `${ role }.json` );
}

/**
 * An API context carrying a role's cookies, plus the REST nonce that goes with
 * them.
 *
 * WordPress authenticates a cookie-based REST request only when it also carries
 * a valid `X-WP-Nonce`; without it the request is treated as anonymous, which
 * reads as a permission bug rather than a missing header.
 */
export async function apiAs(
	playwright: PlaywrightWorkerArgs[ 'playwright' ],
	role: Role
): Promise< { context: APIRequestContext; nonce: string } > {
	const session = roles().roles[ role ];
	const context = await playwright.request.newContext( {
		baseURL: process.env.WP_BASE_URL,
		storageState: storageStateFor( role ),
	} );

	return { context, nonce: session.nonce };
}

/** An API context with no cookies at all. */
export async function apiAnonymous(
	playwright: PlaywrightWorkerArgs[ 'playwright' ]
): Promise< APIRequestContext > {
	return playwright.request.newContext( {
		baseURL: process.env.WP_BASE_URL,
	} );
}

/**
 * How to invoke wp-cli.
 *
 * WP_CLI is a single executable: the shim tests/harness/boot.sh writes, which
 * has the php, the install path and the working directory already pinned. It is
 * exec'd as one path rather than split on spaces, because the path can contain
 * them - LocalWP keeps its sites under `~/Local Sites/`.
 */
export function wpCli(): string {
	const cmd = process.env.WP_CLI;
	if ( ! cmd ) {
		throw new Error(
			'WP_CLI is not set. Boot a site with tests/harness/boot.sh and source tests/harness/.env first.'
		);
	}
	return cmd;
}

/** Run PHP through wp-cli and return stdout. */
export function wpEval( php: string ): string {
	return execFileSync( wpCli(), [ 'eval', php ], { encoding: 'utf8' } );
}
