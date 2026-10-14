import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage, passwordGalleryPage } from './support/collections';
import { wpEval } from './support/roles';

/**
 * Instance IDs of galleries an unlock or an album renders into an open page.
 *
 * Scoped: every gallery, album and post here is created by the spec.
 */

const PASSWORD = 'in-place-secret';
const GRID = { layout: 'grid', columns: { desktop: 3, tablet: 3, mobile: 1 }, enable_statistics: false };
const LOCKED = { ...GRID, password_remember: false };

type Instance = { id: string; kind: 'gate' | 'gallery' | 'album'; cols: string; styled: boolean };

/** A post, so the purge removes it. */
function postWith( content: string ): string {
	const encoded = Buffer.from( content, 'utf8' ).toString( 'base64' );

	return wpEval(
		`$id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'In-place instances', 'post_content' => base64_decode( '${ encoded }' ) ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo get_permalink( $id );`
	).trim();
}

function instances( page: Page ): Promise< Instance[] > {
	return page.locator( '.fotogrids-gate, .fotogrids-collection' ).evaluateAll( ( nodes ) => {
		const styles = [ ...document.querySelectorAll( 'style' ) ].map( ( style ) => style.textContent ?? '' ).join( '\n' );

		return nodes.map( ( node ) => {
			let kind: 'gate' | 'gallery' | 'album' = 'gallery';
			if ( node.classList.contains( 'fotogrids-gate' ) ) {
				kind = 'gate';
			} else if ( node.classList.contains( 'fotogrids-album' ) ) {
				kind = 'album';
			}

			return {
				id: node.id,
				kind,
				cols: getComputedStyle( node ).getPropertyValue( '--fg-cols' ).trim(),
				styled: styles.includes( `#${ node.id }` ),
			};
		} );
	} );
}

function repeatedIds( page: Page ): Promise< string[] > {
	return page.evaluate( () => {
		const seen = new Map< string, number >();
		document.querySelectorAll( '[id^="fg-"]' ).forEach( ( node ) => {
			if ( /^fg-\d+-/.test( node.id ) ) {
				seen.set( node.id, ( seen.get( node.id ) ?? 0 ) + 1 );
			}
		} );

		return [ ...seen ].filter( ( [ , count ] ) => count > 1 ).map( ( [ id ] ) => id );
	} );
}

async function unlock( page: Page, gateId: string ): Promise< void > {
	const form = page.locator( `#${ gateId } .fg-lock-form` );
	await form.locator( '.fg-lock-input' ).fill( PASSWORD );
	await form.locator( '.fg-lock-submit' ).click();
	await expect( page.locator( `.fotogrids-gallery#${ gateId } .fg-item` ).first() ).toBeVisible( { timeout: 15000 } );
}

