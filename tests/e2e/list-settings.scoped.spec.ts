import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { storageStateFor, wpCli } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * List settings (token selects) keep every value from the editor to the page.
 *
 * Scoped: each test saves only a gallery it created.
 */

const DEFAULT_BLOCKS = [
	'Caption',
	'Description',
	'File Info',
	'EXIF Data',
	'Share Buttons',
	'Copyright / Credit',
	'Tags',
	'People',
	'Location',
];

const DEFAULT_BLOCK_IDS =
	'caption description file_info exif share credit tags people location';

function storedMeta( id: number, key: string ): string {
	return execFileSync(
		wpCli(),
		[ 'post', 'meta', 'get', String( id ), `fotogrids_${ key }` ],
		{ encoding: 'utf8' }
	).trim();
}

async function openInfoBlocks( panel: CollectionSettings ): Promise< void > {
	await panel.openTab( 'Lightbox' );
	await panel.openSubtab( 'Advanced' );
	await expect( panel.field( 'lightbox_info_blocks' ) ).toBeVisible();
}

/** The autosave that follows the last edit, once the server has answered it. */
function autosaved( page: Page ): Promise< unknown > {
	return page.waitForResponse(
		( r ) =>
			/admin-ajax\.php/.test( r.url() ) &&
			( r.request().postData() ?? '' ).includes( 'fotogrids_save_collection' ),
		{ timeout: 30_000 }
	);
}

/** Press Publish or Update and wait for WordPress to take the form. */
async function submit( page: Page ): Promise< void > {
	await Promise.all( [
		page.waitForResponse(
			( r ) => 'POST' === r.request().method() && /\/wp-admin\/post\.php/.test( r.url() )
		),
		page.locator( '#publish' ).click(),
	] );
	await page.waitForLoadState( 'load' );
}

test( 'a gallery published from Add New keeps all nine default info blocks', { tag: [ '@critical', '@admin', '@settings', '@lightbox' ] }, async ( {
	page,
}, testInfo ) => {
	testInfo.setTimeout( 60_000 );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	// No title is typed: on Add New that raises the unsaved-changes prompt on Publish.
	await editor.openNew();
	await openInfoBlocks( panel );

	expect( await panel.tokens( 'lightbox_info_blocks' ) ).toEqual( DEFAULT_BLOCKS );

	await Promise.all( [
		page.waitForURL( /\/wp-admin\/post\.php\?post=\d+/, { timeout: 30_000 } ),
		editor.publishButton().click(),
	] );
	const id = Number( new URL( page.url() ).searchParams.get( 'post' ) );
	expect( id, 'the gallery was not saved' ).toBeGreaterThan( 0 );
	adopt( id );

	expect( JSON.parse( storedMeta( id, 'lightbox_info_blocks' ) ) ).toEqual(
		DEFAULT_BLOCK_IDS.split( ' ' )
	);
} );

test( 'an untouched gallery saved from the editor shows the info panel in its Lightbox', { tag: [ '@critical', '@settings', '@lightbox' ] }, async ( {
	page,
}, testInfo ) => {
	testInfo.setTimeout( 60_000 );
	const { id, url } = galleryPage( { layout: 'grid' } );
	const editor = new GalleryEditor( page );

	await editor.open( id );
	await submit( page );

	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );
	await page.goto( url );
	await gallery.waitFor();

	expect( await gallery.attr( 'lb-info-blocks' ) ).toBe( DEFAULT_BLOCK_IDS );

	await lightbox.openFrom( gallery );
	await expect( lightbox.info() ).toBeVisible();
	await expect( lightbox.infoToggle() ).toBeVisible();
} );

test( 'an edited block list keeps its order and leaves removed blocks out', { tag: [ '@settings', '@lightbox' ] }, async ( {
	page,
}, testInfo ) => {
	testInfo.setTimeout( 60_000 );
	const { id, url } = galleryPage( { layout: 'grid' } );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	await editor.open( id );
	await openInfoBlocks( panel );
	await panel.removeToken( 'lightbox_info_blocks', 'Share Buttons' );
	await panel.removeToken( 'lightbox_info_blocks', 'Tags' );
	const saved = autosaved( page );
	await panel.moveTokenBefore( 'lightbox_info_blocks', 'File Info', 'Caption' );

	const edited = await panel.tokens( 'lightbox_info_blocks' );
	expect( edited[ 0 ] ).toBe( 'File Info' );
	expect( edited ).not.toContain( 'Share Buttons' );
	await saved;
	await expect
		.poll( () => storedMeta( id, 'lightbox_info_blocks' ) )
		.toBe( '["file_info","caption","description","exif","credit","people","location"]' );

	await editor.open( id );
	await openInfoBlocks( panel );
	expect( await panel.tokens( 'lightbox_info_blocks' ) ).toEqual( edited );

	const gallery = new GalleryRender( page, id );
	await page.goto( url );
	await gallery.waitFor();
	expect( await gallery.attr( 'lb-info-blocks' ) ).toBe(
		'file_info caption description exif credit people location'
	);
} );

test( 'a cleared block list stays empty and the Lightbox has no info panel', { tag: [ '@settings', '@lightbox' ] }, async ( {
	page,
}, testInfo ) => {
	testInfo.setTimeout( 60_000 );
	const { id, url } = galleryPage( { layout: 'grid' } );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	await editor.open( id );
	await openInfoBlocks( panel );
	const labels = await panel.tokens( 'lightbox_info_blocks' );
	const saved = autosaved( page );
	for ( const label of labels ) {
		await panel.removeToken( 'lightbox_info_blocks', label );
	}
	await saved;
	await expect.poll( () => storedMeta( id, 'lightbox_info_blocks' ) ).toBe( '[]' );

	await editor.open( id );
	await openInfoBlocks( panel );
	expect( await panel.tokens( 'lightbox_info_blocks' ) ).toEqual( [] );

	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );
	await page.goto( url );
	await gallery.waitFor();
	await lightbox.openFrom( gallery );

	await expect( lightbox.info() ).toHaveCount( 0 );
	await expect( lightbox.infoToggle() ).toHaveCount( 0 );
} );

test( 'the other list settings open with their whole default list', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( {
		layout: 'grid',
		display_exif: true,
		filtering_enabled: true,
		lightbox_auto_progress: true,
	} );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	await editor.open( id );

	// EXIF field options load over REST before the tokens render.
	await panel.openTab( 'Exif' );
	await expect.poll( () => panel.tokens( 'exif_fields' ) ).toEqual( [
		'Camera',
		'Lens',
		'Aperture',
		'Shutter Speed',
		'ISO',
		'Focal Length',
	] );

	await panel.openTab( 'Filtering' );
	await expect( panel.field( 'filter_by' ) ).toBeVisible();
	expect( await panel.tokens( 'filter_by' ) ).toEqual( [ 'Tags' ] );

	await panel.openTab( 'Lightbox' );
	await panel.openSubtab( 'Navigation' );
	await expect( panel.field( 'lightbox_auto_progress_pause_on' ) ).toBeVisible();
	expect( await panel.tokens( 'lightbox_auto_progress_pause_on' ) ).toEqual( [
		'Full Image Hover',
	] );
} );
