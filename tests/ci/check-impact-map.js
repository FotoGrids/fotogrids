#!/usr/bin/env node
/**
 * Checks that the impact map still routes to tests, since a run that selects
 * nothing passes.
 *
 *   node tests/ci/check-impact-map.js
 *
 * 1. Every test carries an area tag.
 * 2. Every tag the map routes to is carried by a test. An area with no tests
 *    yet maps to `*` until it has one.
 * 3. Every mapped glob still matches a tracked file.
 */

const { execFileSync } = require( 'child_process' );
const path = require( 'path' );
const { EVERYTHING, loadMap } = require( './impact' );

const ROOT = path.join( __dirname, '..', '..' );
const PROJECTS = [ 'readonly', 'scoped', 'serial' ];

const AREA_TAGS = [
	'@always',
	'@admin',
	'@api',
	'@cache',
	'@gate',
	'@layout',
	'@lightbox',
	'@lifecycle',
	'@permissions',
	'@settings',
	'@visual',
];

/**
 * How many tests a grep selects.
 *
 * Per project and with --no-deps, or the dependency projects come back
 * unfiltered and every count is the same.
 */
function selected( grep ) {
	let total = 0;

	for ( const project of PROJECTS ) {
		const args = [
			'playwright',
			'test',
			'--list',
			`--project=${ project }`,
			'--no-deps',
		];

		if ( grep ) {
			args.push( '--grep', grep );
		}

		let out;
		try {
			out = execFileSync( 'npx', args, {
				cwd: ROOT,
				encoding: 'utf8',
				stdio: [ 'ignore', 'pipe', 'ignore' ],
			} );
		} catch ( error ) {
			// Playwright exits non-zero on an empty selection; here that is
			// an answer, not a failure.
			out = error.stdout ?? '';
		}

		const reported = out.match( /Total: (\d+) test/ );
		total += reported ? Number( reported[ 1 ] ) : 0;
	}

	return total;
}

function tracked( glob ) {
	const out = execFileSync(
		'git',
		[ 'ls-files', '--', glob.replace( /\*\*$/, '' ) ],
		{ cwd: ROOT, encoding: 'utf8' }
	);

	return out.split( '\n' ).filter( Boolean ).length;
}

const failures = [];

const all = selected( null );
const tagged = selected( AREA_TAGS.join( '|' ) );

if ( all !== tagged ) {
	failures.push(
		`${ all - tagged } test(s) carry no area tag, so no diff routes to them. ` +
			`Add one of: ${ AREA_TAGS.join( ', ' ) }`
	);
}

for ( const tag of AREA_TAGS ) {
	if ( 0 === selected( tag ) ) {
		failures.push( `${ tag } is in the vocabulary but no test carries it` );
	}
}

const routed = new Set(
	loadMap()
		.flatMap( ( rule ) => rule.tags )
		.filter( ( tag ) => EVERYTHING !== tag )
);

for ( const tag of routed ) {
	if ( ! AREA_TAGS.includes( tag ) ) {
		failures.push( `the map routes to ${ tag }, which is not an area tag` );
		continue;
	}

	if ( 0 === selected( tag ) ) {
		failures.push(
			`the map routes to ${ tag }, which no test carries — map those paths to "*" until one does`
		);
	}
}

for ( const rule of loadMap() ) {
	if ( 0 === tracked( rule.glob ) ) {
		failures.push( `the map routes ${ rule.glob }, which matches no tracked file` );
	}
}

if ( failures.length ) {
	console.error( 'impact map is unsound:\n' );
	for ( const line of failures ) {
		console.error( `  - ${ line }` );
	}
	process.exit( 1 );
}

console.log( `impact map is sound: ${ all } tests, all carrying an area tag` );
