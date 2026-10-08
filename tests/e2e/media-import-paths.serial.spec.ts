import { execFileSync } from 'child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'fs';
import path from 'path';
import { test, expect } from './support/test';
import { fixture, firstItem } from './support/fixtures';
import { apiAs, wpCli } from './support/roles';

/**
 * SEC-17 and SEC-18. Neither import route reads or writes outside uploads.
 *
 * A real image is planted where each escape would land, so a refusal means the
 * guard stopped it rather than the file being absent.
 *
 * Serial: these write to the filesystem and import attachments.
 */

test.describe.configure( { mode: 'serial' } );

const wpPath = () => process.env.WP_PATH ?? '';
const uploadsDir = () => path.join( wpPath(), 'wp-content', 'uploads' );

/** Somewhere outside uploads that the web server can still read. */
const outsideDir = () => path.join( wpPath(), 'wp-content', 'fg-outside' );
const OUTSIDE_NAME = 'fg-planted.jpg';
const SYMLINK_NAME = 'fg-escape-link';

/** The name the traversing archive entry tries to land under. */
const SLIP_NAME = 'fg-slipped.jpg';

/** Bytes of a seeded attachment, so the plant is a real image. */
function seededImageBytes(): Buffer {
	const file = execFileSync(
		wpCli(),
		[ 'post', 'meta', 'get', String( firstItem( 'F-small' ) ), '_wp_attached_file' ],
		{ encoding: 'utf8' }
	).trim();

	return readFileSync( path.join( uploadsDir(), file ) );
}

/** How many attachments point at the planted file. */
function attachmentsPointingOutside(): string {
	return execFileSync(
		wpCli(),
		[
			'db',
			'query',
			`SELECT COUNT(*) FROM wp_postmeta WHERE meta_key = '_wp_attached_file' AND meta_value LIKE '%${ OUTSIDE_NAME }%'`,
			'--skip-column-names',
		],
		{ encoding: 'utf8' }
	).trim();
}

test.beforeAll( () => {
	mkdirSync( outsideDir(), { recursive: true } );
	writeFileSync( path.join( outsideDir(), OUTSIDE_NAME ), seededImageBytes() );

	// A symlink out of uploads: only realpath() catches this, not segment stripping.
	const link = path.join( uploadsDir(), SYMLINK_NAME );
	if ( ! existsSync( link ) ) {
		symlinkSync( outsideDir(), link );
	}
} );

/** Remove any attachment these imports registered, whatever the run did. */
function purgeImported(): void {
	for ( const needle of [ OUTSIDE_NAME, SLIP_NAME, 'ordinary' ] ) {
		execFileSync(
			wpCli(),
			[
				'db',
				'query',
				"DELETE p, pm FROM wp_posts p LEFT JOIN wp_postmeta pm ON pm.post_id = p.ID " +
					`WHERE p.post_type = 'attachment' AND p.guid LIKE '%${ needle }%'`,
			],
			{ encoding: 'utf8' }
		);
	}
}

test.beforeAll( purgeImported );

test.afterAll( () => {
	purgeImported();
	rmSync( path.join( uploadsDir(), SYMLINK_NAME ), { force: true } );
	rmSync( outsideDir(), { recursive: true, force: true } );
	rmSync( path.join( wpPath(), 'wp-content', SLIP_NAME ), { force: true } );
} );

