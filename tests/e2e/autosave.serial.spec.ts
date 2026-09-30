import { test, expect } from './support/test';
import { storageStateFor } from './support/roles';
import { GalleryEditor, PAST_DEBOUNCE } from './support/gallery-editor';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Autosave is on by default, so the Add New screen has to stay inert until the
 * gallery actually exists: wp_update_post() promotes an auto-draft to a draft,
 * which would leave a gallery behind for anyone who changes a setting and
 * walks away.
 *
 * Serial: these share one WordPress site and assert on the gallery list.
 */

test.describe.configure( { mode: 'serial' } );

test( 'opening Add New and waiting creates nothing', async ( { page } ) => {
	const editor = new GalleryEditor( page );
	const before = await editor.listTitles();

	await editor.openNew();
	await page.waitForTimeout( PAST_DEBOUNCE );

	expect( await editor.listTitles() ).toEqual( before );
} );

test( 'a settings change on Add New creates nothing', { tag: '@critical' }, async ( { page } ) => {
	const editor = new GalleryEditor( page );
	const before = await editor.listTitles();

	await editor.openNew();
	await editor.changeASetting();
	await page.waitForTimeout( PAST_DEBOUNCE );

	expect( await editor.listTitles() ).toEqual( before );
} );

test( 'an unsaved gallery still warns about unsaved changes', async ( {
	page,
} ) => {
	const editor = new GalleryEditor( page );

	await editor.openNew();
	await editor.changeASetting();

	await expect( editor.unsavedBanner() ).toBeVisible( { timeout: 15000 } );
} );
