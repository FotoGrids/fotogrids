import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';
import { getOption, setOption } from './support/site';

/**
 * The Load Google Fonts setting applies to a gallery served from the render
 * cache, in both directions.
 *
 * Every visit is anonymous, so the cache is in play. Google is never
 * contacted: the stylesheet request is answered locally and the assertions
 * count the `<link>` the page printed.
 *
 * Serial: the setting is a site option, restored after each test.
 */

test.describe.configure( { mode: 'serial' } );

const OPTION = 'fotogrids_allow_google_fonts';

let saved: string | null;

/** Load a gallery and count the Google Fonts stylesheets on the page. */
async function fontStylesheetCount( page: Page, url: string, galleryId: number ): Promise< number > {
	await page.goto( url );
	await new GalleryRender( page, galleryId ).waitFor();

	return page.locator( 'link[rel="stylesheet"][href*="fonts.googleapis.com"]' ).count();
}

function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

test.beforeEach( async ( { page } ) => {
	saved = getOption( OPTION );
	setOption( OPTION, '1' );

	await page.route( /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, ( route ) =>
		route.fulfill( { status: 200, contentType: 'text/css', body: '' } )
	);
} );

test.afterEach( () => {
	setOption( OPTION, saved );
} );

test( 'turning Load Google Fonts off stops a cached gallery loading them', { tag: [ '@cache', '@settings' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( { enable_cache: true, caption_title_font_family: 'Roboto' } );

	expect( await fontStylesheetCount( page, url, id ), 'filling the cache' ).toBe( 1 );

	setOption( OPTION, '0' );
	expect( await fontStylesheetCount( page, url, id ), 'from the cache, setting off' ).toBe( 0 );

	setOption( OPTION, '1' );
	expect( await fontStylesheetCount( page, url, id ), 'from the cache, setting back on' ).toBe( 1 );
} );

test( 'turning Load Google Fonts on reaches a gallery cached while it was off', { tag: [ '@cache', '@settings' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( { enable_cache: true, caption_title_font_family: 'Roboto' } );

	setOption( OPTION, '0' );
	expect( await fontStylesheetCount( page, url, id ), 'filling the cache, setting off' ).toBe( 0 );
	expect( cachedRows( id ), 'the gallery was not cached' ).toBe( 1 );

	setOption( OPTION, '1' );
	expect( await fontStylesheetCount( page, url, id ), 'from the cache, setting on' ).toBe( 1 );
} );
