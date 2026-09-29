import { statSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { test as base, expect } from '@playwright/test';

/**
 * The `test` every spec imports, instead of `@playwright/test`.
 *
 * Two guards run around every test and fail it on output no assertion looks
 * at: browser console errors, and PHP notices in the site's debug log. A spec
 * that expects either opts out by naming a reason.
 *
 *     test.use( { allowConsoleErrors: 'asserts the 401 path' } );
 *
 * One site serves every worker, so the log is shared and a notice is attributed
 * to whichever test was running. That only matters once a notice exists, which
 * is the thing this is here to prevent.
 */

export type GuardOptions = {
	/** Reason this spec's page is allowed to log errors. */
	allowConsoleErrors: string | false;
	/** Reason this spec is allowed to produce PHP notices. */
	allowPhpNotices: string | false;
};

type Guards = {
	/** Auto fixture; nothing reads it, it exists to bracket the test. */
	phpLog: void;
};

/** Where WordPress writes its log, when the harness enabled one. */
function debugLog(): string | null {
	const wpPath = process.env.WP_PATH;
	if ( ! wpPath ) {
		return null;
	}

	const file = path.join( wpPath, 'wp-content', 'debug.log' );
	return existsSync( file ) ? file : null;
}

function logSize( file: string | null ): number {
	if ( ! file ) {
		return 0;
	}

	try {
		return statSync( file ).size;
	} catch {
		return 0;
	}
}

/** Whatever the log gained while a test ran. */
function logSince( file: string | null, from: number ): string[] {
	if ( ! file ) {
		return [];
	}

	const added = readFileSync( file, 'utf8' ).slice( from );

	return added
		.split( '\n' )
		.filter( ( line ) => /PHP (Notice|Warning|Fatal error|Deprecated)/.test( line ) );
}

export const test = base.extend< GuardOptions & Guards >( {
	allowConsoleErrors: [ false, { option: true } ],
	allowPhpNotices: [ false, { option: true } ],

	page: async ( { page, allowConsoleErrors }, use, testInfo ) => {
		const errors: string[] = [];

		page.on( 'console', ( message ) => {
			if ( 'error' === message.type() ) {
				errors.push( `console.error: ${ message.text() }` );
			}
		} );
		page.on( 'pageerror', ( error ) => {
			errors.push( `pageerror: ${ error.message }` );
		} );

		await use( page );

		if ( allowConsoleErrors || 'passed' !== testInfo.status ) {
			return;
		}

		expect(
			errors,
			`The page logged ${ errors.length } error(s). Fix them, or set allowConsoleErrors with a reason.\n${ errors.join(
				'\n'
			) }`
		).toEqual( [] );
	},

	phpLog: [
		async ( { allowPhpNotices }, use, testInfo ) => {
			const file = debugLog();
			const before = logSize( file );

			await use( undefined );

			if ( allowPhpNotices || 'passed' !== testInfo.status ) {
				return;
			}

			const lines = logSince( file, before );

			expect(
				lines,
				`WordPress logged ${ lines.length } PHP notice(s). Fix them, or set allowPhpNotices with a reason.\n${ lines.join(
					'\n'
				) }`
			).toEqual( [] );
		},
		{ auto: true },
	],
} );

export { expect };
