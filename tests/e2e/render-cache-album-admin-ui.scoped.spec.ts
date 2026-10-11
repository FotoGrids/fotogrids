import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';
import { NAVIGATION, cached, permalink, servedAndUncached, wp } from './support/album-header';

test.use( { storageState: storageStateFor( 'administrator' ) } );

// Each row makes a change through the admin and then compares several visitor renders.
test.describe.configure( { timeout: 120000 } );

/**
 * Album changes made through the admin screens reach the cached renders of
 * the galleries they affect.
 *
 * Each change is made the way an editor makes it: the album editor, the
 * gallery editor's Albums box, the list tables and Quick Edit. After it, the
 * next visitor must be served what an uncached render shows.
 *
 * Scoped: every collection here is created by the test that reads it.
 */

function isSave( url: string, body: string | null ): boolean {
	return url.includes( 'admin-ajax.php' ) && ( body ?? '' ).includes( 'fotogrids_save_collection' );
}

async function openEditor( page: Page, postId: number ): Promise< void > {
	await page.goto( `/wp-admin/post.php?post=${ postId }&action=edit` );
	await expect( page.locator( '#title' ) ).toBeVisible( { timeout: 15000 } );
}

async function openAlbum( page: Page, albumId: number ): Promise< void > {
	await openEditor( page, albumId );
	await expect( page.locator( '.fotogrids-album-galleries' ) ).toBeVisible( { timeout: 15000 } );
}

/** Click Update and wait until the post is saved. */
async function clickUpdate( page: Page ): Promise< void > {
	await Promise.all( [ page.waitForLoadState( 'load' ), page.locator( '#publish' ).click() ] );
	await page.waitForLoadState( 'networkidle' );
}

/** Flip a Navigation setting on the album screen; Autosave saves it. */
async function flipNavigation( page: Page, albumId: number, key: string ): Promise< void > {
	await openAlbum( page, albumId );
	await page.getByText( 'Navigation', { exact: true } ).first().click();
	const saved = page.waitForResponse( ( r ) => isSave( r.url(), r.request().postData() ) );
	await page.locator( `[data-fg-setting="${ key }"] button[role=switch]` ).click();
	expect( ( await ( await saved ).json() ).success ).toBe( true );
}

/** Wait for a REST write to a route containing `route`, after `act`. */
async function restWrite( page: Page, route: string, act: () => Promise< void > ): Promise< void > {
	const response = page.waitForResponse( ( r ) => r.url().includes( route ) && 'GET' !== r.request().method() );
	await act();
	expect( ( await response ).status() ).toBe( 200 );
}

async function quickEdit( page: Page, type: string, postId: number, field: string, value: string ): Promise< void > {
	await page.goto( `/wp-admin/edit.php?post_type=${ type }` );
	const row = page.locator( `#post-${ postId }` );
	await row.hover();
	await row.locator( 'button.editinline' ).click();
	const editor = page.locator( `#edit-${ postId }` );
	await editor.locator( `input[name="${ field }"]` ).fill( value );
	const saved = page.waitForResponse( ( r ) => r.url().includes( 'admin-ajax.php' ) && ( r.request().postData() ?? '' ).includes( 'inline-save' ) );
	await editor.locator( 'button.save' ).click();
	await saved;
}

async function rowAction( page: Page, type: string, postId: number, selector: string, view = '' ): Promise< void > {
	await page.goto( `/wp-admin/edit.php?post_type=${ type }${ view }` );
	const row = page.locator( `#post-${ postId }` );
	await row.hover();
	await Promise.all( [ page.waitForLoadState( 'load' ), row.locator( selector ).first().click() ] );
}

async function bulk( page: Page, action: string, galleryIds: number[], albumId?: number ): Promise< void > {
	await page.goto( '/wp-admin/edit.php?post_type=fotogrids_gallery' );
	for ( const id of galleryIds ) {
		await page.locator( `#cb-select-${ id }` ).check();
	}
	await page.selectOption( '#bulk-action-selector-top', action );
	if ( albumId ) {
		await page.selectOption( 'select[data-fg-album-select="top"]', String( albumId ) );
	}
	await Promise.all( [ page.waitForLoadState( 'load' ), page.locator( '#doaction' ).click() ] );
}

