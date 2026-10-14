import type { Browser, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, multiGalleryPage, shortcodePage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';

/**
 * Instance IDs on pages served from the render cache, for a logged-out visitor.
 *
 * Scoped: every gallery and post here is created by the spec.
 */

const CACHED = { layout: 'grid', enable_cache: true, enable_statistics: false };

type Instance = { id: string; gallery: string; cols: string; styled: boolean };

/** A post, so the purge removes it. */
function postWith( content: string ): string {
	const encoded = Buffer.from( content, 'utf8' ).toString( 'base64' );

	return wpEval(
		`$id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Cached instances', 'post_content' => base64_decode( '${ encoded }' ) ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo get_permalink( $id );`
	).trim();
}

function instances( page: Page ): Promise< Instance[] > {
	return page.locator( '.fotogrids-collection' ).evaluateAll( ( nodes ) => {
		const styles = [ ...document.querySelectorAll( 'style' ) ].map( ( style ) => style.textContent ?? '' ).join( '\n' );

		return nodes.map( ( node ) => ( {
			id: node.id,
			gallery: ( node as HTMLElement ).dataset.fgGalleryId ?? '',
			cols: getComputedStyle( node ).getPropertyValue( '--fg-cols' ).trim(),
			styled: styles.includes( `#${ node.id }` ),
		} ) );
	} );
}

async function visit( browser: Browser, url: string, storageState?: string ): Promise< Instance[] > {
	const context = await browser.newContext( storageState ? { storageState } : {} );
	const page = await context.newPage();
	await page.goto( url );
	await expect( page.locator( '.fotogrids-collection' ).first() ).toBeVisible();

	const found = await instances( page );
	await context.close();
	return found;
}

function ids( found: Instance[] ): string[] {
	return found.map( ( instance ) => instance.id );
}

function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

test( 'two attribute variants cached on their own pages keep their own IDs and columns on one page', { tag: [ '@cache', '@layout' ] }, async ( {
	browser,
} ) => {
	const { id } = galleryPage( CACHED );
	await visit( browser, shortcodePage( id, 'cols="2"' ).url );
	await visit( browser, shortcodePage( id, 'cols="3"' ).url );

	const url = postWith( `[fotogrids_gallery id="${ id }" cols="2"]\n\n[fotogrids_gallery id="${ id }" cols="3"]` );

	for ( const label of [ 'filling the cache', 'served from the cache' ] ) {
		const found = await visit( browser, url );

		expect( new Set( ids( found ) ).size, `${ label }: one ID twice` ).toBe( 2 );
		expect( found.map( ( instance ) => instance.cols ), `${ label }: columns` ).toEqual( [ '2', '3' ] );
		expect( found.every( ( instance ) => instance.styled ), `${ label }: an instance without styles` ).toBe( true );
	}
} );

test( 'a cached page gives every collection the ID an uncached render gives it', { tag: [ '@cache', '@layout' ] }, async ( {
	browser,
} ) => {
	const first = galleryPage( CACHED );
	const second = galleryPage( { ...CACHED, layout: 'masonry' } );
	await visit( browser, first.url );

	const { url } = multiGalleryPage( [ first.id, second.id, first.id ] );
	const uncached = ids( await visit( browser, url, storageStateFor( 'administrator' ) ) );

	expect( new Set( uncached ).size ).toBe( 3 );
	expect( ids( await visit( browser, url ) ), 'filling the cache' ).toEqual( uncached );
	expect( ids( await visit( browser, url ) ), 'served from the cache' ).toEqual( uncached );
	expect( cachedRows( first.id ), 'one entry per position of the gallery' ).toBe( 2 );
} );

test( 'two blocks of one gallery keep two IDs from the render cache', { tag: [ '@cache', '@layout' ] }, async ( { browser } ) => {
	const { id } = galleryPage( CACHED );
	const block = `<!-- wp:fotogrids/gallery ${ JSON.stringify( { galleryId: id } ) } /-->`;
	const url = postWith( `${ block }\n\n${ block }` );

	for ( const label of [ 'filling the cache', 'served from the cache' ] ) {
		const found = await visit( browser, url );

		expect( found.map( ( instance ) => instance.gallery ) ).toEqual( [ String( id ), String( id ) ] );
		expect( new Set( ids( found ) ).size, `${ label }: one ID twice` ).toBe( 2 );
		expect( found.every( ( instance ) => instance.styled ), `${ label }: an instance without styles` ).toBe( true );
	}
} );

test( 'Load More in the second cached copy of a gallery loads into that copy only', { tag: [ '@cache', '@layout' ] }, async ( {
	browser,
} ) => {
	const { id } = galleryPage( {
		...CACHED,
		pagination_type: 'paginated',
		pagination_method: 'load_more',
		items_per_page: { desktop: 2, tablet: 2, mobile: 2 },
	} );
	const { url } = multiGalleryPage( [ id, id ] );
	await visit( browser, url );

	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto( url );

	const copies = page.locator( `[data-fg-gallery-id="${ id }"]` );
	expect( new Set( await copies.evaluateAll( ( nodes ) => nodes.map( ( node ) => node.id ) ) ).size ).toBe( 2 );
	await expect( copies.nth( 1 ) ).toHaveAttribute( 'data-fg-load-more-bound', '1', { timeout: 15000 } );

	await copies.nth( 1 ).locator( '[data-fg-pagination-trigger="load-more"]' ).click();

	await expect( copies.nth( 1 ).locator( '.fg-item' ) ).toHaveCount( 4 );
	await expect( copies.nth( 0 ).locator( '.fg-item' ) ).toHaveCount( 2 );
	await context.close();
} );

test( 'each copy of a gallery on a cached page counts its own view', { tag: [ '@cache', '@layout' ] }, async ( { browser } ) => {
	const { id } = galleryPage( { layout: 'grid', enable_cache: true } );
	const { url } = multiGalleryPage( [ id, id ] );
	const views = () =>
		Number( wpEval( `$stats = \\FotoGrids\\Statistics::get( 'gallery', ${ id } ); echo $stats ? $stats['views'] : 0;` ).trim() );

	for ( const expected of [ 2, 4 ] ) {
		const context = await browser.newContext();
		const page = await context.newPage();
		const recorded: number[] = [];
		page.on( 'response', ( response ) => {
			if ( decodeURIComponent( response.url() ).includes( '/fotogrids/v1/stats/view' ) ) {
				recorded.push( response.status() );
			}
		} );

		await page.goto( url );
		await expect.poll( () => recorded.length ).toBe( 2 );
		expect( recorded ).toEqual( [ 200, 200 ] );
		await context.close();

		expect( views() ).toBe( expected );
	}
} );