test( 'SEC-17: the folder import refuses every path that leaves the uploads folder', { tag: '@api' }, async ( {
	playwright,
} ) => {
	const planted = path.join( outsideDir(), OUTSIDE_NAME );

	expect( existsSync( planted ), 'the planted image is missing' ).toBe( true );

	const escapes = [
		`../fg-outside/${ OUTSIDE_NAME }`,
		`../../wp-content/fg-outside/${ OUTSIDE_NAME }`,
		`....//....//wp-content/fg-outside/${ OUTSIDE_NAME }`,
		planted,
		`${ SYMLINK_NAME }/${ OUTSIDE_NAME }`,
		'../../wp-config.php',
	];

	const { context, nonce } = await apiAs( playwright, 'administrator' );

	const response = await context.post(
		`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/media/import/folder' ) }`,
		{
			headers: { 'X-WP-Nonce': nonce },
			data: {
				gallery_id: fixture< number >( 'F-small', 'gallery' ),
				files: escapes,
			},
		}
	);
	const body = ( await response.json() ) as {
		items?: unknown[];
		skipped?: { path: string }[];
	};
	await context.dispose();

	expect( response.status() ).toBe( 200 );
	expect( body.items ?? [], 'a path outside the uploads folder was imported' ).toEqual( [] );
	expect( body.skipped ?? [], 'the route did not report the refusals' ).toHaveLength(
		escapes.length
	);
	expect( attachmentsPointingOutside(), 'an attachment now points outside uploads' ).toBe( '0' );
} );

test( 'SEC-17: the same request imports a file that is genuinely inside uploads', { tag: '@api' }, async ( {
	playwright,
} ) => {
	const inside = execFileSync(
		wpCli(),
		[ 'post', 'meta', 'get', String( firstItem( 'F-small' ) ), '_wp_attached_file' ],
		{ encoding: 'utf8' }
	).trim();

	const { context, nonce } = await apiAs( playwright, 'administrator' );

	const response = await context.post(
		`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/media/import/folder' ) }`,
		{
			headers: { 'X-WP-Nonce': nonce },
			data: {
				gallery_id: fixture< number >( 'F-small', 'gallery' ),
				files: [ inside ],
			},
		}
	);
	const body = ( await response.json() ) as { items?: unknown[] };
	await context.dispose();

	// Otherwise the refusals above would pass on a route that rejects everything.
	expect( body.items ?? [], 'a path inside uploads was refused too' ).not.toEqual( [] );
} );

test( 'SEC-18: a zip-slip entry is never written outside the extraction folder', { tag: '@api' }, async ( {
	playwright,
} ) => {
	const image = seededImageBytes();
	const archive = path.join( outsideDir(), 'slip.zip' );
	const staged = path.join( outsideDir(), 'stage' );
	const slipTarget = path.join( wpPath(), 'wp-content', SLIP_NAME );

	mkdirSync( staged, { recursive: true } );
	const source = path.join( staged, 'ordinary.jpg' );
	writeFileSync( source, image );

	// One ordinary entry and one climbing out; written directly, as no archiver
	// produces the second name.
	execFileSync( 'python3', [
		'-c',
		'import sys,zipfile\n' +
			'archive, source = sys.argv[1], sys.argv[2]\n' +
			'data = open(source, "rb").read()\n' +
			'z = zipfile.ZipFile(archive, "w")\n' +
			'z.writestr("ordinary.jpg", data)\n' +
			'z.writestr("../../fg-slipped.jpg", data)\n' +
			'z.close()',
		archive,
		source,
	] );

	rmSync( slipTarget, { force: true } );

	const { context, nonce } = await apiAs( playwright, 'administrator' );

	const response = await context.post(
		`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/media/import/zip' ) }`,
		{
			headers: { 'X-WP-Nonce': nonce },
			multipart: {
				gallery_id: String( fixture< number >( 'F-small', 'gallery' ) ),
				file: {
					name: 'slip.zip',
					mimeType: 'application/zip',
					buffer: readFileSync( archive ),
				},
			},
		}
	);
	const body = ( await response.json() ) as { items?: { url?: string }[] };
	await context.dispose();

	expect( response.status() ).toBe( 200 );

	// The ordinary entry imported, so the archive was processed at all.
	const items = body.items ?? [];
	expect( items, 'the archive imported nothing, so nothing was proven' ).not.toEqual( [] );

	// Dropped before extraction: no flattened import, nothing written above dest.
	expect(
		items.filter( ( item ) => ( item.url ?? '' ).includes( 'fg-slipped' ) ),
		'the traversing entry was extracted and imported'
	).toEqual( [] );

	expect(
		existsSync( slipTarget ),
		'the traversing entry was written outside the extraction folder'
	).toBe( false );
} );
