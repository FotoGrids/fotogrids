import { readFileSync } from 'fs';
import path from 'path';

/**
 * The data sets `tests/harness/seed.sh` built, by key.
 *
 * Specs read these rather than building their own state. A spec that creates
 * what it needs pays for it on every run and, worse, makes the result depend on
 * what else is running: a gallery created mid-run is visible to any other spec
 * counting galleries.
 */

export type SeededFixtures = Record< string, Record< string, unknown > >;

let cached: SeededFixtures | null = null;

export function fixturesPath(): string {
	return path.resolve( 'tests/harness/.state/fixtures.json' );
}

export function fixtures(): SeededFixtures {
	if ( cached ) {
		return cached;
	}

	try {
		cached = JSON.parse(
			readFileSync( fixturesPath(), 'utf8' )
		) as SeededFixtures;
	} catch ( e ) {
		throw new Error(
			`No seeded fixtures at ${ fixturesPath() }. They are built by tests/harness/seed.sh, which global setup runs.`
		);
	}

	return cached;
}

/**
 * One value out of a fixture set, checked.
 *
 * A missing key means the set was renamed or the seeder changed; saying so here
 * beats a spec asserting against `undefined` several lines later.
 */
export function fixture< T = number >( set: string, key: string ): T {
	const group = fixtures()[ set ];
	if ( ! group ) {
		throw new Error(
			`Fixture set "${ set }" was not seeded. Known sets: ${ Object.keys(
				fixtures()
			).join( ', ' ) }`
		);
	}

	const value = group[ key ];
	if ( value === undefined ) {
		throw new Error(
			`Fixture set "${ set }" has no "${ key }". It holds: ${ Object.keys(
				group
			).join( ', ' ) }`
		);
	}

	return value as T;
}

/** The first item id of a set, for the common "any item from here" case. */
export function firstItem( set: string, key = 'items' ): number {
	const items = fixture< number[] >( set, key );
	if ( ! Array.isArray( items ) || items.length === 0 ) {
		throw new Error( `Fixture set "${ set }" has no items under "${ key }"` );
	}
	return items[ 0 ];
}
