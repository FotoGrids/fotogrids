import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { storageStateFor } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Galleries appended to an album take the next position, whichever screen adds them.
 *
 * Positions are read from the album screen's localized data rather than from the
 * rendered order: tied positions usually still list in insertion order.
 */

type Placed = { id: number; position: number };

/** Galleries this spec owns, titled so a search finds exactly one. */
function galleries( prefix: string, names: string[] ): Record< string, number > {
	return Object.fromEntries(
		names.map( ( name ) => [
			name,
			galleryPage( {}, undefined, `${ prefix } ${ name }` ).id,
		] )
	);
}

async function openAlbum( page: Page, albumId: number ): Promise< void > {
	await page.goto( `/wp-admin/post.php?post=${ albumId }&action=edit` );
	await expect( page.locator( '.fotogrids-album-galleries' ) ).toBeVisible( {
		timeout: 15000,
	} );
}

/** The album's galleries as stored, in the order the album lists them. */
async function placed( page: Page, albumId: number ): Promise< Placed[] > {
	await openAlbum( page, albumId );
	return page.evaluate( () =>
		(
			window as unknown as {
				fotogridsAlbumGalleries: {
					assignedGalleries: { ID: number; position: string }[];
				};
			}
		 ).fotogridsAlbumGalleries.assignedGalleries.map( ( g ) => ( {
			id: Number( g.ID ),
			position: Number( g.position ),
		} ) )
	);
}

test( 'galleries added one after another on the album screen take positions 0, 1, 2', { tag: '@admin' }, async ( {
	page,
} ) => {
	const prefix = `Order ${ Date.now() }`;
	const ids = galleries( prefix, [ 'Alpha', 'Bravo', 'Charlie' ] );
	const { id: albumId } = album( [] );

	await openAlbum( page, albumId );
	for ( const name of [ 'Alpha', 'Bravo', 'Charlie' ] ) {
		await page.locator( '.fotogrids-available-section .fotogrids-search-input' ).fill( `${ prefix } ${ name }` );
		const saved = page.waitForResponse( ( r ) =>
			/admin\/albums\/\d+\/galleries(?:[^/]|$)/.test( decodeURIComponent( r.url() ) )
		);
		await page
			.locator( '.fotogrids-available-galleries .fotogrids-gallery-item', { hasText: `${ prefix } ${ name }` } )
			.locator( '.fg-action-button--add' )
			.click();
		expect( ( await saved ).ok() ).toBe( true );
	}

	expect( await placed( page, albumId ) ).toEqual( [
		{ id: ids.Alpha, position: 0 },
		{ id: ids.Bravo, position: 1 },
		{ id: ids.Charlie, position: 2 },
	] );
	await expect( page.locator( '.fotogrids-assigned-galleries .fotogrids-gallery-item' ) ).toHaveText( [
		new RegExp( `${ prefix } Alpha` ),
		new RegExp( `${ prefix } Bravo` ),
		new RegExp( `${ prefix } Charlie` ),
	] );
} );

test( 'galleries assigned from their own edit screens are appended in turn', { tag: '@admin' }, async ( {
	page,
} ) => {
	const prefix = `Assign ${ Date.now() }`;
	const ids = galleries( prefix, [ 'Echo', 'Foxtrot', 'Golf' ] );
	const albumTitle = `${ prefix } album`;
	const { id: albumId } = album( [], {}, albumTitle );

	for ( const name of [ 'Echo', 'Foxtrot', 'Golf' ] ) {
		await page.goto( `/wp-admin/post.php?post=${ ids[ name ] }&action=edit` );
		const box = page.locator( '#fotogrids-gallery-albums-root' );
		await box.locator( '.fotogrids-search-input' ).fill( albumTitle );
		const saved = page.waitForResponse( ( r ) =>
			decodeURIComponent( r.url() ).includes( `/admin/galleries/${ ids[ name ] }/albums` )
		);
		await box.locator( '.fotogrids-albums > *', { hasText: albumTitle } ).locator( 'button' ).last().click();
		expect( ( await saved ).ok() ).toBe( true );
	}

	expect( await placed( page, albumId ) ).toEqual( [
		{ id: ids.Echo, position: 0 },
		{ id: ids.Foxtrot, position: 1 },
		{ id: ids.Golf, position: 2 },
	] );
} );

test( 'a bulk assign appends after the gallery an album already holds', { tag: '@admin' }, async ( {
	page,
} ) => {
	const prefix = `Bulk ${ Date.now() }`;
	const ids = galleries( prefix, [ 'Hotel', 'India', 'Juliet' ] );
	const { id: albumId } = album( [ ids.Hotel ] );

	await page.goto( `/wp-admin/edit.php?post_type=fotogrids_gallery&s=${ encodeURIComponent( prefix ) }` );
	await page.locator( `#cb-select-${ ids.India }` ).check();
	await page.locator( `#cb-select-${ ids.Juliet }` ).check();
	await page.selectOption( '#bulk-action-selector-top', 'assign_to_album' );
	await page.selectOption( '#fotogrids-album-select-top', String( albumId ) );
	await Promise.all( [ page.waitForURL( /bulk_assigned=2/ ), page.locator( '#doaction' ).click() ] );

	const rows = await placed( page, albumId );
	expect( rows[ 0 ] ).toEqual( { id: ids.Hotel, position: 0 } );
	expect( rows.slice( 1 ).map( ( r ) => r.position ).sort( ( a, b ) => a - b ) ).toEqual( [ 1, 2 ] );
	expect( rows.slice( 1 ).map( ( r ) => r.id ).sort( ( a, b ) => a - b ) ).toEqual( [ ids.India, ids.Juliet ].sort( ( a, b ) => a - b ) );
} );
