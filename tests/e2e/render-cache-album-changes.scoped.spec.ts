import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { wpEval } from './support/roles';
import { NAVIGATION, cached, cachedRows, permalink, rest, saveInEditor, servedAndUncached, wp } from './support/album-header';

/**
 * A change to an album reaches the cached renders of its galleries.
 *
 * A gallery's header shows its parent album's name, link and navigation
 * settings, and its BreadcrumbList schema names the album. Each change is made
 * after a visitor's render is cached; the next visitor is served what an
 * uncached render shows.
 *
 * Scoped: every collection here is created by the test that reads it.
 */

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
	wpEval( `wp_trash_post( ${ parent.id } );` );
	const [ trashed, trashedUncached ] = await servedAndUncached( browser, gallery );
	expect( trashed ).toEqual( trashedUncached );
	expect( trashed.album ).toBeNull();

	await cached( browser, gallery.url, gallery.id );
	wpEval( `wp_untrash_post( ${ parent.id } );` );
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

test( 'renaming the gallery outside its editor reaches the next visitor', { tag: [ '@cache' ] }, async ( { browser } ) => {
	const gallery = galleryPage( { enable_cache: true }, undefined, 'Title before' );
	album( [ gallery.id ], NAVIGATION );

	await cached( browser, gallery.url, gallery.id );

	wp( [ 'post', 'update', String( gallery.id ), '--post_title=Title after' ] );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( uncached );
	expect( seen.trail[ 1 ] ).toContain( 'Title after' );
} );
