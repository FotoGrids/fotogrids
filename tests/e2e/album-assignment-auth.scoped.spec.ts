import { execFileSync } from 'child_process';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { apiAs, storageStateFor, wpCli, type Role } from './support/roles';

/**
 * Who may put a gallery into an album, or take it out.
 *
 * One row in `fotogrids_gallery_albums` joins a gallery and an album, so every
 * path that writes it - both REST directions, both metaboxes and the Galleries
 * list bulk actions - needs `edit_post` on both sides.
 *
 * Scoped: every collection here is created by the test that reads it.
 */

const AUTHOR = 'fg-author';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** Album ids the gallery is in, as stored. */
function albumsOf( galleryId: number ): number[] {
	const out = wp( [
		'eval',
		`echo wp_json_encode( array_map( 'intval', wp_list_pluck( \\FotoGrids\\Gallery_Album_Relations::get_albums_for_gallery( ${ galleryId } ), 'ID' ) ) );`,
	] );
	return ( JSON.parse( out ) as number[] ).sort( ( a, b ) => a - b );
}

function link( galleryId: number, albumId: number ): void {
	wp( [
		'eval',
		`\\FotoGrids\\Gallery_Album_Relations::add_gallery_to_album( ${ galleryId }, ${ albumId } );`,
	] );
}

function gallery( title: string, owner: string, status = 'publish' ): number {
	return galleryPage( {}, undefined, title, owner, status ).id;
}

function emptyAlbum( title: string, owner: string, status = 'publish' ): number {
	return album( [], {}, title, owner, status ).id;
}

function route( path: string ): string {
	return `/?rest_route=${ encodeURIComponent( `/fotogrids/v1${ path }` ) }`;
}

type Api = { context: APIRequestContext; nonce: string };

async function post( api: Api, path: string, data: Record< string, unknown > ): Promise< number > {
	const response = await api.context.post( route( path ), {
		headers: { 'X-WP-Nonce': api.nonce },
		data,
	} );
	return response.status();
}

async function remove( api: Api, path: string ): Promise< number > {
	const response = await api.context.delete( route( path ), {
		headers: { 'X-WP-Nonce': api.nonce },
	} );
	return response.status();
}

async function signedIn( browser: import( '@playwright/test' ).Browser, role: Role ): Promise< Page > {
	const context = await browser.newContext( { storageState: storageStateFor( role ) } );
	return context.newPage();
}

