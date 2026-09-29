import { test, expect } from './support/test';
import { storageStateFor } from './support/roles';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { SettingsPage } from './support/settings-page';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Saving one settings tab must not disturb another, and a setting turned off
 * must read as off everywhere it is shown.
 *
 * The Defaults tab persists through a WordPress Settings API form posted to
 * options.php. options.php writes every option registered to the posted
 * option group, passing null for any the form does not carry, so a group with
 * more than one member silently resets its other options on every save.
 *
 * Serial: these share one WordPress site and one set of options.
 */

test.describe.configure( { mode: 'serial' } );

test.describe( 'settings persistence', () => {
	test( 'autosave defaults to on', async ( { page } ) => {
		const settings = new SettingsPage( page );

		await settings.openAdvanced();

		expect( await settings.toggleState( 'autosave' ) ).toBe( 'true' );
	} );

	/**
	 * wp_localize_script casts every scalar to a string, so the option reaches
	 * the browser as '1' or '' and never as a boolean. A check that reads ''
	 * as "unset, therefore on" leaves the editor's switch stuck on while the
	 * setting is off. That is what this pins down.
	 */
	test( 'turning autosave off is reflected in the editor', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );
		const editor = new GalleryEditor( page );
		const panel = new CollectionSettings( page );

		await settings.setAutosave( false );

		await editor.openNew();
		await expect( panel.autosaveToggle() ).toHaveAttribute(
			'aria-checked',
			'false'
		);

		await settings.setAutosave( true );

		await editor.openNew();
		await expect( panel.autosaveToggle() ).toHaveAttribute(
			'aria-checked',
			'true'
		);
	} );

	/**
	 * The point of the setting: a change on a settings screen writes itself,
	 * with no Save click.
	 */
	test( 'a settings change saves itself when autosave is on', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );
		const fonts = 'allow_google_fonts';

		await settings.setAutosave( true );

		await settings.openAdvanced();
		const before = await settings.toggleState( fonts );

		const write = settings.write( '/admin/advanced-settings' );
		await settings.toggle( fonts ).click();
		await write;

		await settings.openAdvanced();
		expect( await settings.toggleState( fonts ) ).not.toBe( before );

		const restore = settings.write( '/admin/advanced-settings' );
		await settings.toggle( fonts ).click();
		await restore;
	} );

	test( 'a settings change waits for Save when autosave is off', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );
		const fonts = 'allow_google_fonts';

		await settings.setAutosave( false );

		await settings.openAdvanced();
		const before = await settings.toggleState( fonts );
		await settings.toggle( fonts ).click();
		// Comfortably past the 2s debounce, so a stray autosave would have run.
		await page.waitForTimeout( 6000 );

		await settings.openAdvanced();
		expect( await settings.toggleState( fonts ) ).toBe( before );

		await settings.setAutosave( true );
	} );

	test( 'the defaults tab saves over REST, not through options.php', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );

		await settings.open( 'defaults' );

		await expect( page.locator( 'form[action="options.php"]' ) ).toHaveCount( 0 );
	} );

	/**
	 * Drives the same event the settings panel dispatches, then saves for real.
	 * The REST write runs outside is_admin(), so a class the endpoint reaches
	 * for has to exist there - which is the shape of failure this catches.
	 */
	test( 'a defaults change round-trips through the endpoint', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );

		await settings.open( 'defaults' );

		const value = String( 4 + ( Date.now() % 20 ) );
		await page.evaluate( ( v ) => {
			document.dispatchEvent(
				new CustomEvent( 'fotogrids:setting_changed', {
					detail: {
						key: 'featured_show_all_radius',
						value: v,
						scope: 'defaults',
					},
				} )
			);
		}, value );

		await expect( settings.saveMessage() ).toContainText( /unsaved changes/i );

		await settings.saveButton( /save defaults/i ).click();
		await expect( settings.saveMessage() ).toContainText(
			/all changes saved/i,
			{ timeout: 20000 }
		);

		// Read it back from the server rather than trusting the bar.
		const stored = await page.evaluate( async () =>
			window.wp.apiFetch( { path: '/fotogrids/v1/admin/gallery-defaults' } )
		);
		expect( stored.defaults.featured_show_all_radius ).toBe( value );
	} );

	test( 'the defaults save bar sits where the other tabs put it', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );

		await page.goto( settings.url( 'advanced' ) );
		const advanced = await settings.saveBarParentClass();

		await page.goto( settings.url( 'defaults' ) );
		const defaults = await settings.saveBarParentClass();

		expect( advanced ).toContain( 'fotogrids-sidebar-tabs__content__inner' );
		expect( defaults ).toBe( advanced );
	} );

	test( 'permissions manager shows a save bar', async ( { page } ) => {
		await new SettingsPage( page ).open( 'permissions_manager' );
	} );

	/**
	 * It used to POST on every change and reload the whole panel, which felt
	 * nothing like the other tabs. A change must now go dirty, wait out the
	 * debounce, then commit - and the panel must stay mounted throughout.
	 */
	test( 'permissions manager debounces like the other tabs', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );

		await settings.setAutosave( true );

		const writes = settings.recordWrites( '/permissions/' );
		await settings.open( 'permissions_manager' );

		const select = settings.roleSelect();
		await expect( select ).toBeVisible( { timeout: 20000 } );

		const options = await select
			.locator( 'option:not([value="__custom__"])' )
			.evaluateAll( ( elements: HTMLOptionElement[] ) =>
				elements.map( ( element ) => element.value )
			);
		const current = await select.inputValue();
		const next = options.find( ( value ) => value && value !== current );
		test.skip( ! next, 'no alternative role to switch to' );

		await select.selectOption( next as string );

		// Nothing may have gone out yet, and the panel must still be there.
		expect( writes ).toHaveLength( 0 );
		await expect( settings.saveMessage() ).toContainText( /unsaved changes/i );
		await expect( select ).toBeVisible();

		await expect( settings.saveMessage() ).toContainText(
			/all changes saved/i,
			{ timeout: 20000 }
		);
		expect( writes.length ).toBeGreaterThan( 0 );
		// The panel was never swapped out for the loading state.
		await expect( select ).toBeVisible();
	} );

	test( 'saving gallery defaults leaves the advanced settings alone', async ( {
		page,
	} ) => {
		const settings = new SettingsPage( page );

		await settings.openAdvanced();
		const autosaveBefore = await settings.toggleState( 'autosave' );
		const fontsBefore = await settings.toggleState( 'allow_google_fonts' );

		await settings.open( 'defaults' );
		await expect(
			settings.saveButton( /save defaults/i )
		).toBeVisible( { timeout: 20000 } );

		await settings.openAdvanced();
		expect( await settings.toggleState( 'autosave' ) ).toBe( autosaveBefore );
		expect( await settings.toggleState( 'allow_google_fonts' ) ).toBe(
			fontsBefore
		);
	} );
} );
