import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { CollectionSettings } from './support/collection-settings';
import { SettingsPage } from './support/settings-page';
import { getOption, setOption } from './support/site';
import { storageStateFor, wpCli } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Gallery Defaults and Album Defaults are saved, shown and applied apart, and
 * a change is never lost by moving to another subtab or tab.
 *
 * Serial: every test rewrites the site's defaults and the Autosave option.
 */

test.describe.configure( { mode: 'serial' } );

const OPTION = 'fotogrids_collection_defaults';

function wp( args: string[], input?: string ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8', input } ).trim();
}

type Stored = Record< 'gallery' | 'album', Record< string, unknown > >;

function stored(): Stored {
	return JSON.parse(
		wp( [ 'eval', 'echo wp_json_encode( \\FotoGrids\\Settings\\Collection_Defaults_Store::all() );' ] )
	);
}

function seed( gallery: object, album: object ): void {
	wp( [ 'option', 'update', OPTION, '--format=json' ], JSON.stringify( { gallery, album } ) );
}

async function openDefaults( page: Page, type: 'gallery' | 'album' ): Promise< void > {
	await page.goto( `/wp-admin/admin.php?page=fotogrids-settings&tab=defaults&subtab=${ type }` );
	await expect( new CollectionSettings( page ).activeLayout() ).toBeVisible( { timeout: 20000 } );
}

/** Click a subtab and wait for its panel to show the subtab's own layout. */
async function openSubtab( page: Page, label: string ): Promise< void > {
	await page.getByRole( 'tab', { name: label, exact: true } ).click();
	await expect( page.getByRole( 'tab', { name: label, exact: true } ) ).toHaveAttribute( 'aria-selected', 'true' );
	await expect( new CollectionSettings( page ).activeLayout() ).toBeVisible( { timeout: 20000 } );
}

let savedDefaults: string | null;
let savedAutosave: string | null;

test.beforeAll( () => {
	savedDefaults = null === getOption( OPTION ) ? null : wp( [ 'option', 'get', OPTION, '--format=json' ] );
	savedAutosave = getOption( 'fotogrids_autosave' );
} );

test.afterAll( () => {
	if ( null === savedDefaults ) {
		setOption( OPTION, null );
	} else {
		wp( [ 'option', 'update', OPTION, '--format=json' ], savedDefaults );
	}
	setOption( 'fotogrids_autosave', savedAutosave );
} );

test.beforeEach( () => {
	seed( { layout: 'grid' }, { layout: 'grid' } );
	setOption( 'fotogrids_autosave', '1' );
} );

test( 'a layout chosen on Album Defaults leaves Gallery Defaults as it was', { tag: [ '@critical', '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const settings = new SettingsPage( page );
	const panel = new CollectionSettings( page );

	await openDefaults( page, 'album' );
	await panel.layoutOption( 'Masonry' ).click();
	await expect( settings.saveMessage() ).toContainText( /unsaved changes/i );
	await expect( settings.saveMessage() ).toContainText( /all changes saved/i, { timeout: 20000 } );

	await openDefaults( page, 'gallery' );
	await expect( panel.activeLayout() ).toHaveText( 'Grid' );

	await panel.layoutOption( 'Justified' ).click();
	await expect( settings.saveMessage() ).toContainText( /all changes saved/i, { timeout: 20000 } );

	await openDefaults( page, 'album' );
	await expect( panel.activeLayout() ).toHaveText( 'Masonry' );

	expect( stored() ).toMatchObject( { gallery: { layout: 'justified' }, album: { layout: 'masonry' } } );
} );

test( 'a new gallery and a new album start from the defaults saved for their type', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const panel = new CollectionSettings( page );
	seed( { layout: 'justified' }, { layout: 'masonry' } );

	await page.goto( '/wp-admin/post-new.php?post_type=fotogrids_gallery' );
	await expect( panel.activeLayout() ).toHaveText( 'Justified', { timeout: 20000 } );

	await page.goto( '/wp-admin/post-new.php?post_type=fotogrids_album' );
	await expect( panel.activeLayout() ).toHaveText( 'Masonry', { timeout: 20000 } );
} );

test( 'each subtab shows its own values, and a change made just before switching is saved', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const panel = new CollectionSettings( page );
	seed( { layout: 'justified' }, { layout: 'grid' } );

	await openDefaults( page, 'gallery' );
	await expect( panel.activeLayout() ).toHaveText( 'Justified' );

	await openSubtab( page, 'Album Defaults' );
	await expect( panel.activeLayout() ).toHaveText( 'Grid' );
	await expect( panel.tabLabels() ).resolves.not.toContain( 'Interactions' );

	await panel.layoutOption( 'Masonry' ).click();
	await openSubtab( page, 'Gallery Defaults' );
	await expect( panel.activeLayout() ).toHaveText( 'Justified' );
	await expect.poll( () => stored().album.layout ).toBe( 'masonry' );

	await openSubtab( page, 'Album Defaults' );
	await expect( panel.activeLayout() ).toHaveText( 'Masonry' );
	expect( stored().gallery.layout ).toBe( 'justified' );
} );

test( 'with Autosave off, leaving unsaved defaults asks whether to save them', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const settings = new SettingsPage( page );
	const panel = new CollectionSettings( page );
	const dialog = page.getByRole( 'dialog' );
	setOption( 'fotogrids_autosave', '0' );

	await openDefaults( page, 'gallery' );
	await panel.layoutOption( 'Masonry' ).click();

	// Escape stays, with the change still pending.
	await page.getByRole( 'tab', { name: 'Album Defaults', exact: true } ).click();
	await expect( dialog ).toContainText( 'Gallery Defaults' );
	await page.keyboard.press( 'Escape' );
	await expect( dialog ).toHaveCount( 0 );
	await expect( page.getByRole( 'tab', { name: 'Gallery Defaults', exact: true } ) ).toHaveAttribute( 'aria-selected', 'true' );
	await expect( settings.saveMessage() ).toContainText( /unsaved changes/i );

	// Discard moves on and saves nothing.
	await page.getByRole( 'tab', { name: 'Album Defaults', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Discard changes' } ).click();
	await expect( page.getByRole( 'tab', { name: 'Album Defaults', exact: true } ) ).toHaveAttribute( 'aria-selected', 'true' );
	expect( stored().gallery.layout ).toBe( 'grid' );

	// Save writes the change, then moves on.
	await openSubtab( page, 'Gallery Defaults' );
	await expect( panel.activeLayout() ).toHaveText( 'Grid' );
	await panel.layoutOption( 'Justified' ).click();
	await page.getByRole( 'tab', { name: 'Album Defaults', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Save changes' } ).click();
	await expect( page.getByRole( 'tab', { name: 'Album Defaults', exact: true } ) ).toHaveAttribute( 'aria-selected', 'true' );
	expect( stored() ).toMatchObject( { gallery: { layout: 'justified' }, album: { layout: 'grid' } } );

	// Leaving the Defaults tab asks too.
	await panel.layoutOption( 'Masonry' ).click();
	await page.locator( '.fotogrids-sidebar-tabs' ).getByRole( 'link', { name: 'Sharing' } ).click();
	await dialog.getByRole( 'button', { name: 'Discard changes' } ).click();
	await expect( page ).toHaveURL( /tab=sharing/ );
	expect( stored().album.layout ).toBe( 'grid' );
} );