test.describe( 'album editor', () => {
	test( 'adding a gallery gives it a back link for the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const title = `Joins ${ Date.now() }`;
		const gallery = galleryPage( { enable_cache: true }, undefined, title );
		const parent = album( [], NAVIGATION );

		expect( ( await cached( browser, gallery.url, gallery.id ) ).album ).toBeNull();

		await openAlbum( page, parent.id );
		await page.locator( '.fotogrids-available-section .fotogrids-search-input' ).fill( title );
		await restWrite( page, `/admin/albums/${ parent.id }/galleries`, () =>
			page.locator( '.fotogrids-available-galleries .fg-action-button--add' ).first().click()
		);

		const [ seen, uncached ] = await servedAndUncached( browser, gallery );
		expect( seen ).toEqual( uncached );
		expect( seen.album ).toBe( parent.id );
	} );

	test( 'removing a gallery takes its back link away for the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const title = `Leaves ${ Date.now() }`;
		const gallery = galleryPage( { enable_cache: true }, undefined, title );
		const parent = album( [ gallery.id ], NAVIGATION );

		expect( ( await cached( browser, gallery.url, gallery.id ) ).album ).toBe( parent.id );

		await openAlbum( page, parent.id );
		const item = page.locator( '.fotogrids-assigned-galleries > *' ).filter( { hasText: title } );
		await restWrite( page, `/admin/albums/${ parent.id }/galleries/${ gallery.id }`, () =>
			item.locator( '.fg-action-button--remove' ).click()
		);

		const [ seen, uncached ] = await servedAndUncached( browser, gallery );
		expect( seen ).toEqual( uncached );
		expect( seen.album ).toBeNull();
	} );

	test( 'dragging the galleries into a new order keeps the cached render', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		const sibling = galleryPage( { enable_cache: true } );
		const parent = album( [ gallery.id, sibling.id ], NAVIGATION );

		const before = await cached( browser, gallery.url, gallery.id );
		const row = wpEval( `global $wpdb; echo $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_id = %d", ${ gallery.id } ) );` ).trim();

		await openAlbum( page, parent.id );
		const items = page.locator( '.fotogrids-assigned-galleries [draggable="true"]' );
		await restWrite( page, '/galleries/reorder', () => items.nth( 1 ).dragTo( items.nth( 0 ) ) );

		expect(
			wpEval( `global $wpdb; echo $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_id = %d", ${ gallery.id } ) );` ).trim(),
			'the reorder replaced the cached render'
		).toBe( row );
		const [ seen, uncached ] = await servedAndUncached( browser, gallery );
		expect( seen ).toEqual( before );
		expect( seen ).toEqual( uncached );
	} );

	test( 'renaming the album and clicking Update reaches the gallery view page', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		const parent = album( [ gallery.id ], NAVIGATION, 'Before update' );
		const view = { id: gallery.id, url: permalink( gallery.id ) };

		expect( ( await cached( browser, view.url, gallery.id ) ).back ).toContain( 'Before update' );

		await openAlbum( page, parent.id );
		await page.locator( '#title' ).fill( 'After update' );
		await clickUpdate( page );

		const [ seen, uncached ] = await servedAndUncached( browser, view );
		expect( seen ).toEqual( uncached );
		expect( seen.back ).toContain( 'After update' );
	} );

	test( 'turning off the back button and the breadcrumb schema reaches the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		const parent = album( [ gallery.id ], NAVIGATION );

		const before = await cached( browser, gallery.url, gallery.id );
		expect( before.back ).not.toBeNull();
		expect( before.trail ).not.toEqual( [] );

		await flipNavigation( page, parent.id, 'navigation_show_back_button' );
		const [ noBack, noBackUncached ] = await servedAndUncached( browser, gallery );
		expect( noBack ).toEqual( noBackUncached );
		expect( noBack.back ).toBeNull();

		await cached( browser, gallery.url, gallery.id );
		await flipNavigation( page, parent.id, 'navigation_emit_breadcrumb_schema' );
		const [ noSchema, noSchemaUncached ] = await servedAndUncached( browser, gallery );
		expect( noSchema ).toEqual( noSchemaUncached );
		expect( noSchema.trail ).toEqual( [] );
	} );

	test( 'editing the permalink and setting the album to Draft reach the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		const parent = album( [ gallery.id ], NAVIGATION );

		await cached( browser, gallery.url, gallery.id );
		await openAlbum( page, parent.id );
		await page.locator( '#edit-slug-buttons button.edit-slug' ).click();
		await page.locator( '#new-post-slug' ).fill( `moved-${ parent.id }` );
		await page.locator( '#edit-slug-buttons button.save' ).click();
		await expect( page.locator( '#editable-post-name' ) ).toHaveText( `moved-${ parent.id }` );
		await clickUpdate( page );

		const [ moved, movedUncached ] = await servedAndUncached( browser, gallery );
		expect( moved ).toEqual( movedUncached );
		expect( moved.href ).toContain( `moved-${ parent.id }` );

		await cached( browser, gallery.url, gallery.id );
		await openAlbum( page, parent.id );
		await page.locator( 'a.edit-post-status' ).click();
		await page.selectOption( '#post_status', 'draft' );
		await page.locator( '.save-post-status' ).click();
		await clickUpdate( page );
		expect( wp( [ 'post', 'get', String( parent.id ), '--field=post_status' ] ) ).toBe( 'draft' );

		const [ draft, draftUncached ] = await servedAndUncached( browser, gallery );
		expect( draft ).toEqual( draftUncached );
		expect( draft.href ).not.toContain( `moved-${ parent.id }` );
	} );
} );

