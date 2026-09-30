import { execFileSync } from 'child_process';
import { wpCli } from './roles';

/**
 * Site-wide state a spec has to put back.
 *
 * One WordPress serves every worker, so a screen that rewrites roles changes the
 * answer for every later spec. Reading the option is exact, and does not depend
 * on the UI finishing a debounced save.
 */

const ROLES_OPTION = 'wp_user_roles';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** Every role and its capabilities, as stored. */
export function snapshotRoles(): string {
	return wp( [ 'option', 'get', ROLES_OPTION, '--format=json' ] );
}

/** Put the roles back as `snapshotRoles` found them. */
export function restoreRoles( snapshot: string ): void {
	execFileSync( wpCli(), [ 'option', 'update', ROLES_OPTION, '--format=json' ], {
		encoding: 'utf8',
		input: snapshot,
	} );
}

/** A site option's value, or null when the row does not exist. */
export function getOption( name: string ): string | null {
	try {
		// An absent option is an answer, not a failure.
		return execFileSync( wpCli(), [ 'option', 'get', name ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}
}

/** Set a site option, or delete it when `value` is null. */
export function setOption( name: string, value: string | null ): void {
	if ( null === value ) {
		try {
			wp( [ 'option', 'delete', name ] );
		} catch {
			// Already absent.
		}
		return;
	}

	wp( [ 'option', 'update', name, value ] );
}
