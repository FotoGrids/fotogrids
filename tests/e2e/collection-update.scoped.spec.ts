import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { storageStateFor, wpCli } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Update on a published collection posts the whole edit form to post.php, and
 * the settings it carries are written on `save_post`. Update pressed straight
 * after a change, before the autosave debounce runs, must still keep it.
 *
 * Scoped: each test edits a collection it created.
 */

const KEY = 'border_enabled';

function storedSetting( id: number ): string {
	return execFileSync(
		wpCli(),
		[ 'post', 'meta', 'get', String( id ), `fotogrids_${ KEY }` ],
		{ encoding: 'utf8' }
	).trim();
}

const KINDS = [
	{ kind: 'gallery', make: () => galleryPage().id },
	{ kind: 'album', make: () => album( [ galleryPage().id ] ).id },
] as const;

for ( const { kind, make } of KINDS ) {
	test( `a setting saved with Update in the ${ kind } editor is kept`, { tag: [ '@admin', '@settings' ] }, async ( {
		page,
	} ) => {
		const id = make();
		const panel = new CollectionSettings( page );
		const open = async () => {
			await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
			await panel.switchTab( 'styling' );
		};

		await open();
		expect( await panel.switchState( KEY ) ).toBe( 'false' );
		const before = storedSetting( id );

		await panel.switchIn( KEY ).click();
		await expect( panel.switchIn( KEY ) ).toHaveAttribute( 'aria-checked', 'true' );

		await Promise.all( [
			page.waitForURL( /[?&]message=\d+/ ),
			page.locator( '#publish' ).click(),
		] );

		expect( storedSetting( id ) ).not.toBe( before );

		await open();
		expect( await panel.switchState( KEY ) ).toBe( 'true' );
	} );
}
