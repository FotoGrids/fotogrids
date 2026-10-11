import { execFileSync } from 'child_process';
import type { Browser, PlaywrightWorkerArgs } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage, setSettings } from './support/collections';
import { apiAs, storageStateFor, wpCli, wpEval } from './support/roles';

/**
 * A change to an album reaches the cached renders of its galleries.
 *
 * A gallery's header shows its parent album's name, link and navigation
 * settings, and its BreadcrumbList schema names the album. Each change is made
 * after a visitor's render is cached; the next visitor sees it.
 *
 * Scoped: every collection here is created by the test that reads it.
 */

const NAVIGATION = {
	navigation_show_breadcrumbs: true,
	navigation_show_back_button: true,
	navigation_show_breadcrumbs_on_direct_visit: true,
};

type Header = {
	album: number | null;
	back: string | null;
	href: string | null;
	trail: string[];
};

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

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

/** What a logged-out visitor's page shows of the gallery's album. */
async function header( browser: Browser, url: string ): Promise< Header > {
	const visitor = await browser.newContext();
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
async function cached( browser: Browser, url: string, galleryId: number ): Promise< Header > {
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
async function servedAndUncached( browser: Browser, gallery: { id: number; url: string } ): Promise< [ Header, Header ] > {
	const served = await header( browser, gallery.url );
	setSettings( gallery.id, { enable_cache: false } );
	const uncached = await header( browser, gallery.url );
	setSettings( gallery.id, { enable_cache: true } );
	return [ served, uncached ];
}

async function rest(
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
async function saveInEditor( browser: Browser, albumId: number, fields: Record< string, string > ): Promise< void > {
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

test( 'adding the gallery to a second album removes its back link for the next visitor', { tag: [ '@critical', '@cache' ] }, async ( { browser, playwright } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION );
	const second = album( [], NAVIGATION );

	expect( ( await cached( browser, gallery.url, gallery.id ) ).album ).toBe( parent.id );

	await rest( playwright, 'post', `/admin/albums/${ second.id }/galleries`, { gallery_ids: [ gallery.id ] } );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen, 'the cached render differs from an uncached one' ).toEqual( uncached );
	expect( seen.album, 'the old back link was replayed from the cache' ).toBeNull();
	expect( seen.trail ).toEqual( [] );
} );

test( 'removing the gallery from its second album brings its back link back', { tag: [ '@cache' ] }, async ( { browser, playwright } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION );
	const second = album( [ gallery.id ], NAVIGATION );

	expect( ( await cached( browser, gallery.url, gallery.id ) ).album ).toBeNull();

	await rest( playwright, 'delete', `/admin/albums/${ second.id }/galleries/${ gallery.id }` );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen, 'the cached render differs from an uncached one' ).toEqual( uncached );
	expect( seen.album ).toBe( parent.id );
	expect( seen.href ).toBe( parent.view );
	expect( seen.trail[ 0 ] ).toContain( parent.view );
} );

test( 'renaming the album in its editor shows the new name to the next visitor', { tag: [ '@critical', '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION, 'Before rename' );

	expect( ( await cached( browser, gallery.url, gallery.id ) ).back ).toContain( 'Before rename' );

	await saveInEditor( browser, parent.id, { post_title: 'After rename' } );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen, 'the cached render differs from an uncached one' ).toEqual( uncached );
	expect( seen.back ).toContain( 'After rename' );
	expect( seen.trail[ 0 ] ).toContain( 'After rename' );
} );

test( 'turning the back button off in the album editor reaches the next visitor', { tag: [ '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION );

	expect( ( await cached( browser, gallery.url, gallery.id ) ).back ).not.toBeNull();

	await saveInEditor( browser, parent.id, { fotogrids_navigation_show_back_button: '0' } );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen, 'the cached render differs from an uncached one' ).toEqual( uncached );
	expect( seen.album ).toBe( parent.id );
	expect( seen.back ).toBeNull();
} );

test( 'renaming and moving the album outside its editor reaches the next visitor', { tag: [ '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION, 'Quick before' );

	await cached( browser, gallery.url, gallery.id );

	wp( [ 'post', 'update', String( parent.id ), '--post_title=Quick after', `--post_name=quick-after-${ parent.id }` ] );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen, 'the cached render differs from an uncached one' ).toEqual( uncached );
	expect( seen.back ).toContain( 'Quick after' );
	expect( seen.href ).toBe( permalink( parent.id ) );
	expect( seen.href ).not.toBe( parent.view );
} );

test( 'trashing the album removes the back link and restoring it brings it back', { tag: [ '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION );

	await cached( browser, gallery.url, gallery.id );
	wp( [ 'post', 'delete', String( parent.id ) ] );
	const [ trashed, trashedUncached ] = await servedAndUncached( browser, gallery );
	expect( trashed ).toEqual( trashedUncached );
	expect( trashed.album ).toBeNull();

	await cached( browser, gallery.url, gallery.id );
	wp( [ 'eval', `wp_untrash_post( ${ parent.id } );` ] );
	const [ restored, restoredUncached ] = await servedAndUncached( browser, gallery );
	expect( restored ).toEqual( restoredUncached );
	expect( restored.album ).toBe( parent.id );
} );

test( 'deleting the album removes the back link for the next visitor', { tag: [ '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION );

	await cached( browser, gallery.url, gallery.id );

	wp( [ 'post', 'delete', String( parent.id ), '--force' ] );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen, 'the cached render differs from an uncached one' ).toEqual( uncached );
	expect( seen.album ).toBeNull();
	expect( seen.trail ).toEqual( [] );
} );

test( 'reordering the album keeps the cached render', { tag: [ '@cache' ] }, async ( { browser, playwright } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const sibling = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id, sibling.id ], NAVIGATION );

	const before = await cached( browser, gallery.url, gallery.id );

	await rest( playwright, 'post', `/admin/albums/${ parent.id }/galleries/reorder`, { gallery_ids: [ sibling.id, gallery.id ] } );

	expect( cachedRows( gallery.id ) ).toBe( 1 );
	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( before );
	expect( seen ).toEqual( uncached );
} );

test( 'an import that overwrites the album reaches the next visitor', { tag: [ '@cache' ] }, async ( { browser, playwright } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION );
	const slug = wp( [ 'post', 'get', String( parent.id ), '--field=post_name' ] );

	expect( ( await cached( browser, gallery.url, gallery.id ) ).back ).not.toBeNull();

	await rest( playwright, 'post', '/admin/tools/import-export/import', {
		phase: 'execute',
		format: 'json',
		include: [ 'albums' ],
		albums: 'overwrite',
		file: JSON.stringify( {
			meta: { version: wpEval( 'echo FOTOGRIDS_VERSION;' ).trim() },
			albums: [ { id: parent.id, title: 'Imported', slug, meta: { fotogrids_navigation_show_back_button: '0' } } ],
		} ),
	} );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( uncached );
	expect( seen.back ).toBeNull();
} );

test( 'renaming the gallery outside its editor reaches the next visitor', { tag: [ '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true }, undefined, 'Title before' );
	album( [ gallery.id ], NAVIGATION );

	await cached( browser, gallery.url, gallery.id );

	wp( [ 'post', 'update', String( gallery.id ), '--post_title=Title after' ] );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( uncached );
	expect( seen.trail[ 1 ] ).toContain( 'Title after' );
} );
