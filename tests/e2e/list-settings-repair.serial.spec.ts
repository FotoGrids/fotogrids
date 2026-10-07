import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { GalleryRender } from './support/gallery-render';
import { SettingsPage } from './support/settings-page';
import { getOption, setOption } from './support/site';
import { storageStateFor, wpCli } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * List settings stored as a single value are repaired, and saved defaults
 * reach new galleries whole.
 *
 * Serial: the repair rewrites every collection and the defaults option.
 */

const DEFAULT_BLOCK_IDS =
	'caption description file_info exif share credit tags people location';

const DEFAULTS_OPTION = 'fotogrids_gallery_defaults';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** Write post meta as-is, bypassing the settings codec. */
function writeRawMeta( id: number, key: string, value: string ): void {
	wp( [ 'post', 'meta', 'update', String( id ), `fotogrids_${ key }`, value ] );
}

/** The defaults option as JSON, or null when it does not exist. */
function snapshotDefaults(): string | null {
	return null === getOption( DEFAULTS_OPTION )
		? null
		: wp( [ 'option', 'get', DEFAULTS_OPTION, '--format=json' ] );
}

function restoreDefaults( snapshot: string | null ): void {
	if ( null === snapshot ) {
		setOption( DEFAULTS_OPTION, null );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', DEFAULTS_OPTION, '--format=json' ], {
		encoding: 'utf8',
		input: snapshot,
	} );
}

function storedMeta( id: number, key: string ): string {
	return wp( [ 'post', 'meta', 'get', String( id ), `fotogrids_${ key }` ] );
}

/** Ask for the schema upgrade, as an update to this version does. */
async function runUpgrade( page: import( '@playwright/test' ).Page ): Promise< void > {
	setOption( 'fotogrids_db_version', '1.5' );
	await page.goto( '/' );
	expect( getOption( 'fotogrids_db_version' ) ).toBe( '1.6' );
}

test( 'the upgrade restores a list setting stored as one value and keeps saved lists', { tag: [ '@critical', '@settings', '@lifecycle' ] }, async ( {
	page,
} ) => {
	const collapsed = galleryPage( { layout: 'grid' } );
	writeRawMeta( collapsed.id, 'lightbox_info_blocks', 'caption' );
	writeRawMeta( collapsed.id, 'exif_fields', 'camera' );

	const edited = galleryPage( { lightbox_info_blocks: [ 'exif', 'caption' ] } );
	const emptied = galleryPage( { lightbox_info_blocks: [] } );

	await runUpgrade( page );

	expect( JSON.parse( storedMeta( collapsed.id, 'lightbox_info_blocks' ) ).join( ' ' ) ).toBe(
		DEFAULT_BLOCK_IDS
	);
	expect( JSON.parse( storedMeta( collapsed.id, 'exif_fields' ) ) ).toHaveLength( 6 );
	expect( storedMeta( edited.id, 'lightbox_info_blocks' ) ).toBe( '["exif","caption"]' );
	expect( storedMeta( emptied.id, 'lightbox_info_blocks' ) ).toBe( '[]' );

	const gallery = new GalleryRender( page, collapsed.id );
	await page.goto( collapsed.url );
	await gallery.waitFor();
	expect( await gallery.attr( 'lb-info-blocks' ) ).toBe( DEFAULT_BLOCK_IDS );
} );

test( 'saved defaults held as JSON text become lists on upgrade and reach a new gallery', { tag: [ '@settings', '@lifecycle' ] }, async ( {
	page,
} ) => {
	const before = snapshotDefaults();

	try {
		wp( [
			'option',
			'update',
			DEFAULTS_OPTION,
			'{"lightbox_info_blocks":"[\\"exif\\",\\"caption\\"]"}',
			'--format=json',
		] );

		await runUpgrade( page );

		const editor = new GalleryEditor( page );
		const panel = new CollectionSettings( page );
		await editor.openNew();
		await panel.openTab( 'Lightbox' );
		await panel.openSubtab( 'Advanced' );

		expect( await panel.tokens( 'lightbox_info_blocks' ) ).toEqual( [ 'EXIF Data', 'Caption' ] );
	} finally {
		restoreDefaults( before );
	}
} );

test( 'a block list saved on the Defaults page reaches a new gallery in order', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	const before = snapshotDefaults();
	const settings = new SettingsPage( page );
	const panel = new CollectionSettings( page );

	try {
		await settings.open( 'defaults' );
		await panel.openTab( 'Lightbox' );
		await panel.openSubtab( 'Advanced' );

		expect( await panel.tokens( 'lightbox_info_blocks' ) ).toHaveLength( 9 );

		for ( const label of await panel.tokens( 'lightbox_info_blocks' ) ) {
			if ( ! [ 'Caption', 'Location' ].includes( label ) ) {
				await panel.removeToken( 'lightbox_info_blocks', label );
			}
		}
		await panel.moveTokenBefore( 'lightbox_info_blocks', 'Location', 'Caption' );
		expect( await panel.tokens( 'lightbox_info_blocks' ) ).toEqual( [ 'Location', 'Caption' ] );

		const write = settings.write( '/fotogrids/v1/admin/gallery-defaults' );
		await settings.saveButton( /save defaults/i ).click();
		await write;

		const editor = new GalleryEditor( page );
		await editor.openNew();
		await panel.openTab( 'Lightbox' );
		await panel.openSubtab( 'Advanced' );

		expect( await panel.tokens( 'lightbox_info_blocks' ) ).toEqual( [ 'Location', 'Caption' ] );
	} finally {
		restoreDefaults( before );
	}
} );

test( 'an import of defaults exported before this version stores their lists as arrays', { tag: [ '@settings', '@api' ] }, async ( {
	page,
} ) => {
	const before = snapshotDefaults();

	try {
		await page.goto( '/wp-admin/admin.php?page=fotogrids-tools' );

		const file = JSON.stringify( {
			meta: { version: '1.1.4' },
			settings: {
				gallery_defaults: { lightbox_info_blocks: '["exif","caption"]' },
			},
		} );
		const result = await page.evaluate( async ( body ) =>
			window.wp.apiFetch( {
				path: '/fotogrids/v1/admin/tools/import-export/import',
				method: 'POST',
				data: { phase: 'execute', file: body, include: [ 'settings' ] },
			} ),
			file
		);
		expect( result.imported.settings ).toBe( true );

		expect( JSON.parse( snapshotDefaults() ?? '{}' ) ).toEqual( {
			lightbox_info_blocks: [ 'exif', 'caption' ],
		} );
	} finally {
		restoreDefaults( before );
	}
} );
