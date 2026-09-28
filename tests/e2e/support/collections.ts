import { execFileSync } from 'child_process';
import path from 'path';
import { wpCli } from './roles';
import { fixture } from './fixtures';

/**
 * Throwaway collections, for a spec that needs to write.
 *
 * A seeded fixture is shared, so a spec that changes one changes the answer for
 * every other spec reading it. These build a collection the spec owns, which is
 * what the `scoped` project's contract allows.
 */

export type Settings = Record< string, unknown >;

function collection( args: string[] ): string {
	const script = path.resolve( 'tests/harness/collection.php' );
	return execFileSync( wpCli(), [ 'eval-file', script, ...args ], {
		encoding: 'utf8',
	} ).trim();
}

/**
 * A published gallery, and a post that renders it through the shortcode.
 *
 * Items default to a seeded set, so this uploads nothing: attachments are read
 * by every spec and written by none.
 *
 * @param settings Catalog key to value; validated against the catalog.
 * @param items    Attachment ids. Defaults to F-small's five.
 */
export function galleryPage(
	settings: Settings = {},
	items?: number[]
): { id: number; url: string } {
	const ids = items ?? fixture< number[] >( 'F-small', 'items' );

	// One invocation, not two: every `wp eval-file` bootstraps WordPress, which
	// costs more than the work it is asked to do.
	return JSON.parse(
		collection( [
			'op=render',
			`items=${ ids.join( ',' ) }`,
			`settings=${ JSON.stringify( settings ) }`,
		] )
	);
}

/** Change settings on a collection this spec created, and drop its cache. */
export function setSettings( id: number, settings: Settings ): void {
	collection( [ 'op=settings', `id=${ id }`, `settings=${ JSON.stringify( settings ) }` ] );
}

/** Delete every collection and page these helpers created. */
export function purgeScoped(): number {
	return Number( collection( [ 'op=purge' ] ) );
}
