import { execFileSync } from 'child_process';
import { wpCli } from './roles';

/**
 * Site-wide state a spec has to put back.
 *
 * One WordPress serves every worker, so a spec that drives a screen which
 * rewrites roles changes the answer for every spec that runs after it. Reading
 * the option back is exact and does not depend on the UI having finished a
 * debounced save.
 */

const ROLES_OPTION = 'wp_user_roles';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** Every role and its capabilities, as stored. */
export function snapshotRoles(): string {
	return wp( [ 'option', 'get', ROLES_OPTION, '--format=json' ] );
}

/** Put the roles back exactly as `snapshotRoles` found them. */
export function restoreRoles( snapshot: string ): void {
	execFileSync( wpCli(), [ 'option', 'update', ROLES_OPTION, '--format=json' ], {
		encoding: 'utf8',
		input: snapshot,
	} );
}
