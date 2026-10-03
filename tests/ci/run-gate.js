#!/usr/bin/env node
/**
 * The gate tier, narrowed to the areas the diff can affect.
 *
 *   node tests/ci/run-gate.js [--since origin/main] [--dry-run]
 *
 * Three invocations: `readonly` whole, then `@critical` in `scoped` and
 * `serial`. A diff routing to `*` runs them unfiltered.
 *
 * `--no-deps` is required, not an optimisation: a grep does not filter a
 * project pulled in as a dependency.
 */

const { execFileSync, spawnSync } = require( 'child_process' );
const path = require( 'path' );
const { EVERYTHING } = require( './impact' );

const ROOT = path.join( __dirname, '..', '..' );

// Never filtered out.
const ALWAYS = '@always';

const argv = process.argv.slice( 2 );
const dryRun = argv.includes( '--dry-run' );
const sinceAt = argv.indexOf( '--since' );
const since = -1 !== sinceAt ? argv[ sinceAt + 1 ] : 'origin/main';

function impactTags() {
	const out = execFileSync(
		'node',
		[ path.join( __dirname, 'impact.js' ), '--since', since ],
		{ cwd: ROOT, encoding: 'utf8' }
	);

	return out.split( '\n' ).filter( Boolean );
}

/** Tests a set of arguments would run. */
function count( args ) {
	const listed = spawnSync( 'npx', [ ...args, '--list' ], {
		cwd: ROOT,
		encoding: 'utf8',
	} );

	const reported = ( listed.stdout ?? '' ).match( /Total: (\d+) test/ );

	return reported ? Number( reported[ 1 ] ) : 0;
}

const tags = impactTags();
const everything = tags.includes( EVERYTHING );
const areas = everything ? null : [ ...tags, ALWAYS ].join( '|' );

/**
 * `readonly` filters on areas alone; the other two need `@critical` as well,
 * as two lookaheads, since Playwright takes one expression.
 */
function grepFor( project ) {
	if ( everything ) {
		return 'readonly' === project ? null : '@critical';
	}

	return 'readonly' === project
		? areas
		: `(?=.*@critical)(?=.*(${ areas }))`;
}

const plan = [ 'readonly', 'scoped', 'serial' ].map( ( project ) => {
	const args = [ 'playwright', 'test', `--project=${ project }` ];

	if ( 'readonly' !== project ) {
		args.push( '--no-deps' );
	}

	const grep = grepFor( project );
	if ( grep ) {
		args.push( '--grep', grep );
	}

	return { project, args, tests: count( args ) };
} );

const total = plan.reduce( ( sum, step ) => sum + step.tests, 0 );

console.log( everything ? 'impact: everything' : `impact: ${ tags.join( ' ' ) }` );
for ( const step of plan ) {
	console.log( `  ${ step.project }: ${ step.tests } test(s)` );
}

// Selecting nothing passes while proving nothing, and widening here would
// hide the broken routing rather than fix it.
if ( 0 === total ) {
	console.error(
		'\nthe routed gate selected no tests. Check tests/e2e/impact-map.json ' +
			'against the area tags in the suite.'
	);
	process.exit( 1 );
}

if ( dryRun ) {
	process.exit( 0 );
}

for ( const step of plan ) {
	if ( 0 === step.tests ) {
		continue;
	}

	const run = spawnSync( 'npx', step.args, { cwd: ROOT, stdio: 'inherit' } );

	if ( 0 !== run.status ) {
		process.exit( run.status ?? 1 );
	}
}
