import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { wpCli, wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';
import { execFileSync } from 'child_process';

/**
 * The loading-icon map reaches the page intact on a classic theme, through the
 * block and the shortcode, on a fresh render and on a render-cache replay.
 *
 * Image requests are held so every item stays in its loading state and the
 * started loader animations can be counted.
 *
 * Serial: switches the active theme for the whole site.
 */

test.describe.configure( { mode: 'serial' } );

const CLASSIC_THEME = 'twentytwentyone';

let savedTheme = '';

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** A post rendering the gallery through its block. */
function blockPost( galleryId: number ): string {
	return wpEval(
		`$id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Loading icon block', 'post_content' => '<!-- wp:fotogrids/gallery {"galleryId":${ galleryId }} /-->' ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo get_permalink( $id );`
	).trim();
}

/**
 * Icon names in the page map, and how many items have a started loader, once
 * DOMContentLoaded has passed. Navigation cannot wait for `load` while images
 * are held.
 */
async function loaderState(
	page: Page,
	url: string,
	galleryId: number
): Promise< { icons: string[]; items: number; started: number } > {
	await page.goto( url, { waitUntil: 'domcontentloaded' } );
	await new GalleryRender( page, galleryId ).waitFor();

	return page.evaluate( () => {
		const globals = window as unknown as {
			fgLoaderHandles?: WeakMap< Element, unknown >;
			fotogridsLoadingIcons?: Record< string, unknown >;
		};
		const items = Array.from( document.querySelectorAll( '.fg-item' ) );
		const handles = globals.fgLoaderHandles;

		return {
			icons: Object.keys( globals.fotogridsLoadingIcons || {} ),
			items: items.length,
			started: items.filter( ( item ) => !! handles && handles.has( item ) ).length,
		};
	} );
}

test.beforeAll( () => {
	savedTheme = wp( [ 'theme', 'list', '--status=active', '--field=name' ] );
	if ( ! wp( [ 'theme', 'list', '--field=name' ] ).split( '\n' ).includes( CLASSIC_THEME ) ) {
		wp( [ 'theme', 'install', CLASSIC_THEME ] );
	}
	if ( CLASSIC_THEME !== savedTheme ) {
		wp( [ 'theme', 'activate', CLASSIC_THEME ] );
	}
} );

test.afterAll( () => {
	if ( savedTheme && CLASSIC_THEME !== savedTheme ) {
		wp( [ 'theme', 'activate', savedTheme ] );
	}
} );

test.beforeEach( async ( { page } ) => {
	await page.route( /\.(jpe?g|png|webp|gif|avif)(\?|$)/, () => {} );
} );

test( 'a gallery block starts its loaders on a fresh render and from the cache', { tag: [ '@layout', '@cache' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { enable_cache: true } );
	const url = blockPost( id );

	for ( const pass of [ 'fresh render', 'cache replay' ] ) {
		const state = await loaderState( page, url, id );

		expect( state.icons, pass ).toContain( '12-dots' );
		expect( state.items, pass ).toBeGreaterThan( 0 );
		expect( state.started, pass ).toBe( state.items );
	}
} );

test( 'a gallery shortcode starts its loaders on a fresh render and from the cache', { tag: [ '@layout', '@cache' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( { enable_cache: true, loading_icon: '3-dots-bounce' } );

	for ( const pass of [ 'fresh render', 'cache replay' ] ) {
		const state = await loaderState( page, url, id );

		expect( state.icons, pass ).toContain( '3-dots-bounce' );
		expect( state.items, pass ).toBeGreaterThan( 0 );
		expect( state.started, pass ).toBe( state.items );
	}
} );
