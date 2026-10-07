import type { Browser } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { wpEval } from './support/roles';

/**
 * A cached render keeps the album the visitor came from.
 *
 * A gallery reached from an album carries `?fg_via=<album id>`, and its
 * header links back to that album. The render cache is partitioned by it, so
 * one album's back link is never replayed to a visitor arriving from another.
 *
 * Scoped: every collection here is created by the spec.
 */

/** Render cache rows held for a gallery. */
function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

/** The album a guest's gallery header links back to, or null when there is none. */
async function backAlbum( browser: Browser, url: string ): Promise< number | null > {
	const guest = await browser.newContext();
	const page = await guest.newPage();
	await page.goto( url );

	const header = page.locator( '.fg-collection-header' );
	const album = ( await header.count() ) > 0 ? Number( await header.first().getAttribute( 'data-fg-via-album' ) ) : null;

	await guest.close();
	return album;
}

function via( url: string, albumId: number ): string {
	return `${ url }${ url.includes( '?' ) ? '&' : '?' }fg_via=${ albumId }`;
}

test( 'each fg_via shows its own album once the render is cached', { tag: [ '@critical', '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const navigation = { navigation_show_breadcrumbs: true, navigation_show_back_button: true };
	const albumA = album( [ gallery.id ], navigation );
	const albumB = album( [ gallery.id ], navigation );

	expect( await backAlbum( browser, via( gallery.url, albumA.id ) ) ).toBe( albumA.id );
	expect( await backAlbum( browser, via( gallery.url, albumB.id ) ), 'album A was replayed to a visitor from album B' ).toBe( albumB.id );
	expect( await backAlbum( browser, gallery.url ), 'an album was replayed to a direct visitor' ).toBeNull();
	expect( await backAlbum( browser, via( gallery.url, albumA.id ) ) ).toBe( albumA.id );

	expect( cachedRows( gallery.id ) ).toBe( 3 );
} );

test( 'an fg_via naming no parent album shares one cache entry', { tag: [ '@critical', '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const navigation = { navigation_show_breadcrumbs: true, navigation_show_back_button: true };
	const albumA = album( [ gallery.id ], navigation );
	album( [ gallery.id ], navigation );

	expect( await backAlbum( browser, via( gallery.url, albumA.id ) ) ).toBe( albumA.id );
	expect( await backAlbum( browser, via( gallery.url, 999990 ) ) ).toBeNull();
	expect( await backAlbum( browser, via( gallery.url, 999991 ) ) ).toBeNull();

	expect( cachedRows( gallery.id ) ).toBe( 2 );
} );
