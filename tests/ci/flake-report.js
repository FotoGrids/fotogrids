#!/usr/bin/env node
/**
 * Summarise a quarantine run: which @flaky tests failed, and how often.
 *
 * Reads Playwright's JSON report, where --repeat-each gives each test several
 * results. A test that passes every repeat is a candidate to untag; one that
 * fails every repeat is broken rather than flaky.
 */

const { readFileSync } = require( 'fs' );

const file = process.argv[ 2 ] || 'playwright-report.json';

let report;
try {
	report = JSON.parse( readFileSync( file, 'utf8' ) );
} catch ( error ) {
	console.log( 'No quarantine report to read: ' + error.message );
	process.exit( 0 );
}

/** Keyed by title: --repeat-each lists each repeat as its own spec. */
const byTitle = new Map();

function record( title, results ) {
	const row = byTitle.get( title ) || { title, runs: 0, failed: 0 };

	row.runs += results.length;
	row.failed += results.filter( ( r ) => 'passed' !== r.status ).length;
	byTitle.set( title, row );
}

function walk( suite, trail ) {
	const here = suite.title ? [ ...trail, suite.title ] : trail;

	for ( const spec of suite.specs ?? [] ) {
		const results = ( spec.tests ?? [] ).flatMap( ( t ) => t.results ?? [] );
		const runs = results.length;

		if ( runs ) {
			record( [ ...here, spec.title ].join( ' › ' ), results );
		}
	}

	for ( const child of suite.suites ?? [] ) {
		walk( child, here );
	}
}

for ( const suite of report.suites ?? [] ) {
	walk( suite, [] );
}

const rows = [ ...byTitle.values() ];

if ( ! rows.length ) {
	console.log( 'Quarantine is empty — nothing is tagged `@flaky`.' );
	process.exit( 0 );
}

rows.sort( ( a, b ) => b.failed / b.runs - a.failed / a.runs );

console.log( '| Failure rate | Test |' );
console.log( '|---|---|' );
for ( const row of rows ) {
	const rate = Math.round( ( row.failed / row.runs ) * 100 );
	console.log( `| ${ rate }% (${ row.failed }/${ row.runs }) | ${ row.title } |` );
}

const clean = rows.filter( ( r ) => 0 === r.failed );
const broken = rows.filter( ( r ) => r.failed === r.runs );

console.log( '' );
console.log( `${ rows.length } quarantined; ${ clean.length } passed every repeat (candidates to untag); ${ broken.length } failed every repeat (broken, not flaky).` );