test.describe( 'the gallery-side routes', () => {
	test( 'an author cannot add their gallery to, or remove it from, an album they cannot edit', { tag: [ '@critical', '@api', '@permissions' ] }, async ( {
		playwright,
	} ) => {
		const own = gallery( 'Author gallery', AUTHOR, 'draft' );
		const privateAlbum = emptyAlbum( 'Admin private album', 'admin', 'private' );
		const publicAlbum = emptyAlbum( 'Admin public album', 'admin' );
		link( own, publicAlbum );

		const author = await apiAs( playwright, 'author' );

		expect( await post( author, `/admin/galleries/${ own }/albums`, { album_ids: [ privateAlbum ] } ) ).toBe( 403 );
		expect( await remove( author, `/admin/galleries/${ own }/albums/${ publicAlbum }` ) ).toBe( 403 );
		await author.context.dispose();

		expect( albumsOf( own ) ).toEqual( [ publicAlbum ] );
	} );

	test( 'a request naming one album the author cannot edit writes nothing', { tag: [ '@api', '@permissions' ] }, async ( {
		playwright,
	} ) => {
		const own = gallery( 'Author gallery', AUTHOR, 'draft' );
		const ownAlbum = emptyAlbum( 'Author album', AUTHOR, 'draft' );
		const adminAlbum = emptyAlbum( 'Admin album', 'admin' );

		const author = await apiAs( playwright, 'author' );
		expect(
			await post( author, `/admin/galleries/${ own }/albums`, { album_ids: [ ownAlbum, adminAlbum ] } )
		).toBe( 403 );
		await author.context.dispose();

		expect( albumsOf( own ) ).toEqual( [] );
	} );

	test( 'an author adds their gallery to their own album and removes it again', { tag: [ '@api', '@permissions' ] }, async ( {
		playwright,
	} ) => {
		const own = gallery( 'Author gallery', AUTHOR, 'draft' );
		const ownAlbum = emptyAlbum( 'Author album', AUTHOR, 'draft' );

		const author = await apiAs( playwright, 'author' );
		expect( await post( author, `/admin/galleries/${ own }/albums`, { album_ids: [ ownAlbum ] } ) ).toBe( 200 );
		expect( albumsOf( own ) ).toEqual( [ ownAlbum ] );
		expect( await remove( author, `/admin/galleries/${ own }/albums/${ ownAlbum }` ) ).toBe( 200 );
		await author.context.dispose();

		expect( albumsOf( own ) ).toEqual( [] );
	} );

	test( "an editor and an administrator assign any gallery to any album", { tag: [ '@api', '@permissions' ] }, async ( {
		playwright,
	} ) => {
		for ( const role of [ 'editor', 'administrator' ] as const ) {
			const authors = gallery( `Author gallery for ${ role }`, AUTHOR, 'draft' );
			const privateAlbum = emptyAlbum( `Admin private album for ${ role }`, 'admin', 'private' );

			const api = await apiAs( playwright, role );
			expect( await post( api, `/admin/galleries/${ authors }/albums`, { album_ids: [ privateAlbum ] } ), role ).toBe( 200 );
			expect( albumsOf( authors ), role ).toEqual( [ privateAlbum ] );
			expect( await remove( api, `/admin/galleries/${ authors }/albums/${ privateAlbum }` ), role ).toBe( 200 );
			await api.context.dispose();

			expect( albumsOf( authors ), role ).toEqual( [] );
		}
	} );
} );

test.describe( 'the album-side routes', () => {
	test( "an author cannot add another user's gallery to their album, or remove it", { tag: [ '@critical', '@api', '@permissions' ] }, async ( {
		playwright,
	} ) => {
		const ownAlbum = emptyAlbum( 'Author album', AUTHOR, 'draft' );
		const adminGallery = gallery( 'Admin gallery', 'admin' );
		const placed = gallery( 'Admin gallery already placed', 'admin' );
		link( placed, ownAlbum );

		const author = await apiAs( playwright, 'author' );
		expect( await post( author, `/admin/albums/${ ownAlbum }/galleries`, { gallery_ids: [ adminGallery ] } ) ).toBe( 403 );
		expect( await remove( author, `/admin/albums/${ ownAlbum }/galleries/${ placed }` ) ).toBe( 403 );
		await author.context.dispose();

		expect( albumsOf( adminGallery ) ).toEqual( [] );
		expect( albumsOf( placed ) ).toEqual( [ ownAlbum ] );
	} );

	test( 'an author reorders their album even when it holds a gallery they cannot edit', { tag: [ '@api', '@permissions' ] }, async ( {
		playwright,
	} ) => {
		const own = gallery( 'Author gallery', AUTHOR, 'draft' );
		const adminGallery = gallery( 'Admin gallery', 'admin' );
		const ownAlbum = album( [ own, adminGallery ], {}, 'Author album', AUTHOR, 'draft' ).id;

		const author = await apiAs( playwright, 'author' );
		expect(
			await post( author, `/admin/albums/${ ownAlbum }/galleries/reorder`, { gallery_ids: [ adminGallery, own ] } )
		).toBe( 200 );
		await author.context.dispose();
	} );
} );

