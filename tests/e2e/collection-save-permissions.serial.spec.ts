import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { storageStateFor, wpCli } from './support/roles';
import { execFileSync } from 'child_process';

/**
 * ROLE-06 and ROLE-07. What an author's save is allowed to change.
 *
 * `Permission_Gate` classifies every Collection Settings key as settings, and
 * an author holds `edit_fotogrids_galleries` but not
 * `modify_fotogrids_gallery_settings`. So a save from an author keeps its
 * content and drops its settings, reporting which keys it dropped rather than
 * failing the whole request.
 *
 * The galleries here are drafts: an author cannot open one of their own once it
 * is published (FotoGrids/backstage#383), and the gate is what these are about.
 *
 * Serial: these save real galleries.
 */

test.describe.configure( { mode: 'serial' } );
test.use( {
	storageState: storageStateFor( 'author' ),
	allowConsoleErrors: 'the editor screen is reached as a role it partly refuses',
} );

const AUTHOR = 'fg-author';

/** A stored setting, decoded the way the pipeline stores it. */
function storedSetting( galleryId: number, key: string ): string {
	return execFileSync(
		wpCli(),
		[ 'post', 'meta', 'get', String( galleryId ), `fotogrids_${ key }` ],
		{ encoding: 'utf8' }
	).trim();
}

function storedTitle( galleryId: number ): string {
	return execFileSync(
		wpCli(),
		[ 'post', 'get', String( galleryId ), '--field=post_title' ],
		{ encoding: 'utf8' }
	).trim();
}

type SaveResponse = {
	success: boolean;
	data?: { skipped_for_permissions?: string[] };
};

/**
 * Save through the same admin-ajax action the editor uses, with the nonce the
 * editor screen was served.
 */
async function saveAs(
	page: import( '@playwright/test' ).Page,
	galleryId: number,
	fields: Record< string, string >
): Promise< SaveResponse > {
	await page.goto( `/wp-admin/post.php?post=${ galleryId }&action=edit` );

	// The screen renders the field once per metabox; they carry the same nonce.
	const nonce = await page
		.locator( '#fotogrids_meta_box_nonce' )
		.first()
		.inputValue();

	expect( nonce, 'the editor served no save nonce' ).not.toBe( '' );

	const response = await page.request.post( '/wp-admin/admin-ajax.php', {
		form: {
			action: 'fotogrids_save_collection',
			nonce,
			post_id: String( galleryId ),
			...fields,
		},
	} );

	return ( await response.json() ) as SaveResponse;
}

test( 'ROLE-07: an author changes their own gallery’s content', async ( { page } ) => {
	const { id } = galleryPage( { layout: 'grid' }, undefined, 'Before', AUTHOR, 'draft' );

	const body = await saveAs( page, id, { post_title: 'After' } );

	expect( body.success ).toBe( true );
	expect( storedTitle( id ) ).toBe( 'After' );
} );

test( 'ROLE-06: the same save drops every settings key and says which', async ( {
	page,
} ) => {
	const { id } = galleryPage(
		{ layout: 'grid' },
		undefined,
		'Settings probe',
		AUTHOR,
		'draft'
	);

	expect( storedSetting( id, 'layout' ), 'the fixture did not store a layout' ).toBe(
		'grid'
	);

	const body = await saveAs( page, id, {
		post_title: 'Settings probe saved',
		fotogrids_layout: 'masonry',
	} );

	expect( body.success ).toBe( true );

	// The content half went through, so the request was accepted and it is the
	// settings key specifically that was refused.
	expect( storedTitle( id ) ).toBe( 'Settings probe saved' );
	expect( storedSetting( id, 'layout' ), 'an author rewrote a setting' ).toBe( 'grid' );
	expect( body.data?.skipped_for_permissions ?? [] ).toContain( 'layout' );
} );
