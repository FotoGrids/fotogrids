import { execFileSync } from 'child_process';
import type { Browser, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from './test';
import { setSettings } from './collections';
import { apiAs, storageStateFor, wpCli, wpEval } from './roles';

/**
 * What a visitor sees of a gallery's album header, and the admin actions that
 * change it, for the specs that check album changes against the render cache.
 */

export const NAVIGATION = {
	navigation_show_breadcrumbs: true,
	navigation_show_back_button: true,
	navigation_show_breadcrumbs_on_direct_visit: true,
};

export type Header = {
	album: number | null;
	back: string | null;
	href: string | null;
	trail: string[];
};

export function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/** Render cache rows held for a gallery. */
export function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

export function permalink( postId: number ): string {
	return wpEval( `echo get_permalink( ${ postId } );` ).trim();
}

/** What a logged-out visitor's page shows of the gallery's album. */
export async function header( browser: Browser, url: string ): Promise< Header > {
	// An explicit empty session: a spec's test.use( storageState ) also applies to browser.newContext().
	const visitor = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
	const page = await visitor.newPage();
	await page.goto( url );

	const wrapper = page.locator( '.fg-collection-header' );
	const back = page.locator( '.fg-back-button' );
	const hasHeader = ( await wrapper.count() ) > 0;
	const hasBack = ( await back.count() ) > 0;

	const result: Header = {
		album: hasHeader ? Number( await wrapper.first().getAttribute( 'data-fg-via-album' ) ) : null,
		back: hasBack ? ( await back.first().innerText() ).trim() : null,
		href: hasBack ? await back.first().getAttribute( 'href' ) : null,
		trail: await page.evaluate( () =>
			[ ...document.querySelectorAll( 'script[type="application/ld+json"]' ) ]
				.map( ( script ) => JSON.parse( script.textContent ?? '{}' ) )
				.filter( ( doc ) => 'BreadcrumbList' === doc[ '@type' ] )
				.flatMap( ( doc ) =>
					( doc.itemListElement ?? [] ).map( ( entry: { name?: unknown; item?: unknown } ) => `${ entry.name } ${ entry.item ?? '' }`.trim() )
				)
		),
	};

	await visitor.close();
	return result;
}

/** A visitor's render of the gallery, cached. */
export async function cached( browser: Browser, url: string, galleryId: number ): Promise< Header > {
	await header( browser, url );
	const seen = await header( browser, url );
	expect( cachedRows( galleryId ), 'the visitor render was not cached' ).toBe( 1 );
	return seen;
}

/**
 * What the next visitor is served, and what an uncached render of the same
 * page shows. `enable_cache` is outside the cache key, so turning it off for
 * one request renders the reference without touching the entry under test.
 */
export async function servedAndUncached( browser: Browser, gallery: { id: number; url: string } ): Promise< [ Header, Header ] > {
	const served = await header( browser, gallery.url );
	setSettings( gallery.id, { enable_cache: false } );
	const uncached = await header( browser, gallery.url );
	setSettings( gallery.id, { enable_cache: true } );
	return [ served, uncached ];
}

export async function rest(
	playwright: PlaywrightWorkerArgs[ 'playwright' ],
	method: 'post' | 'delete',
	path: string,
	data?: Record< string, unknown >
): Promise< void > {
	const admin = await apiAs( playwright, 'administrator' );
	const response = await admin.context[ method ]( `/?rest_route=${ encodeURIComponent( `/fotogrids/v1${ path }` ) }`, {
		headers: { 'X-WP-Nonce': admin.nonce },
		...( data ? { data } : {} ),
	} );
	expect( response.status(), `${ method } ${ path }` ).toBe( 200 );
	await admin.context.dispose();
}

/** Save an album through the admin-ajax action its editor uses. */
export async function saveInEditor( browser: Browser, albumId: number, fields: Record< string, string > ): Promise< void > {
	const context = await browser.newContext( { storageState: storageStateFor( 'administrator' ) } );
	const page = await context.newPage();
	await page.goto( `/wp-admin/post.php?post=${ albumId }&action=edit` );
	const nonce = await page.locator( '#fotogrids_meta_box_nonce' ).first().inputValue();

	const response = await page.request.post( '/wp-admin/admin-ajax.php', {
		form: { action: 'fotogrids_save_collection', nonce, post_id: String( albumId ), ...fields },
	} );
	expect( ( await response.json() ).success, 'the album save failed' ).toBe( true );

	await context.close();
}
