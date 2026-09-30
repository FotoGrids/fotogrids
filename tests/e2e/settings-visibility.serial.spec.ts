import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { storageStateFor } from './support/roles';
import { getOption, setOption } from './support/site';

/**
 * ROLE-08 and ROLE-09. What a role without the settings capability is shown.
 *
 * `unauthorised_settings_visibility` decides between shipping the settings tree
 * read-only and not registering the metabox at all. An author holds
 * `edit_fotogrids_galleries` but not `modify_fotogrids_gallery_settings`, so
 * they are the role the option is about.
 *
 * Serial: the option is site-wide, so it is put back afterwards.
 */

test.describe.configure( { mode: 'serial' } );
test.use( {
	storageState: storageStateFor( 'author' ),
	allowConsoleErrors: 'the editor is reached as a role it partly refuses',
} );

const OPTION = 'fotogrids_unauthorised_settings_visibility';
const ROOT = '#fotogrids-collection-settings-root';

let previous: string | null;

test.beforeAll( () => {
	previous = getOption( OPTION );
} );

test.afterAll( () => {
	setOption( OPTION, previous );
} );

/** An author's own draft, which is the gallery they can actually open. */
function ownDraft( title: string ) {
	return galleryPage( { layout: 'grid' }, undefined, title, 'fg-author', 'draft' );
}

test( 'ROLE-08: readonly ships the settings tree with the notice and no write', async ( {
	page,
} ) => {
	setOption( OPTION, 'readonly' );
	const { id } = ownDraft( 'Readonly probe' );

	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );

	await expect( page.locator( ROOT ), 'the metabox was not registered' ).toHaveCount( 1 );

	const payload = await page.evaluate( () =>
		JSON.stringify( window.fotogridsSettings ?? null )
	);

	expect( payload, 'the editor handed the browser no settings' ).toContain( 'layout' );

	// wp_localize_script casts every scalar to a string, so PHP false arrives
	// as '' rather than false. Falsiness is the contract the tree reads.
	const shipped = JSON.parse( payload ) as {
		editable?: unknown;
		unauthorisedNotice?: string;
	};

	expect( shipped, 'the payload carries no editable flag at all' ).toHaveProperty(
		'editable'
	);
	expect( Boolean( shipped.editable ), 'the tree was shipped editable' ).toBe( false );
	expect( shipped.unauthorisedNotice ?? '' ).toContain( 'read-only mode' );
} );

test( 'ROLE-09: hidden does not register the metabox at all', async ( { page } ) => {
	setOption( OPTION, 'hidden' );
	const { id } = ownDraft( 'Hidden probe' );

	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );

	// The screen itself rendered, so the absence below is the option's doing.
	await expect( page.locator( '#titlediv' ) ).toHaveCount( 1 );

	await expect( page.locator( ROOT ), 'the metabox is in the DOM' ).toHaveCount( 0 );
} );
