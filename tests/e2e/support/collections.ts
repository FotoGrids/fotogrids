import { execFileSync } from 'child_process';
import path from 'path';
import { wpCli } from './roles';
import { fixture } from './fixtures';

/**
 * Throwaway collections, for a spec that needs to write.
 *
 * Seeded fixtures are shared, so changing one changes the answer for every spec
 * reading it. These build a collection the spec owns, as `scoped` requires.
 */

export type Settings = Record< string, unknown >;

function collection( args: string[] ): string {
	const script = path.resolve( 'tests/harness/collection.php' );
	return execFileSync( wpCli(), [ 'eval-file', script, ...args ], {
		encoding: 'utf8',
	} ).trim();
}

/**
 * A gallery, and a post that renders it through the shortcode.
 *
 * Items default to a seeded set, so this uploads nothing.
 *
 * @param settings Catalog key to value; validated against the catalog.
 * @param items    Attachment ids. Defaults to F-small's five.
 * @param title    Gallery title.
 * @param author   Login of the user who should own it.
 * @param status   Post status; defaults to publish.
 */
export function galleryPage(
	settings: Settings = {},
	items?: number[],
	title?: string,
	author?: string,
	status?: string
): { id: number; url: string } {
	const ids = items ?? fixture< number[] >( 'F-small', 'items' );

	// One invocation: each `wp eval-file` bootstraps WordPress.
	return JSON.parse(
		collection( [
			'op=render',
			`items=${ ids.join( ',' ) }`,
			`settings=${ JSON.stringify( settings ) }`,
			...( undefined === title ? [] : [ `title=${ title }` ] ),
			...( undefined === author ? [] : [ `author=${ author }` ] ),
			...( undefined === status ? [] : [ `status=${ status }` ] ),
		] )
	);
}

/**
 * An album holding galleries this spec created.
 *
 * @param galleries Gallery ids, in album order.
 * @param settings  Catalog key to value.
 * @param title     Album title.
 * @param author    Login of the user who should own it.
 * @param status    Post status; defaults to publish.
 */
export function album(
	galleries: number[],
	settings: Settings = {},
	title?: string,
	author?: string,
	status?: string
): { id: number } {
	return JSON.parse(
		collection( [
			'op=album',
			`galleries=${ galleries.join( ',' ) }`,
			`settings=${ JSON.stringify( settings ) }`,
			...( undefined === title ? [] : [ `title=${ title }` ] ),
			...( undefined === author ? [] : [ `author=${ author }` ] ),
			...( undefined === status ? [] : [ `status=${ status }` ] ),
		] )
	);
}

/** Mark a collection made through the UI so the purge removes it too. */
export function adopt( id: number ): void {
	collection( [ 'op=adopt', `id=${ id }` ] );
}

/** A page rendering a gallery the spec did not create. */
export function pageFor( galleryId: number ): { id: number; url: string } {
	return JSON.parse( collection( [ 'op=page', `gallery=${ galleryId }` ] ) );
}

/**
 * A page embedding a collection through its shortcode with extra attributes.
 *
 * @param id   Gallery or album id.
 * @param atts Attributes appended to the shortcode verbatim, e.g. `cols="2"`.
 * @param kind Which shortcode to write.
 */
export function shortcodePage(
	id: number,
	atts: string,
	kind: 'gallery' | 'album' = 'gallery'
): { id: number; url: string } {
	return JSON.parse(
		collection( [ 'op=page', `${ kind }=${ id }`, `atts=${ atts }` ] )
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