test( 'unlocking the second of two lock screens keeps that lock screen ID', { tag: [ '@gate', '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = passwordGalleryPage( PASSWORD, LOCKED );
	await page.goto( postWith( `[fotogrids_gallery id="${ id }"]\n\n[fotogrids_gallery id="${ id }"]` ) );

	const gates = ( await instances( page ) ).map( ( instance ) => instance.id );
	expect( gates ).toEqual( [ `fg-${ id }-1`, `fg-${ id }-2` ] );

	await unlock( page, gates[ 1 ] );

	expect( ( await instances( page ) ).map( ( { id: found, kind } ) => `${ kind } ${ found }` ) ).toEqual( [
		`gate ${ gates[ 0 ] }`,
		`gallery ${ gates[ 1 ] }`,
	] );
	expect( await repeatedIds( page ) ).toEqual( [] );

	await unlock( page, gates[ 0 ] );

	const unlocked = await instances( page );
	expect( unlocked.map( ( { id: found, kind } ) => `${ kind } ${ found }` ) ).toEqual( [
		`gallery ${ gates[ 0 ] }`,
		`gallery ${ gates[ 1 ] }`,
	] );
	expect( unlocked.map( ( instance ) => instance.cols ) ).toEqual( [ '3', '3' ] );
	expect( unlocked.every( ( instance ) => instance.styled ), 'an instance without styles' ).toBe( true );
	expect( await repeatedIds( page ) ).toEqual( [] );
} );

function inAlbum( galleryId: number, albumInstanceId: string ): string {
	return `fg-${ galleryId }-a${ albumInstanceId.split( '-' ).pop() }`;
}

test( 'a gallery opened in place from an album takes the ID its album gives it, whatever was opened first', { tag: [ '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( GRID );
	const { id: albumId } = album( [ id ], { use_ajax_from_album: true, navigation_show_back_button: true } );
	await page.goto(
		postWith( `[fotogrids_gallery id="${ id }"]\n\n[fotogrids_album id="${ albumId }"]\n\n[fotogrids_album id="${ albumId }"]` )
	);

	const albums = page.locator( `.fotogrids-album[data-fg-album-id="${ albumId }"]` );
	const expected = ( await albums.evaluateAll( ( nodes ) => nodes.map( ( node ) => node.id ) ) ).map( ( albumInstance ) =>
		inAlbum( id, albumInstance )
	);
	const open = async ( n: number ): Promise< string | null > => {
		await albums.nth( n ).locator( `[data-fg-album-ajax-trigger][data-fg-gallery-id="${ id }"]` ).click();
		const swapped = albums.nth( n ).locator( `.fotogrids-gallery[data-fg-gallery-id="${ id }"]` );
		await expect( swapped.locator( '.fg-item' ).first() ).toBeVisible( { timeout: 15000 } );
		return swapped.getAttribute( 'id' );
	};

	expect( await open( 1 ) ).toBe( expected[ 1 ] );
	expect( await open( 0 ) ).toBe( expected[ 0 ] );

	const galleries = ( await instances( page ) ).filter( ( instance ) => 'gallery' === instance.kind );
	expect( galleries.map( ( instance ) => instance.id ) ).toEqual( [ `fg-${ id }-1`, ...expected ] );
	expect( galleries.map( ( instance ) => instance.cols ) ).toEqual( [ '3', '3', '3' ] );
	expect( galleries.every( ( instance ) => instance.styled ), 'an instance without styles' ).toBe( true );
	expect( await repeatedIds( page ) ).toEqual( [] );

	await albums.nth( 0 ).locator( '.fg-back-button' ).click();
	expect( await open( 0 ) ).toBe( expected[ 0 ] );
} );

test( 'a locked gallery opened in place from an album unlocks with the ID it opened with', { tag: [ '@gate' ] }, async ( {
	page,
} ) => {
	const { id } = passwordGalleryPage( PASSWORD, LOCKED );
	const { id: albumId } = album( [ id ], { use_ajax_from_album: true } );
	await page.goto( postWith( `[fotogrids_gallery id="${ id }"]\n\n[fotogrids_album id="${ albumId }"]` ) );

	let unlockRequests = 0;
	let reloads = 0;
	page.on( 'request', ( request ) => {
		if ( decodeURIComponent( request.url() ).includes( `/fotogrids/v1/gallery/${ id }/unlock` ) ) {
			unlockRequests++;
		}
	} );
	page.on( 'framenavigated', ( frame ) => {
		if ( frame === page.mainFrame() ) {
			reloads++;
		}
	} );

	const albumEl = page.locator( '.fotogrids-album' );
	const opened = inAlbum( id, ( await albumEl.getAttribute( 'id' ) ) ?? '' );
	await albumEl.locator( `[data-fg-album-ajax-trigger][data-fg-gallery-id="${ id }"]` ).click();
	const swappedGate = albumEl.locator( `.fotogrids-gate[data-fg-gallery-id="${ id }"]` );
	await expect( swappedGate ).toBeVisible( { timeout: 15000 } );
	await expect( swappedGate ).toHaveAttribute( 'id', opened );

	await unlock( page, opened );
	await page.waitForLoadState( 'networkidle' );

	expect( unlockRequests, 'unlock requests' ).toBe( 1 );
	expect( reloads, 'page reloads' ).toBe( 0 );

	expect(
		( await instances( page ) ).filter( ( instance ) => 'album' !== instance.kind ).map( ( { id: found, kind } ) => `${ kind } ${ found }` )
	).toEqual( [ `gate fg-${ id }-1`, `gallery ${ opened }` ] );
	expect( await repeatedIds( page ) ).toEqual( [] );
} );