test.describe( 'the Album Assignment box on the gallery screen', () => {
	test.use( { storageState: storageStateFor( 'author' ) } );

	test( 'lists only albums the author can edit, and locks the ones it cannot', { tag: [ '@critical', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		const stamp = Date.now();
		const own = gallery( `Author gallery ${ stamp }`, AUTHOR, 'draft' );
		const ownAlbum = emptyAlbum( `Author album ${ stamp }`, AUTHOR, 'draft' );
		const privateAlbum = emptyAlbum( `Admin private album ${ stamp }`, 'admin', 'private' );
		const placedIn = emptyAlbum( `Admin album holding it ${ stamp }`, 'admin' );
		link( own, placedIn );

		await page.goto( `/wp-admin/post.php?post=${ own }&action=edit` );
		const box = page.locator( '#fotogrids-gallery-albums-root' );
		await expect( box.locator( '.fotogrids-album-assignment' ) ).toBeVisible( { timeout: 15000 } );

		const data = await page.evaluate( () =>
			( window as unknown as {
				fotogridsAlbumAssignment: {
					allAlbums: { id: number }[];
					assignedAlbums: Record< string, unknown >[];
				};
			} ).fotogridsAlbumAssignment
		);
		const listed = data.allAlbums.map( ( a ) => Number( a.id ) );
		expect( listed ).toContain( ownAlbum );
		expect( listed ).not.toContain( privateAlbum );
		expect( listed ).not.toContain( placedIn );
		expect( await page.content() ).not.toContain( `Admin private album ${ stamp }` );

		expect( data.assignedAlbums ).toHaveLength( 1 );
		expect( data.assignedAlbums[ 0 ] ).toMatchObject( { ID: placedIn, editable: false } );
		expect( Object.keys( data.assignedAlbums[ 0 ] ) ).not.toContain( 'post_password' );

		const locked = box.locator( '.fotogrids-assigned-album', { hasText: `Admin album holding it ${ stamp }` } );
		await expect( locked ).toBeVisible();
		await expect( locked.locator( 'button' ) ).toHaveCount( 0 );
	} );

	test( 'adds the gallery to an own album and removes it again', { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		const stamp = Date.now();
		const own = gallery( `Author gallery ${ stamp }`, AUTHOR, 'draft' );
		const ownAlbum = emptyAlbum( `Author album ${ stamp }`, AUTHOR, 'draft' );

		await page.goto( `/wp-admin/post.php?post=${ own }&action=edit` );
		const box = page.locator( '#fotogrids-gallery-albums-root' );
		await box.locator( '.fotogrids-search-input' ).fill( `Author album ${ stamp }` );

		const added = page.waitForResponse( ( r ) =>
			'POST' === r.request().method() && decodeURIComponent( r.url() ).includes( `/admin/galleries/${ own }/albums` )
		);
		await box.locator( '.fotogrids-albums > *', { hasText: `Author album ${ stamp }` } ).locator( 'button' ).last().click();
		expect( ( await added ).status() ).toBe( 200 );
		expect( albumsOf( own ) ).toEqual( [ ownAlbum ] );

		// apiFetch sends DELETE as POST with X-HTTP-Method-Override.
		const removed = page.waitForResponse( ( r ) =>
			decodeURIComponent( r.url() ).includes( `/admin/galleries/${ own }/albums/${ ownAlbum }` )
		);
		await box.locator( '.fotogrids-assigned-album', { hasText: `Author album ${ stamp }` } ).locator( 'button' ).click();
		expect( ( await removed ).status() ).toBe( 200 );
		expect( albumsOf( own ) ).toEqual( [] );
	} );
} );

test.describe( 'the Galleries box on the album screen', () => {
	test.use( { storageState: storageStateFor( 'author' ) } );

	test( 'lists only galleries the author can edit, and locks the ones it cannot', { tag: [ '@critical', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		const stamp = Date.now();
		const own = gallery( `Author gallery ${ stamp }`, AUTHOR, 'draft' );
		const adminGallery = gallery( `Admin gallery ${ stamp }`, 'admin', 'private' );
		const placed = gallery( `Admin gallery placed ${ stamp }`, 'admin' );
		const ownAlbum = album( [ placed ], {}, `Author album ${ stamp }`, AUTHOR, 'draft' ).id;

		await page.goto( `/wp-admin/post.php?post=${ ownAlbum }&action=edit` );
		await expect( page.locator( '.fotogrids-album-galleries' ) ).toBeVisible( { timeout: 15000 } );

		const data = await page.evaluate( () =>
			( window as unknown as {
				fotogridsAlbumGalleries: {
					allGalleries: { id: number }[];
					assignedGalleries: Record< string, unknown >[];
				};
			} ).fotogridsAlbumGalleries
		);
		const listed = data.allGalleries.map( ( g ) => Number( g.id ) );
		expect( listed ).toContain( own );
		expect( listed ).not.toContain( adminGallery );
		expect( await page.content() ).not.toContain( `Admin gallery ${ stamp }<` );

		expect( data.assignedGalleries ).toHaveLength( 1 );
		expect( data.assignedGalleries[ 0 ] ).toMatchObject( { ID: placed, editable: false } );
		expect( Object.keys( data.assignedGalleries[ 0 ] ) ).not.toContain( 'post_password' );

		const locked = page.locator( '.fotogrids-assigned-galleries .fotogrids-gallery-item', {
			hasText: `Admin gallery placed ${ stamp }`,
		} );
		await expect( locked ).toBeVisible();
		await expect( locked.locator( '.fg-action-button--remove' ) ).toHaveCount( 0 );
		await expect( locked.locator( '.fg-action-button--edit' ) ).toHaveCount( 0 );
	} );
} );

test.describe( 'the Galleries list bulk actions', () => {
	test( 'an author is offered only albums they can edit, and a forged album is refused', { tag: [ '@admin', '@permissions' ] }, async ( {
		browser,
	} ) => {
		const stamp = Date.now();
		const own = gallery( `Bulk author gallery ${ stamp }`, AUTHOR, 'draft' );
		const ownAlbum = emptyAlbum( `Bulk author album ${ stamp }`, AUTHOR, 'draft' );
		const adminAlbum = emptyAlbum( `Bulk admin album ${ stamp }`, 'admin', 'private' );

		const page = await signedIn( browser, 'author' );
		await page.goto( `/wp-admin/edit.php?post_type=fotogrids_gallery&s=${ encodeURIComponent( `Bulk author gallery ${ stamp }` ) }` );

		const options = await page.locator( '#fotogrids-album-select-top option' ).evaluateAll( ( els ) =>
			els.map( ( el ) => Number( ( el as HTMLOptionElement ).value ) ).filter( Boolean )
		);
		expect( options ).toContain( ownAlbum );
		expect( options ).not.toContain( adminAlbum );

		await page.locator( `#cb-select-${ own }` ).check();
		await page.selectOption( '#bulk-action-selector-top', 'assign_to_album' );
		await page.evaluate( ( id ) => {
			const select = document.querySelector( '#fotogrids-album-select-top' ) as HTMLSelectElement;
			select.add( new Option( 'forged', String( id ) ) );
			select.value = String( id );
		}, adminAlbum );
		await Promise.all( [ page.waitForURL( /bulk_error=invalid_album/ ), page.locator( '#doaction' ).click() ] );
		expect( albumsOf( own ) ).toEqual( [] );

		await page.locator( `#cb-select-${ own }` ).check();
		await page.selectOption( '#bulk-action-selector-top', 'assign_to_album' );
		await page.selectOption( '#fotogrids-album-select-top', String( ownAlbum ) );
		await Promise.all( [ page.waitForURL( /bulk_assigned=1/ ), page.locator( '#doaction' ).click() ] );
		expect( albumsOf( own ) ).toEqual( [ ownAlbum ] );

		await page.context().close();
	} );

	test( "an author's bulk assign skips galleries they cannot edit", { tag: [ '@admin', '@permissions' ] }, async ( {
		browser,
	} ) => {
		const stamp = Date.now();
		const ownAlbum = emptyAlbum( `Bulk author album ${ stamp }`, AUTHOR, 'draft' );
		const own = gallery( `Bulk mixed ${ stamp } own`, AUTHOR, 'draft' );
		const adminGallery = gallery( `Bulk mixed ${ stamp } admin`, 'admin' );

		const page = await signedIn( browser, 'author' );
		await page.goto( `/wp-admin/edit.php?post_type=fotogrids_gallery&s=${ encodeURIComponent( `Bulk mixed ${ stamp }` ) }` );
		await page.locator( `#cb-select-${ own }` ).check();
		await page.evaluate( ( id ) => {
			const form = document.querySelector( '#posts-filter' ) as HTMLFormElement;
			const box = document.createElement( 'input' );
			box.type = 'hidden';
			box.name = 'post[]';
			box.value = String( id );
			form.appendChild( box );
		}, adminGallery );
		await page.selectOption( '#bulk-action-selector-top', 'assign_to_album' );
		await page.selectOption( '#fotogrids-album-select-top', String( ownAlbum ) );
		await Promise.all( [ page.waitForURL( /bulk_assigned=1/ ), page.locator( '#doaction' ).click() ] );
		expect( new URL( page.url() ).searchParams.get( 'bulk_errors' ) ).toBe( '1' );

		expect( albumsOf( own ) ).toEqual( [ ownAlbum ] );
		expect( albumsOf( adminGallery ) ).toEqual( [] );

		await page.context().close();
	} );

	test( "an author's Remove from Albums leaves albums they cannot edit alone", { tag: [ '@admin', '@permissions' ] }, async ( {
		browser,
	} ) => {
		const stamp = Date.now();
		const own = gallery( `Bulk remove ${ stamp }`, AUTHOR, 'draft' );
		const ownAlbum = emptyAlbum( `Bulk remove own album ${ stamp }`, AUTHOR, 'draft' );
		const adminAlbum = emptyAlbum( `Bulk remove admin album ${ stamp }`, 'admin' );
		link( own, ownAlbum );
		link( own, adminAlbum );

		const page = await signedIn( browser, 'author' );
		await page.goto( `/wp-admin/edit.php?post_type=fotogrids_gallery&s=${ encodeURIComponent( `Bulk remove ${ stamp }` ) }` );
		await page.locator( `#cb-select-${ own }` ).check();
		await page.selectOption( '#bulk-action-selector-top', 'remove_from_albums' );
		await Promise.all( [ page.waitForURL( /bulk_removed=1/ ), page.locator( '#doaction' ).click() ] );

		expect( albumsOf( own ) ).toEqual( [ adminAlbum ] );

		await page.context().close();
	} );

	test( "an editor bulk-assigns an author's gallery to an administrator's album", { tag: [ '@admin', '@permissions' ] }, async ( {
		browser,
	} ) => {
		const stamp = Date.now();
		const authors = gallery( `Bulk editor ${ stamp }`, AUTHOR, 'draft' );
		const adminAlbum = emptyAlbum( `Bulk editor admin album ${ stamp }`, 'admin', 'private' );

		const page = await signedIn( browser, 'editor' );
		await page.goto( `/wp-admin/edit.php?post_type=fotogrids_gallery&s=${ encodeURIComponent( `Bulk editor ${ stamp }` ) }` );
		await page.locator( `#cb-select-${ authors }` ).check();
		await page.selectOption( '#bulk-action-selector-top', 'assign_to_album' );
		await page.selectOption( '#fotogrids-album-select-top', String( adminAlbum ) );
		await Promise.all( [ page.waitForURL( /bulk_assigned=1/ ), page.locator( '#doaction' ).click() ] );

		expect( albumsOf( authors ) ).toEqual( [ adminAlbum ] );

		await page.context().close();
	} );
} );

test.describe( 'an editor on the album screen', () => {
	test.use( { storageState: storageStateFor( 'editor' ) } );

	test( "sees and controls every gallery in another user's album", { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		const stamp = Date.now();
		const authors = gallery( `Editor view author gallery ${ stamp }`, AUTHOR, 'draft' );
		const adminAlbum = album( [ authors ], {}, `Editor view admin album ${ stamp }`, 'admin', 'private' ).id;

		await page.goto( `/wp-admin/post.php?post=${ adminAlbum }&action=edit` );
		await expect( page.locator( '.fotogrids-album-galleries' ) ).toBeVisible( { timeout: 15000 } );

		const row = page.locator( '.fotogrids-assigned-galleries .fotogrids-gallery-item', {
			hasText: `Editor view author gallery ${ stamp }`,
		} );
		await expect( row.locator( '.fg-action-button--remove' ) ).toHaveCount( 1 );
		await expect( row.locator( '.fg-action-button--edit' ) ).toHaveCount( 1 );
	} );
} );
