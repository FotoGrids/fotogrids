#!/usr/bin/env node
/**
 * Checks that every translatable string the built plugin ships is visible to
 * the gettext extractor wordpress.org runs on a release.
 *
 *   npm run build && node tests/ci/check-built-strings.js
 *
 * Runs `wp i18n make-pot` over src/ and over dist/, then fails when:
 * 1. A string from src/ is in a built script but missing from the dist/ .pot.
 *    Strings absent from every built script are dead code and are skipped.
 * 2. A string keeps its translators comment in src/ but loses it in dist/.
 *
 * Needs WP-CLI: `wp` on the PATH, or its command in the WP_CLI variable.
 */

const { execFileSync } = require( 'child_process' );
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );

const ROOT = path.join( __dirname, '..', '..' );
const DIST = path.join( ROOT, 'dist' );
const WP_CLI = ( process.env.WP_CLI || 'wp' ).split( ' ' );

/**
 * Generates a .pot for a directory with the same flags as `npm run i18n:makepot`.
 *
 * @param {string} dir     Directory to scan.
 * @param {string} exclude Comma-separated paths to skip.
 * @return {string} Path to the generated file.
 */
function makePot( dir, exclude ) {
	const out = path.join(
		fs.mkdtempSync( path.join( os.tmpdir(), 'fg-strings-' ) ),
		'strings.pot'
	);
	execFileSync(
		WP_CLI[ 0 ],
		[
			...WP_CLI.slice( 1 ),
			'i18n',
			'make-pot',
			dir,
			out,
			'--slug=fotogrids',
			'--domain=fotogrids',
			`--exclude=${ exclude }`,
			'--skip-audit',
		],
		{ stdio: [ 'ignore', 'ignore', 'inherit' ] }
	);
	return out;
}

/**
 * Decodes one quoted PO string.
 *
 * @param {string} quoted The string including its surrounding quotes.
 * @return {string} The decoded text.
 */
function unquote( quoted ) {
	const map = { n: '\n', t: '\t', r: '\r' };
	return quoted
		.slice( 1, -1 )
		.replace( /\\(.)/g, ( m, c ) => ( c in map ? map[ c ] : c ) );
}

/**
 * Parses a .pot file into entries keyed by context and msgid.
 *
 * @param {string} file Path to the .pot file.
 * @return {Map<string, {msgid: string, refs: string[], translators: boolean}>} Entries.
 */
function parsePot( file ) {
	const entries = new Map();
	for ( const block of fs.readFileSync( file, 'utf8' ).split( /\n\s*\n/ ) ) {
		const fields = {};
		const refs = [];
		let translators = false;
		let current = null;
		for ( const line of block.split( '\n' ) ) {
			if ( line.startsWith( '#.' ) ) {
				translators = translators || /translators:/i.test( line );
			} else if ( line.startsWith( '#:' ) ) {
				refs.push( ...line.slice( 2 ).trim().split( /\s+/ ) );
			} else if ( /^msg\w+(\[\d+\])? "/.test( line ) ) {
				current = line.slice( 0, line.indexOf( ' ' ) );
				fields[ current ] = unquote( line.slice( current.length + 1 ) );
			} else if ( line.startsWith( '"' ) && current ) {
				fields[ current ] += unquote( line );
			}
		}
		if ( fields.msgid ) {
			const key = `${ fields.msgctxt || '' }\u0004${ fields.msgid }`;
			entries.set( key, { msgid: fields.msgid, refs, translators } );
		}
	}
	return entries;
}

/**
 * Reads every built script under a directory.
 *
 * @param {string} dir Directory to walk.
 * @return {string[]} File contents.
 */
function readScripts( dir ) {
	const out = [];
	for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
		const full = path.join( dir, entry.name );
		if ( entry.isDirectory() && entry.name !== 'freemius' ) {
			out.push( ...readScripts( full ) );
		} else if ( entry.isFile() && entry.name.endsWith( '.js' ) ) {
			out.push( fs.readFileSync( full, 'utf8' ) );
		}
	}
	return out;
}

/**
 * Whether a string appears as a literal in any built script.
 *
 * @param {string}   text    The string.
 * @param {string[]} scripts Built script contents.
 * @return {boolean} True when it ships.
 */
function ships( text, scripts ) {
	const double = JSON.stringify( text );
	const single = `'${ text
		.replace( /\\/g, '\\\\' )
		.replace( /'/g, "\\'" )
		.replace( /\n/g, '\\n' ) }'`;
	return scripts.some( ( s ) => s.includes( double ) || s.includes( single ) );
}

if ( ! fs.existsSync( DIST ) ) {
	console.error( 'ERROR: dist/ is missing. Run: npm run build' );
	process.exit( 1 );
}

const source = parsePot(
	makePot( path.join( ROOT, 'src' ), 'freemius,dist,node_modules,tests' )
);
const built = parsePot( makePot( DIST, 'freemius' ) );
const scripts = readScripts( DIST );

const hidden = [];
const uncommented = [];
for ( const [ key, entry ] of source ) {
	const shipped = built.get( key );
	if ( ! shipped ) {
		if ( ships( entry.msgid, scripts ) ) {
			hidden.push( entry );
		}
	} else if ( entry.translators && ! shipped.translators ) {
		uncommented.push( entry );
	}
}

const report = ( title, list ) => {
	console.error( title );
	for ( const entry of list.slice( 0, 40 ) ) {
		console.error( `  ${ entry.refs[ 0 ] }  ${ JSON.stringify( entry.msgid ) }` );
	}
	if ( list.length > 40 ) {
		console.error( `  … and ${ list.length - 40 } more` );
	}
	console.error( '' );
};

if ( hidden.length ) {
	report(
		`ERROR: ${ hidden.length } string(s) ship in a built script where the extractor cannot find them, so they never reach translate.wordpress.org.\n` +
			"In bundled code import gettext functions from '@wordpress/i18n' rather than reading them off wp.i18n, and keep every argument a literal.",
		hidden
	);
}
if ( uncommented.length ) {
	report(
		`ERROR: ${ uncommented.length } string(s) lose their translators comment in the build.`,
		uncommented
	);
}
if ( hidden.length || uncommented.length ) {
	process.exit( 1 );
}

console.log(
	`OK: All ${ built.size } strings in the built plugin are visible to the extractor.`
);
