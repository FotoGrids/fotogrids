import type { Dialog, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor } from './support/roles';
import { SettingsPage } from './support/settings-page';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Leaving a settings tab never drops a change: Autosave saves it, otherwise
 * the user chooses to save, discard or stay, and the browser warns before the
 * page itself is left.
 *
 * Serial: these change the Autosave and Google Fonts options.
 */

test.describe.configure( { mode: 'serial' } );

const FONTS = 'allow_google_fonts';

function sidebarLink( page: Page, name: string ) {
	return page.locator( '.fotogrids-sidebar-tabs' ).getByRole( 'link', { name, exact: true } );
}

let fontsBefore: string | null;

test.beforeAll( async ( { browser } ) => {
	const page = await browser.newPage( { storageState: storageStateFor( 'administrator' ) } );
	const settings = new SettingsPage( page );
	await settings.openAdvanced();
	fontsBefore = await settings.toggleState( FONTS );
	await page.close();
} );

test.afterAll( async ( { browser } ) => {
	const page = await browser.newPage( { storageState: storageStateFor( 'administrator' ) } );
	const settings = new SettingsPage( page );
	await settings.setAutosave( true );
	await settings.openAdvanced();
	await settings.setToggle( FONTS, 'true' === fontsBefore );
	await page.close();
} );

test( 'with Autosave off, leaving a tab with unsaved changes asks first', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const settings = new SettingsPage( page );
	const dialog = page.getByRole( 'dialog' );
	await settings.setAutosave( false );

	await settings.openAdvanced();
	const before = await settings.toggleState( FONTS );
	await settings.toggle( FONTS ).click();

	// Escape stays, with the change still pending.
	await sidebarLink( page, 'Media' ).click();
	await expect( dialog ).toContainText( 'You have unsaved changes on Advanced' );
	await page.keyboard.press( 'Escape' );
	await expect( dialog ).toHaveCount( 0 );
	await expect( page ).toHaveURL( /tab=advanced/ );
	await expect( settings.saveMessage() ).toContainText( /unsaved changes/i );

	// Discard moves on and saves nothing.
	await sidebarLink( page, 'Media' ).click();
	await dialog.getByRole( 'button', { name: 'Discard changes' } ).click();
	await expect( page ).toHaveURL( /tab=media/ );
	await settings.openAdvanced();
	expect( await settings.toggleState( FONTS ) ).toBe( before );

	// Save writes the change, then moves on.
	await settings.toggle( FONTS ).click();
	await sidebarLink( page, 'Media' ).click();
	await dialog.getByRole( 'button', { name: 'Save changes' } ).click();
	await expect( page ).toHaveURL( /tab=media/ );
	await settings.openAdvanced();
	expect( await settings.toggleState( FONTS ) ).not.toBe( before );

	// Nothing unsaved, nothing asked.
	await sidebarLink( page, 'Media' ).click();
	await expect( page ).toHaveURL( /tab=media/ );
	await expect( dialog ).toHaveCount( 0 );
} );

test( 'with Autosave on, a change made just before leaving a tab is saved', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const settings = new SettingsPage( page );
	await settings.setAutosave( true );

	await settings.openAdvanced();
	const before = await settings.toggleState( FONTS );
	await settings.toggle( FONTS ).click();
	await sidebarLink( page, 'Media' ).click();

	await expect( page ).toHaveURL( /tab=media/ );
	await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
	await settings.openAdvanced();
	expect( await settings.toggleState( FONTS ) ).not.toBe( before );
} );

test( 'browser Back with unsaved changes asks too, and staying keeps the tab', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const settings = new SettingsPage( page );
	const dialog = page.getByRole( 'dialog' );
	await settings.setAutosave( false );

	await settings.open( 'media' );
	await sidebarLink( page, 'Advanced' ).click();
	await expect( page ).toHaveURL( /tab=advanced/ );
	await settings.toggle( FONTS ).click();

	await page.goBack();
	await expect( dialog ).toContainText( 'Advanced' );
	await page.keyboard.press( 'Escape' );

	await expect( page ).toHaveURL( /tab=advanced/ );
	await expect( settings.toggle( FONTS ) ).toBeVisible();
	await expect( settings.saveMessage() ).toContainText( /unsaved changes/i );
} );

test( 'the browser warns before the page is left with unsaved changes', { tag: [ '@settings', '@admin' ] }, async ( {
	page,
} ) => {
	const settings = new SettingsPage( page );
	await settings.setAutosave( false );
	const seen: string[] = [];
	const record = ( d: Dialog ) => {
		seen.push( d.type() );
		void d.accept();
	};
	page.on( 'dialog', record );

	await settings.openAdvanced();
	await page.reload();
	expect( seen ).toEqual( [] );

	await settings.toggle( FONTS ).click();
	await page.reload();
	expect( seen ).toEqual( [ 'beforeunload' ] );

	page.off( 'dialog', record );
} );
