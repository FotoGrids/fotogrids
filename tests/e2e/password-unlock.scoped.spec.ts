import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage, type Settings } from './support/collections';
import { fixture, twelveItems } from './support/fixtures';
import { wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * A password gallery that does not remember the visitor stays unlocked for
 * the rest of the page, and only for that page. Every request the unlocked
 * gallery makes afterwards - pagination, filters, random sort, the lightbox -
 * is authorised by the token the unlock returned.
 *
 * Scoped: every gallery here is created by the spec.
 */

const PASSWORD = 'unlock-page-secret';

/** Six per page, so the first page never holds the whole gallery. */
const PAGINATED: Settings = {
	layout: 'grid',
	pagination_type: 'paginated',
	pagination_method: 'load_more',
	items_per_page: { desktop: 6, tablet: 6, mobile: 6 },
};

function setPassword( galleryId: number, password: string ): void {
	wpEval(
		`update_post_meta( ${ galleryId }, 'fotogrids_password', \\FotoGrids\\Password_Crypto::encrypt( '${ password }' ) );`
	);
}

/** Twelve items, six per page, behind a password that is not remembered. */
function passwordGallery(
	settings: Settings = {},
	items: number[] = twelveItems()
): { id: number; url: string } {
	const created = galleryPage(
		{ ...PAGINATED, password_protect: true, password_remember: false, ...settings },
		items
	);
	setPassword( created.id, PASSWORD );
	return created;
}

/** A page the purge removes, holding whatever shortcodes it is given. */
function pageWith( content: string ): string {
	return wpEval(
		`$id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Unlock page', 'post_content' => '${ content }' ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo get_permalink( $id );`
	).trim();
}

function unlockRoute( galleryId: number ): string {
	return `/?rest_route=${ encodeURIComponent( `/fotogrids/v1/gallery/${ galleryId }/unlock` ) }`;
}

/** Fill and submit the lock form inside `scope`, then wait for the items. */
async function unlockThroughForm( page: Page, gallery: GalleryRender, count = 6 ): Promise< void > {
	const form = page.locator( `.fg-lock-form[data-gallery-id="${ gallery.galleryId }"]` );
	await form.locator( '.fg-lock-input' ).fill( PASSWORD );
	await form.locator( '.fg-lock-submit' ).click();
	await expect( gallery.items() ).toHaveCount( count, { timeout: 15000 } );
}

type RestCall = { route: string; status: number; locked: boolean };

/**
 * Every FotoGrids REST response the page receives, so a test can assert that
 * none of them was refused or answered with the lock screen.
 */
function watchRest( page: Page ): Array< Promise< RestCall > > {
	const seen: Array< Promise< RestCall > > = [];
	page.on( 'response', ( response: Response ) => {
		const url = decodeURIComponent( response.url() );
		if ( ! url.includes( '/fotogrids/v1/' ) || url.includes( '/unlock' ) || url.includes( '/stats/' ) ) {
			return;
		}
		seen.push(
			response
				.text()
				.catch( () => '' )
				.then( ( body ) => ( {
					route: url.replace( /^.*\/fotogrids\/v1/, '' ),
					status: response.status(),
					locked: body.includes( 'class=\\"fotogrids-gate\\"' ) || body.includes( 'class="fotogrids-gate"' ),
				} ) )
		);
	} );
	return seen;
}

async function expectAllAuthorised( seen: Array< Promise< RestCall > > ): Promise< void > {
	expect( seen.length, 'the gallery made no follow-up request, so nothing was proven' ).toBeGreaterThan( 0 );
	for ( const call of await Promise.all( seen ) ) {
		expect( call.status, call.route ).toBe( 200 );
		expect( call.locked, `${ call.route } answered with the lock screen` ).toBe( false );
	}
}

/** Click Load More once the pagination script has bound to the gallery. */
async function loadMore( gallery: GalleryRender ): Promise< void > {
	await expect( gallery.root ).toHaveAttribute( 'data-fg-load-more-bound', '1', { timeout: 15000 } );
	await gallery.root.locator( '[data-fg-pagination-trigger="load-more"]' ).click();
}

/** Alt text of the rendered items, in order. */
function alts( gallery: GalleryRender ): Promise< string[] > {
	return gallery.items().locator( 'img' ).evaluateAll( ( images ) =>
		images.map( ( image ) => image.getAttribute( 'alt' ) ?? '' )
	);
}

test.describe( 'with remember off', () => {
	test( 'Load More pages an unlocked gallery, and a reload locks it again', { tag: '@gate' }, async ( {
		page,
	} ) => {
		const { id, url } = passwordGallery();
		const gallery = new GalleryRender( page, id );
		const seen = watchRest( page );

		await page.goto( url );
		await unlockThroughForm( page, gallery );

		await loadMore( gallery );
		await expect( gallery.items() ).toHaveCount( 12 );
		await expectAllAuthorised( seen );

		const cookies = await page.context().cookies();
		expect( cookies.some( ( cookie ) => cookie.name === `fotogrids_unlocked_${ id }` ) ).toBe( false );

		await page.reload();
		await expect( page.locator( '.fg-lock-form' ) ).toBeVisible();
		await expect( gallery.items() ).toHaveCount( 0 );
	} );

	test( 'page buttons move between pages of an unlocked gallery', { tag: '@gate' }, async ( { page } ) => {
		const { id, url } = passwordGallery( { pagination_method: 'pages' } );
		const gallery = new GalleryRender( page, id );
		const seen = watchRest( page );

		await page.goto( url );
		await unlockThroughForm( page, gallery );
		const first = await alts( gallery );

		await page.locator( '[data-fg-pagination-trigger="next"]' ).click();
		await expect.poll( () => alts( gallery ) ).not.toEqual( first );
		const second = await alts( gallery );
		expect( second ).toHaveLength( 6 );
		expect( second.filter( ( alt ) => first.includes( alt ) ) ).toEqual( [] );

		await page.locator( '[data-fg-pagination-trigger="page"][data-fg-pagination-page="1"]' ).click();
		await expect.poll( () => alts( gallery ) ).toEqual( first );
		await expectAllAuthorised( seen );
	} );

	test( 'endless scroll loads the next page of an unlocked gallery', { tag: '@gate' }, async ( { page } ) => {
		const { id, url } = passwordGallery( { pagination_method: 'endless_scroll' } );
		const gallery = new GalleryRender( page, id );
		const seen = watchRest( page );

		await page.goto( url );
		await unlockThroughForm( page, gallery );

		await page.locator( '[data-fg-pagination-sentinel="true"]' ).scrollIntoViewIfNeeded();
		await expect( gallery.items() ).toHaveCount( 12 );
		await expectAllAuthorised( seen );
	} );

	test( 'a tag filter narrows an unlocked gallery, and All restores it', { tag: '@gate' }, async ( { page } ) => {
		const { id, url } = passwordGallery(
			{
				items_per_page: { desktop: 2, tablet: 2, mobile: 2 },
				filtering_enabled: true,
				filter_display_mode: 'always',
			},
			fixture< number[] >( 'F-tagged', 'items' )
		);
		const gallery = new GalleryRender( page, id );
		const seen = watchRest( page );

		await page.goto( url );
		await unlockThroughForm( page, gallery, 2 );

		await gallery.root.locator( '.fg-filter-group button', { hasText: 'Street' } ).click();
		await expect( gallery.items() ).toHaveCount( 1 );
		expect( await alts( gallery ) ).toEqual( [ 'Tagged item 4' ] );

		await gallery.root.locator( '[data-fg-filter-all="true"]' ).click();
		await expect( gallery.items() ).toHaveCount( 2 );
		await expectAllAuthorised( seen );
	} );

	test( 'random order is reshuffled, and later pages continue the same order', { tag: '@gate' }, async ( {
		page,
	} ) => {
		const { id, url } = passwordGallery( { default_sort_order: 'random', random_mode: 'refetch' } );
		const gallery = new GalleryRender( page, id );
		const seen = watchRest( page );

		await page.goto( url );
		const reshuffled = page.waitForResponse( ( response ) =>
			decodeURIComponent( response.url() ).includes( '/fotogrids/v1/gallery/render' )
		);
		await unlockThroughForm( page, gallery );
		await reshuffled;

		await loadMore( gallery );
		await expect( gallery.items() ).toHaveCount( 12 );

		const all = await alts( gallery );
		expect( new Set( all ).size, `items repeated across pages: ${ all.join( ', ' ) }` ).toBe( 12 );
		await expectAllAuthorised( seen );
	} );

	test( 'the lightbox loads items beyond the first page', { tag: [ '@gate', '@lightbox' ] }, async ( {
		page,
	} ) => {
		const { id, url } = passwordGallery( { lightbox_show_dots: true } );
		const gallery = new GalleryRender( page, id );
		const lightbox = new Lightbox( page );
		const seen = watchRest( page );

		await page.goto( url );
		await unlockThroughForm( page, gallery );

		await lightbox.openFrom( gallery, 5 );
		await lightbox.goNext();
		expect( await lightbox.index() ).toBe( 6 );
		await expect( lightbox.image() ).toHaveJSProperty( 'complete', true );
		await expectAllAuthorised( seen );
	} );

	test( 'the lightbox info panel loads item details', { tag: [ '@gate', '@lightbox' ] }, async ( {
		page,
	} ) => {
		const { id, url } = passwordGallery();
		wpEval(
			`update_post_meta( ${ id }, 'fotogrids_lightbox_info_blocks', wp_slash( '["title","description","file_info"]' ) );`
		);
		const gallery = new GalleryRender( page, id );
		const lightbox = new Lightbox( page );

		await page.goto( url );
		await unlockThroughForm( page, gallery );

		const details = page.waitForResponse( ( response ) =>
			decodeURIComponent( response.url() ).includes( '/fotogrids/v1/lightbox/item/' )
		);
		await lightbox.openFrom( gallery );
		expect( ( await details ).status() ).toBe( 200 );
		await expect( lightbox.dialog().locator( '[data-fg-lb-block="file_info"]' ) ).toBeVisible();
	} );

	test( 'two galleries on one page unlock separately', { tag: '@gate' }, async ( { page } ) => {
		const first = passwordGallery();
		const second = passwordGallery();
		const url = pageWith( `[fotogrids_gallery id="${ first.id }"][fotogrids_gallery id="${ second.id }"]` );
		const one = new GalleryRender( page, first.id );
		const two = new GalleryRender( page, second.id );

		await page.goto( url );
		await unlockThroughForm( page, one );
		await expect( page.locator( `.fg-lock-form[data-gallery-id="${ second.id }"]` ) ).toBeVisible();

		await loadMore( one );
		await expect( one.items() ).toHaveCount( 12 );
		await expect( two.items() ).toHaveCount( 0 );

		await unlockThroughForm( page, two );
		await loadMore( two );
		await expect( two.items() ).toHaveCount( 12 );
	} );

	test( 'a gallery opened in place from an album pages after unlocking', { tag: '@gate' }, async ( { page } ) => {
		const { id } = passwordGallery();
		const { id: albumId } = album( [ id ], { use_ajax_from_album: true } );
		const url = pageWith( `[fotogrids_album id="${ albumId }"]` );
		const gallery = new GalleryRender( page, id );

		await page.goto( url );
		await page.locator( '[data-fg-album-ajax-trigger]' ).first().click();
		await expect( page.locator( `.fg-lock-form[data-gallery-id="${ id }"]` ) ).toBeVisible();

		await unlockThroughForm( page, gallery );
		await loadMore( gallery );
		await expect( gallery.items() ).toHaveCount( 12 );
	} );

	test( "the gallery's own view page pages after unlocking", { tag: '@gate' }, async ( { page } ) => {
		const { id } = passwordGallery();
		const url = wpEval( `echo get_permalink( ${ id } );` ).trim();
		const gallery = new GalleryRender( page, id );

		await page.goto( url );
		await unlockThroughForm( page, gallery );
		await loadMore( gallery );
		await expect( gallery.items() ).toHaveCount( 12 );
	} );

	test( 'changing the password ends the unlock for pages already open', { tag: '@gate' }, async ( {
		page,
	} ) => {
		const { id, url } = passwordGallery();
		const gallery = new GalleryRender( page, id );

		await page.goto( url );
		await unlockThroughForm( page, gallery );

		setPassword( id, 'a-new-secret' );
		const next = page.waitForResponse( ( response ) =>
			decodeURIComponent( response.url() ).includes( '/fotogrids/v1/gallery/render' )
		);
		await loadMore( gallery );
		expect( await ( await next ).text() ).toContain( 'fotogrids-gate' );
		await expect( gallery.items() ).toHaveCount( 6 );
	} );
} );

test( 'with remember on, the cookie carries the unlock and no token is issued', { tag: '@gate' }, async ( {
	page,
} ) => {
	const { id, url } = passwordGallery( { password_remember: true } );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	const unlock = page.waitForResponse( ( response ) =>
		decodeURIComponent( response.url() ).includes( `/gallery/${ id }/unlock` )
	);
	await unlockThroughForm( page, gallery );
	expect( ( await ( await unlock ).json() ).unlockToken ).toBe( '' );
	expect( await gallery.root.getAttribute( 'data-fg-unlock-token' ) ).toBeNull();

	await loadMore( gallery );
	await expect( gallery.items() ).toHaveCount( 12 );

	await page.reload();
	await expect( gallery.items() ).toHaveCount( 6 );
	await expect( page.locator( '.fg-lock-form' ) ).toHaveCount( 0 );
} );

test.describe( 'a wrong password', () => {
	test.use( { allowConsoleErrors: 'the unlock request is refused with a 401' } );

	test( 'is refused without a token', { tag: '@gate' }, async ( { page } ) => {
		const { id, url } = passwordGallery();

		await page.goto( url );
		const unlock = page.waitForResponse( ( response ) =>
			decodeURIComponent( response.url() ).includes( `/gallery/${ id }/unlock` )
		);
		await page.locator( '.fg-lock-input' ).fill( 'not-the-password' );
		await page.locator( '.fg-lock-submit' ).click();

		const response = await unlock;
		expect( response.status() ).toBe( 401 );
		expect( ( await response.json() ).unlockToken ).toBeUndefined();
		await expect( page.locator( '.fg-lock-error' ) ).toBeVisible();
	} );
} );

test( 'an unlock token opens only its own gallery, and only unaltered', { tag: [ '@gate', '@api' ] }, async ( {
	request,
} ) => {
	const first = passwordGallery();
	const second = passwordGallery();

	const unlock = await request.post( unlockRoute( first.id ), { data: { password: PASSWORD } } );
	expect( unlock.status() ).toBe( 200 );
	const token: string = ( await unlock.json() ).unlockToken;
	expect( token ).toMatch( /^\d+\.[0-9a-f]{64}$/ );

	const [ expires, signature ] = token.split( '.' );
	const opens = async ( galleryId: number, unlockToken: string ): Promise< boolean > => {
		const response = await request.post(
			`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/gallery/render' ) }`,
			{
				headers: { 'X-FotoGrids-Unlock': unlockToken },
				data: { gallery_id: galleryId, page: 2, partial: 'items_only' },
			}
		);
		expect( response.status() ).toBe( 200 );
		return ! ( ( await response.json() ).html as string ).includes( 'class="fotogrids-gate"' );
	};

	expect( await opens( first.id, token ) ).toBe( true );
	expect( await opens( second.id, token ) ).toBe( false );
	expect( await opens( first.id, `${ Number( expires ) + 60 }.${ signature }` ) ).toBe( false );

	// Correctly signed for a chosen expiry, so only the expiry differs.
	const signedFor = ( offset: number ): string =>
		wpEval(
			`$sign = new \\ReflectionMethod( '\\FotoGrids\\REST\\Gallery\\Gallery_Data', 'sign_unlock_token' ); $sign->setAccessible( true ); $at = time() + ${ offset }; echo $at . '.' . $sign->invoke( null, ${ first.id }, get_post_meta( ${ first.id }, 'fotogrids_password', true ), $at );`
		).trim();
	expect( await opens( first.id, signedFor( 60 ) ) ).toBe( true );
	expect( await opens( first.id, signedFor( -60 ) ) ).toBe( false );
} );
