import type { Browser, BrowserContextOptions } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';

/**
 * A cached render keeps the album the visitor came from.
 *
 * A gallery reached from an album carries `?fg_via=<album id>`, and its
 * header links back to that album. The render cache is partitioned by it, so
 * one album's back link is never replayed to a visitor arriving from another.
 *
 * Scoped: every collection here is created by the spec.
 */

const NAVIGATION = { navigation_show_breadcrumbs: true, navigation_show_back_button: true };

/** Render cache rows held for a gallery. */
function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

function permalink( postId: number ): string {
	return wpEval( `echo get_permalink( ${ postId } );` ).trim();
}

/** The album a gallery header links back to, or null when there is none. */
async function backAlbum( browser: Browser, url: string, options: BrowserContextOptions = {} ): Promise< number | null > {
	const visitor = await browser.newContext( options );
	const page = await visitor.newPage();
	await page.goto( url );

	const header = page.locator( '.fg-collection-header' );
	const album = ( await header.count() ) > 0 ? Number( await header.first().getAttribute( 'data-fg-via-album' ) ) : null;

	await visitor.close();
	return album;
}

/** The URLs a guest's page lists in its BreadcrumbList schema. */
async function schemaTrail( browser: Browser, url: string ): Promise< string[] > {
	const guest = await browser.newContext();
	const page = await guest.newPage();
	await page.goto( url );

	const trail = await page.evaluate( () =>
		[ ...document.querySelectorAll( 'script[type="application/ld+json"]' ) ]
			.map( ( script ) => JSON.parse( script.textContent ?? '{}' ) )
			.filter( ( doc ) => 'BreadcrumbList' === doc[ '@type' ] )
			.flatMap( ( doc ) => ( doc.itemListElement ?? [] ).map( ( entry: { item?: unknown } ) => String( entry.item ?? '' ) ) )
	);

	await guest.close();
	return trail;
}

function via( url: string, albumId: number ): string {
	return `${ url }${ url.includes( '?' ) ? '&' : '?' }fg_via=${ albumId }`;
}

test( 'each fg_via shows its own album once the render is cached', { tag: [ '@critical', '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const albumA = album( [ gallery.id ], NAVIGATION );
	const albumB = album( [ gallery.id ], NAVIGATION );

	expect( await backAlbum( browser, via( gallery.url, albumA.id ) ) ).toBe( albumA.id );
	expect( await backAlbum( browser, via( gallery.url, albumB.id ) ), 'album A was replayed to a visitor from album B' ).toBe( albumB.id );
	expect( await backAlbum( browser, gallery.url ), 'an album was replayed to a direct visitor' ).toBeNull();
	expect( await backAlbum( browser, via( gallery.url, albumA.id ) ) ).toBe( albumA.id );

	expect( cachedRows( gallery.id ) ).toBe( 3 );
} );

test( 'an fg_via naming no parent album shares one cache entry', { tag: [ '@critical', '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const albumA = album( [ gallery.id ], NAVIGATION );
	album( [ gallery.id ], NAVIGATION );

	expect( await backAlbum( browser, via( gallery.url, albumA.id ) ) ).toBe( albumA.id );
	expect( await backAlbum( browser, via( gallery.url, 999990 ) ) ).toBeNull();
	expect( await backAlbum( browser, via( gallery.url, 999991 ) ) ).toBeNull();

	expect( cachedRows( gallery.id ) ).toBe( 2 );
} );

test( 'the gallery view page keeps the album a visitor came from', { tag: [ '@cache', '@layout' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const albumA = album( [ gallery.id ], NAVIGATION );
	const albumB = album( [ gallery.id ], NAVIGATION );
	const view = permalink( gallery.id );

	expect( await backAlbum( browser, via( view, albumA.id ) ) ).toBe( albumA.id );
	expect( await backAlbum( browser, via( view, albumB.id ) ) ).toBe( albumB.id );
	expect( await backAlbum( browser, view ) ).toBeNull();
	expect( await backAlbum( browser, via( view, albumA.id ) ) ).toBe( albumA.id );
} );

test( 'the breadcrumb schema names the album the visitor came from', { tag: [ '@cache', '@layout' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const albumA = album( [ gallery.id ], NAVIGATION );
	const albumB = album( [ gallery.id ], NAVIGATION );

	expect( await schemaTrail( browser, via( gallery.url, albumA.id ) ) ).toContain( albumA.view );
	const fromB = await schemaTrail( browser, via( gallery.url, albumB.id ) );
	expect( fromB ).toContain( albumB.view );
	expect( fromB ).not.toContain( albumA.view );
} );

test( 'with one parent album, a direct visit and any fg_via show that album', { tag: [ '@cache', '@layout' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const only = album( [ gallery.id ], { ...NAVIGATION, navigation_show_breadcrumbs_on_direct_visit: true } );

	expect( await backAlbum( browser, gallery.url ) ).toBe( only.id );
	expect( await backAlbum( browser, via( gallery.url, only.id ) ) ).toBe( only.id );
	expect( await backAlbum( browser, via( gallery.url, 999990 ) ) ).toBe( only.id );

	expect( cachedRows( gallery.id ) ).toBe( 2 );
} );

test( 'an administrator sees each album live and leaves nothing cached', { tag: [ '@cache', '@permissions' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const albumA = album( [ gallery.id ], NAVIGATION );
	const albumB = album( [ gallery.id ], NAVIGATION );
	const admin = { storageState: storageStateFor( 'administrator' ) };

	expect( await backAlbum( browser, via( gallery.url, albumA.id ), admin ) ).toBe( albumA.id );
	expect( await backAlbum( browser, via( gallery.url, albumB.id ), admin ) ).toBe( albumB.id );

	expect( cachedRows( gallery.id ) ).toBe( 0 );
} );

test( 'opening a gallery from each album view page lands on that album\'s back link', { tag: [ '@cache', '@layout' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const linked = { ...NAVIGATION, use_ajax_from_album: false };
	const albums = [ album( [ gallery.id ], linked ), album( [ gallery.id ], linked ) ];

	for ( const parent of [ ...albums, albums[ 0 ] ] ) {
		const guest = await browser.newContext();
		const page = await guest.newPage();
		await page.goto( parent.view );
		await page.locator( `a[href*="fg_via=${ parent.id }"]` ).first().click();
		await expect( page ).toHaveURL( new RegExp( `fg_via=${ parent.id }` ) );

		const header = page.locator( '.fg-collection-header' ).first();
		await expect( header ).toHaveAttribute( 'data-fg-via-album', String( parent.id ) );
		await expect( page.locator( '.fg-back-button' ).first() ).toHaveAttribute( 'href', parent.view );

		await guest.close();
	}
} );
