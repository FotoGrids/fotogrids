import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage, multiGalleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { wpEval } from './support/roles';

/**
 * IDs inside loader SVGs stay unique when one image renders more than once on a page.
 *
 * Scoped: every gallery, album and post here is created by the spec.
 */

const RING = { layout: 'grid', loading_icon: '90-ring', enable_statistics: false };
const PER_PAGE = ( n: number ) => ( { desktop: n, tablet: n, mobile: n } );

/** A post, so the purge removes it. */
function postWith( content: string ): string {
	const encoded = Buffer.from( content, 'utf8' ).toString( 'base64' );

	return wpEval(
		`$id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Loader IDs', 'post_content' => base64_decode( '${ encoded }' ) ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo get_permalink( $id );`
	).trim();
}

type LoaderIds = { count: number; repeated: string[]; foreign: string[] };

/** Every ID in a loader SVG, those used twice, and `url(#…)` references that resolve outside their own SVG. */
function loaderIds( page: Page ): Promise< LoaderIds > {
	return page.evaluate( () => {
		const svgs = [ ...document.querySelectorAll( '.fg-item-loader svg, .fg-pagination__loader svg' ) ];
		const seen = new Map< string, number >();
		const foreign: string[] = [];

		svgs.forEach( ( svg ) => {
			svg.querySelectorAll( '[id]' ).forEach( ( node ) => seen.set( node.id, ( seen.get( node.id ) ?? 0 ) + 1 ) );
			svg.querySelectorAll( '*' ).forEach( ( node ) => {
				[ ...node.attributes ].forEach( ( attribute ) => {
					const ref = /url\(#([^)]+)\)/.exec( attribute.value );
					if ( ref && ! svg.contains( document.getElementById( ref[ 1 ] ) ) ) {
						foreign.push( ref[ 1 ] );
					}
				} );
			} );
		} );

		return {
			count: [ ...seen.values() ].reduce( ( total, n ) => total + n, 0 ),
			repeated: [ ...seen ].filter( ( [ , n ] ) => n > 1 ).map( ( [ id ] ) => id ),
			foreign,
		};
	} );
}

async function expectUnique( page: Page, minimum: number ): Promise< void > {
	const found = await loaderIds( page );
	expect( found.count, 'loader IDs on the page' ).toBeGreaterThanOrEqual( minimum );
	expect( found.repeated, 'IDs used by more than one loader' ).toEqual( [] );
	expect( found.foreign, 'loader references resolving into another loader' ).toEqual( [] );
}

async function loadMore( root: Locator, expected: number ): Promise< void > {
	await root.locator( '.fg-pagination__load-more' ).click();
	await expect( root.locator( '.fg-item' ) ).toHaveCount( expected, { timeout: 15000 } );
}

test( 'the same gallery embedded twice', { tag: [ '@layout' ] }, async ( { page } ) => {
	const { id } = galleryPage( RING );
	await page.goto( multiGalleryPage( [ id, id ] ).url );
	await expect( page.locator( `[data-fg-gallery-id="${ id }"]` ) ).toHaveCount( 2 );

	await expectUnique( page, 10 );
} );

test( 'one image in two galleries', { tag: [ '@layout' ] }, async ( { page } ) => {
	const items = fixture< number[] >( 'F-small', 'items' );
	const { id: first } = galleryPage( RING, items.slice( 0, 3 ) );
	const { id: second } = galleryPage( RING, items.slice( 1 ) );
	await page.goto( multiGalleryPage( [ first, second ] ).url );
	await expect( page.locator( '.fotogrids-gallery .fg-item' ) ).toHaveCount( 7 );

	await expectUnique( page, 7 );
} );

test( 'items added by Load More, in two copies of one gallery', { tag: [ '@layout' ] }, async ( { page } ) => {
	const { id } = galleryPage(
		{ ...RING, pagination_type: 'paginated', pagination_method: 'load_more', items_per_page: PER_PAGE( 4 ) },
		fixture< number[] >( 'F-large', 'items' ).slice( 0, 12 )
	);
	await page.goto( multiGalleryPage( [ id, id ] ).url );
	const copies = page.locator( `[data-fg-gallery-id="${ id }"]` );
	await expect( copies ).toHaveCount( 2 );

	await loadMore( copies.nth( 1 ), 8 );
	await loadMore( copies.nth( 0 ), 8 );
	await loadMore( copies.nth( 0 ), 12 );

	await expectUnique( page, 20 );
} );

test( 'a gallery opened in place from an album, next to the same gallery and a second copy of the album', { tag: [ '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( RING );
	const { id: other } = galleryPage( RING, fixture< number[] >( 'F-small', 'items' ).slice( 0, 2 ) );
	const { id: albumId } = album( [ id, other ], { loading_icon: '90-ring', use_ajax_from_album: true } );
	const url = postWith( `[fotogrids_gallery id="${ id }"]\n\n[fotogrids_album id="${ albumId }"]\n\n[fotogrids_album id="${ albumId }"]` );

	await page.goto( url );
	const albums = page.locator( `.fotogrids-album[data-fg-album-id="${ albumId }"]` );
	await expect( albums ).toHaveCount( 2 );
	await expectUnique( page, 5 );

	for ( const n of [ 0, 1 ] ) {
		await albums.nth( n ).locator( `[data-fg-album-ajax-trigger][data-fg-gallery-id="${ id }"]` ).click();
		await expect( albums.nth( n ).locator( `.fotogrids-gallery[data-fg-gallery-id="${ id }"] .fg-item` ).first() ).toBeVisible( {
			timeout: 15000,
		} );
	}

	await expectUnique( page, 15 );
} );