test.describe( 'gallery editor Albums box', () => {
	test( 'adding the gallery to a second album and removing it again reach the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		const parent = album( [ gallery.id ], NAVIGATION );
		const second = album( [], NAVIGATION, `Second ${ Date.now() }` );
		const secondTitle = wp( [ 'post', 'get', String( second.id ), '--field=post_title' ] );

		await cached( browser, gallery.url, gallery.id );
		await openEditor( page, gallery.id );
		await page.locator( '.fotogrids-album-assignment .fotogrids-search-input' ).fill( secondTitle );
		await restWrite( page, `/admin/galleries/${ gallery.id }/albums`, () =>
			page.locator( '.fotogrids-album-item.available' ).filter( { hasText: secondTitle } ).locator( '.fg-action-button--add' ).click()
		);

		const [ joined, joinedUncached ] = await servedAndUncached( browser, gallery );
		expect( joined ).toEqual( joinedUncached );
		expect( joined.album, 'a gallery in two albums has no single parent' ).toBeNull();

		await cached( browser, gallery.url, gallery.id );
		await openEditor( page, gallery.id );
		await restWrite( page, `/admin/galleries/${ gallery.id }/albums/${ second.id }`, () =>
			page.locator( '.fotogrids-assigned-album' ).filter( { hasText: secondTitle } ).locator( '.fg-action-button--remove' ).click()
		);

		const [ left, leftUncached ] = await servedAndUncached( browser, gallery );
		expect( left ).toEqual( leftUncached );
		expect( left.album ).toBe( parent.id );
	} );
} );

test.describe( 'list tables', () => {
	test( 'the Assign to Album and Remove from Albums bulk actions reach the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		album( [ gallery.id ], NAVIGATION );
		const second = album( [], NAVIGATION );

		await cached( browser, gallery.url, gallery.id );
		await bulk( page, 'assign_to_album', [ gallery.id ], second.id );
		const [ assigned, assignedUncached ] = await servedAndUncached( browser, gallery );
		expect( assigned ).toEqual( assignedUncached );
		expect( assigned.album ).toBeNull();

		await cached( browser, gallery.url, gallery.id );
		await bulk( page, 'remove_from_albums', [ gallery.id ] );
		const [ removed, removedUncached ] = await servedAndUncached( browser, gallery );
		expect( removed ).toEqual( removedUncached );
		expect( removed.album ).toBeNull();
		expect( wpEval( `echo count( FotoGrids\\Gallery_Album_Relations::get_albums_for_gallery( ${ gallery.id } ) );` ).trim() ).toBe( '0' );
	} );

	test( 'Quick Edit on the album and on the gallery reaches the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		const parent = album( [ gallery.id ], NAVIGATION );

		await cached( browser, gallery.url, gallery.id );
		await quickEdit( page, 'fotogrids_album', parent.id, 'post_title', 'Quick album' );
		const [ renamed, renamedUncached ] = await servedAndUncached( browser, gallery );
		expect( renamed ).toEqual( renamedUncached );
		expect( renamed.back ).toContain( 'Quick album' );

		await cached( browser, gallery.url, gallery.id );
		await quickEdit( page, 'fotogrids_gallery', gallery.id, 'post_title', 'Quick gallery' );
		const [ gallerySeen, galleryUncached ] = await servedAndUncached( browser, gallery );
		expect( gallerySeen ).toEqual( galleryUncached );
		expect( gallerySeen.trail[ 1 ] ).toContain( 'Quick gallery' );
	} );

	test( 'trashing, restoring and permanently deleting the album reach the next visitor', { tag: '@cache' }, async ( { browser, page } ) => {
		const gallery = galleryPage( { enable_cache: true } );
		const parent = album( [ gallery.id ], NAVIGATION );

		await cached( browser, gallery.url, gallery.id );
		await rowAction( page, 'fotogrids_album', parent.id, 'a.submitdelete' );
		const [ trashed, trashedUncached ] = await servedAndUncached( browser, gallery );
		expect( trashed ).toEqual( trashedUncached );
		expect( trashed.album ).toBeNull();

		await cached( browser, gallery.url, gallery.id );
		await rowAction( page, 'fotogrids_album', parent.id, '.untrash a', '&post_status=trash' );
		const [ restored, restoredUncached ] = await servedAndUncached( browser, gallery );
		expect( restored ).toEqual( restoredUncached );
		expect( restored.album ).toBe( parent.id );

		await rowAction( page, 'fotogrids_album', parent.id, 'a.submitdelete' );
		await cached( browser, gallery.url, gallery.id );
		await rowAction( page, 'fotogrids_album', parent.id, '.delete a.submitdelete', '&post_status=trash' );
		const [ deleted, deletedUncached ] = await servedAndUncached( browser, gallery );
		expect( deleted ).toEqual( deletedUncached );
		expect( deleted.album ).toBeNull();
	} );
} );
