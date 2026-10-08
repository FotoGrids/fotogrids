import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';

/**
 * A gallery served from the render cache loads the same Google Fonts
 * stylesheet as the render that filled the cache.
 *
 * Every visit is anonymous, so the cache is in play. Google is never
 * contacted: the stylesheet request is answered locally and the assertions
 * read the `<link>` the page printed.
 *
 * Scoped: every gallery here is created by the spec.
 */

const ROBOTO_AND_LATO = {
	enable_cache: true,
	caption_title_font_family: 'Roboto',
	caption_description_font_family: 'Lato',
};

/** Render cache rows held for a gallery. */
function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

/** A post whose content is given verbatim. Not a page: pages join the theme's menu. */
function postWith( content: string ): string {
	return wpEval(
		`$id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Google Fonts post', 'post_content' => '${ content }' ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo get_permalink( $id );`
	).trim();
}

/** Load a URL and return the family list of every Google Fonts stylesheet on it. */
async function fontStylesheets( page: Page, url: string, galleryIds: number[] ): Promise< string[][] > {
	await page.goto( url );

	for ( const id of galleryIds ) {
		await new GalleryRender( page, id ).waitFor();
	}

	const hrefs = await page
		.locator( 'link[rel="stylesheet"][href*="fonts.googleapis.com"]' )
		.evaluateAll( ( links ) => links.map( ( link ) => ( link as HTMLLinkElement ).href ) );

	return hrefs.map( ( href ) =>
		new URL( href ).searchParams
			.getAll( 'family' )
			.map( ( family ) => family.split( ':' )[ 0 ] )
			.sort()
	);
}

test.beforeEach( async ( { page } ) => {
	await page.route( /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, ( route ) =>
		route.fulfill( { status: 200, contentType: 'text/css', body: '' } )
	);
} );

test( 'a cached gallery loads its Google Fonts on every visit', { tag: '@cache' }, async ( { page } ) => {
	const { id, url } = galleryPage( ROBOTO_AND_LATO );

	for ( const visit of [ 'filling the cache', 'from the cache', 'from the cache again' ] ) {
		expect( await fontStylesheets( page, url, [ id ] ), visit ).toEqual( [ [ 'Lato', 'Roboto' ] ] );
	}

	expect( cachedRows( id ) ).toBeGreaterThan( 0 );
} );

test( 'galleries sharing a page get one combined stylesheet, cached or not', { tag: '@cache' }, async ( { page } ) => {
	const cached = galleryPage( ROBOTO_AND_LATO );
	const uncached = galleryPage( { enable_cache: false, caption_title_font_family: 'Poppins' } );
	const url = postWith( `[fotogrids_gallery id="${ cached.id }"][fotogrids_gallery id="${ uncached.id }"]` );

	await fontStylesheets( page, cached.url, [ cached.id ] );

	for ( const visit of [ 'first visit', 'second visit' ] ) {
		expect( await fontStylesheets( page, url, [ cached.id, uncached.id ] ), visit ).toEqual( [
			[ 'Lato', 'Poppins', 'Roboto' ],
		] );
	}
} );

test( 'a gallery cached next to one using the same font still loads it on its own', { tag: '@cache' }, async ( {
	page,
} ) => {
	const first = galleryPage( { enable_cache: true, caption_title_font_family: 'Roboto' } );
	const second = galleryPage( { enable_cache: true, caption_title_font_family: 'Roboto' } );
	const shared = postWith( `[fotogrids_gallery id="${ first.id }"][fotogrids_gallery id="${ second.id }"]` );

	await fontStylesheets( page, shared, [ first.id, second.id ] );
	expect( cachedRows( second.id ) ).toBeGreaterThan( 0 );

	expect( await fontStylesheets( page, second.url, [ second.id ] ) ).toEqual( [ [ 'Roboto' ] ] );
} );

test( 'a cached gallery on a system font loads no Google Fonts', { tag: '@cache' }, async ( { page } ) => {
	const { id, url } = galleryPage( { enable_cache: true, caption_title_font_family: 'Arial' } );

	for ( const visit of [ 'filling the cache', 'from the cache' ] ) {
		expect( await fontStylesheets( page, url, [ id ] ), visit ).toEqual( [] );
	}
} );

test( 'the block and the view page load the fonts from the cache too', { tag: '@cache' }, async ( { page } ) => {
	const { id } = galleryPage( ROBOTO_AND_LATO );
	const block = postWith( `<!-- wp:fotogrids/gallery {"galleryId":${ id }} /-->` );
	const view = wpEval( `echo get_permalink( ${ id } );` ).trim();

	for ( const url of [ block, view ] ) {
		for ( const visit of [ 'filling the cache', 'from the cache' ] ) {
			expect( await fontStylesheets( page, url, [ id ] ), `${ url }, ${ visit }` ).toEqual( [ [ 'Lato', 'Roboto' ] ] );
		}
	}
} );
