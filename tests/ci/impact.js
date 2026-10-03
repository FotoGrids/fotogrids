#!/usr/bin/env node
/**
 * Which area tags a diff can affect.
 *
 *   node tests/ci/impact.js <file> [...]     tags for those paths
 *   node tests/ci/impact.js --since origin/main
 *
 * Prints one tag per line, or `*` for the whole tier.
 */

const { execFileSync } = require( 'child_process' );
const fs = require( 'fs' );
const path = require( 'path' );

const MAP = path.join( __dirname, '..', 'e2e', 'impact-map.json' );
const EVERYTHING = '*';

/** A glob with `**` and `*`, anchored at both ends. */
function toRegExp( glob ) {
	const source = glob
		.split( '**' )
		.map( ( part ) =>
			part
				.replace( /[.+^${}()|[\]\\]/g, '\\$&' )
				.replace( /\*/g, '[^/]*' )
		)
		.join( '.*' );

	return new RegExp( `^${ source }$` );
}

function loadMap() {
	const { paths } = JSON.parse( fs.readFileSync( MAP, 'utf8' ) );

	return Object.entries( paths ).map( ( [ glob, tag ] ) => ( {
		glob,
		tag,
		re: toRegExp( glob ),
	} ) );
}

/** Every tag a changed path can affect, or `*` when it is unmapped. */
function tagsFor( file, rules ) {
	const hit = rules.filter( ( rule ) => rule.re.test( file ) );

	if ( 0 === hit.length ) {
		return [ EVERYTHING ];
	}

	return hit.map( ( rule ) => rule.tag );
}

/** The changed paths, or null when the base cannot be resolved. */
function changedFiles( since ) {
	let merge;

	try {
		merge = execFileSync( 'git', [ 'merge-base', 'HEAD', since ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}

	return execFileSync( 'git', [ 'diff', '--name-only', merge, 'HEAD' ], {
		encoding: 'utf8',
	} )
		.split( '\n' )
		.filter( Boolean );
}

function main( argv ) {
	const rules = loadMap();
	const files =
		'--since' === argv[ 0 ] ? changedFiles( argv[ 1 ] ) : argv;

	// No diff, or no base: widen.
	if ( null === files || 0 === files.length ) {
		process.stdout.write( `${ EVERYTHING }\n` );
		return;
	}

	const tags = new Set();
	for ( const file of files ) {
		for ( const tag of tagsFor( file, rules ) ) {
			tags.add( tag );
		}
	}

	if ( tags.has( EVERYTHING ) ) {
		process.stdout.write( `${ EVERYTHING }\n` );
		return;
	}

	process.stdout.write( `${ [ ...tags ].sort().join( '\n' ) }\n` );
}

if ( require.main === module ) {
	main( process.argv.slice( 2 ) );
}

module.exports = { EVERYTHING, loadMap, tagsFor, toRegExp };
