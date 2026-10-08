import { execFileSync } from 'child_process';
import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { wpCli, wpEval } from './support/roles';

/**
 * A share click reaches the Statistics counts, from every share surface and on
 * every network the sharing settings offer.
 *
 * Serial: sharing is a site-wide option, so turning networks and placements on
 * changes what every other spec renders.
 */

test.describe.configure( { mode: 'serial' } );

const OPTION = 'fotogrids_sharing_settings';

const NETWORKS = [
	'facebook',
	'x',
	'pinterest',
	'linkedin',
	'whatsapp',
	'telegram',
	'reddit',
	'email',
	'copy_link',
];

/** The network key the share bar reports, by stored network id. */
const REPORTED: Record< string, string > = { x: 'twitter', copy_link: 'copy' };

function readOption(): string | null {
	try {
		return execFileSync( wpCli(), [ 'option', 'get', OPTION, '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}
}

function writeOption( value: string | null ): void {
	if ( null === value ) {
		execFileSync( wpCli(), [ 'option', 'delete', OPTION ], { encoding: 'utf8' } );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', OPTION, '--format=json', value ], {
		encoding: 'utf8',
	} );
}

function sharing(
	enabled: boolean,
	placements = [ 'view_page', 'lightbox', 'thumbnail' ],
	trackClicks = true
): string {
	return JSON.stringify( {
		enable_social_sharing: enabled,
		networks: Object.fromEntries( NETWORKS.map( ( n ) => [ n, true ] ) ),
		placements,
		track_clicks: trackClicks,
	} );
}

/** Stored share count for one object. */
function shares( type: 'gallery' | 'album' | 'item', id: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT shares FROM {$wpdb->prefix}fotogrids_statistics WHERE object_type = %s AND object_id = %d", '${ type }', ${ id } ) );`
		).trim()
	);
}

/** Share count summed across the daily rows the Statistics page charts. */
function dailyShares( type: 'gallery' | 'album' | 'item', id: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT SUM(shares) FROM {$wpdb->prefix}fotogrids_statistics_daily WHERE object_type = %s AND object_id = %d", '${ type }', ${ id } ) );`
		).trim()
	);
}

/** Stored view count for one object. */
function views( type: 'gallery' | 'album' | 'item', id: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT views FROM {$wpdb->prefix}fotogrids_statistics WHERE object_type = %s AND object_id = %d", '${ type }', ${ id } ) );`
		).trim()
	);
}

function viewPage( id: number ): string {
	return wpEval( `echo get_permalink( ${ id } );` ).trim();
}

function isShare( response: Response ): boolean {
	return (
		'POST' === response.request().method() &&
		decodeURIComponent( response.url() ).includes( 'fotogrids/v1/stats/share' )
	);
}

/** Click one share button and return the share request it sent. */
async function shareOn( page: Page, button: ReturnType< Page[ 'locator' ] > ) {
	const [ response ] = await Promise.all( [
		page.waitForResponse( isShare ),
		button.click(),
	] );

	return { status: response.status(), body: response.request().postDataJSON() };
}

/** Collect every share request the page sends, for asserting none went out. */
function recordShares( page: Page ): string[] {
	const sent: string[] = [];
	page.on( 'request', ( request ) => {
		if ( decodeURIComponent( request.url() ).includes( 'fotogrids/v1/stats/share' ) ) {
			sent.push( request.postData() ?? '' );
		}
	} );
	return sent;
}

let before: string | null;

test.beforeAll( () => {
	before = readOption();
	writeOption( sharing( true ) );
} );

test.afterAll( () => {
	writeOption( before );
} );

test.beforeEach( async ( { context, page } ) => {
	await context.grantPermissions( [ 'clipboard-read', 'clipboard-write' ] );
	// Network share windows open third-party sites; answer them locally.
	await context.route( /^https?:\/\/(?!127\.0\.0\.1|localhost)/, ( route ) =>
		route.fulfill( { status: 200, body: '' } )
	);
	page.on( 'popup', ( popup ) => {
		popup.close().catch( () => {} );
	} );
} );

test( 'a thumbnail share is recorded against the item on every network', { tag: [ '@api', '@layout' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( { layout: 'grid' } );
	const item = fixture< number[] >( 'F-small', 'items' )[ 0 ];
	const gallery = new GalleryRender( page, id );
	const start = shares( 'item', item );

	await page.goto( url );
	await gallery.waitFor();
	const bar = gallery.items().first().locator( '.fotogrids-share-bar--thumbnail' );
	await gallery.items().first().hover();

	for ( const network of NETWORKS ) {
		const sent = await shareOn( page, bar.locator( `[data-network="${ network }"]` ) );

		expect( sent ).toEqual( {
			status: 200,
			body: {
				object_type: 'item',
				object_id: item,
				network: REPORTED[ network ] ?? network,
			},
		} );
	}

	expect( shares( 'item', item ) - start ).toBe( NETWORKS.length );
} );

test( 'a view-page footer share is recorded against the gallery on every network', { tag: [ '@api', '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { layout: 'grid' } );

	await page.goto( viewPage( id ) );
	const bar = page.locator( '.fotogrids-share-bar--footer' );

	for ( const network of NETWORKS ) {
		const sent = await shareOn( page, bar.locator( `[data-network="${ network }"]` ) );

		expect( sent ).toEqual( {
			status: 200,
			body: {
				object_type: 'gallery',
				object_id: id,
				network: REPORTED[ network ] ?? network,
			},
		} );
	}

	expect( shares( 'gallery', id ) ).toBe( NETWORKS.length );
} );

test( 'a view-page footer share is recorded against the album', { tag: [ '@api', '@layout' ] }, async ( {
	page,
} ) => {
	const child = galleryPage( { layout: 'grid' } );
	const { id, view } = album( [ child.id ] );

	await page.goto( view );
	const sent = await shareOn(
		page,
		page.locator( '.fotogrids-share-bar--footer [data-network="copy_link"]' )
	);

	expect( sent ).toEqual( {
		status: 200,
		body: { object_type: 'album', object_id: id, network: 'copy' },
	} );
	expect( shares( 'album', id ) ).toBe( 1 );
	expect( shares( 'gallery', child.id ) ).toBe( 0 );
} );

test( 'a footer share on a gallery with statistics off records nothing', { tag: [ '@api', '@layout' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { layout: 'grid', enable_statistics: false } );
	const sent = recordShares( page );

	await page.goto( viewPage( id ) );
	await page.locator( '.fotogrids-share-bar--footer [data-network="copy_link"]' ).click();
	await expect( page.locator( '.fotogrids-share-bar--footer [data-network="copy_link"]' ) ).toHaveAttribute(
		'aria-label',
		'Link copied'
	);

	expect( sent ).toEqual( [] );
	expect( shares( 'gallery', id ) ).toBe( 0 );
} );

test.describe( 'with sharing in the lightbox only', () => {
	// A thumbnail bar sits over the item, so it is left off for opening the lightbox.
	test.beforeAll( () => {
		writeOption( sharing( true, [ 'lightbox' ] ) );
	} );

	test.afterAll( () => {
		writeOption( sharing( true ) );
	} );

	test( 'a lightbox share is recorded against the item on screen', { tag: [ '@api', '@lightbox' ] }, async ( {
		page,
	} ) => {
		const { id, url } = galleryPage( { layout: 'grid' } );
		const item = fixture< number[] >( 'F-small', 'items' )[ 0 ];
		const gallery = new GalleryRender( page, id );
		const lightbox = new Lightbox( page );

		await page.goto( url );
		await gallery.waitFor();
		await lightbox.openFrom( gallery );
		await lightbox.dialog().locator( '.fg-lb-share' ).click();

		const sent = await shareOn(
			page,
			page.locator( '.fotogrids-share-bar--lightbox-popover [data-network="linkedin"]' )
		);

		expect( sent ).toEqual( {
			status: 200,
			body: { object_type: 'item', object_id: item, network: 'linkedin' },
		} );
	} );
} );

test.describe( 'with sharing turned off', () => {
	test.beforeAll( () => {
		writeOption( sharing( false ) );
	} );

	test.afterAll( () => {
		writeOption( sharing( true ) );
	} );

	test( 'the copy-link fallback on a view page is recorded against the gallery', { tag: [ '@api', '@layout' ] }, async ( {
		page,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' } );

		await page.goto( viewPage( id ) );
		const bar = page.locator( '.fotogrids-share-bar--footer' );
		await expect( bar.locator( 'button' ) ).toHaveCount( 1 );

		const sent = await shareOn( page, bar.locator( '[data-network="copy_link"]' ) );

		expect( sent ).toEqual( {
			status: 200,
			body: { object_type: 'gallery', object_id: id, network: 'copy' },
		} );
		expect( shares( 'gallery', id ) ).toBe( 1 );
	} );
} );

test.describe( 'with Track share clicks off', () => {
	test.beforeAll( () => {
		writeOption( sharing( true, [ 'view_page', 'lightbox', 'thumbnail' ], false ) );
	} );

	test.afterAll( () => {
		writeOption( sharing( true ) );
	} );

	test( 'a thumbnail share on every network records nothing against the item', { tag: [ '@api', '@layout' ] }, async ( {
		page,
	} ) => {
		const { id, url } = galleryPage( { layout: 'grid' } );
		const item = fixture< number[] >( 'F-small', 'items' )[ 0 ];
		const gallery = new GalleryRender( page, id );
		const start = shares( 'item', item );
		const startDaily = dailyShares( 'item', item );

		await page.goto( url );
		await gallery.waitFor();
		const bar = gallery.items().first().locator( '.fotogrids-share-bar--thumbnail' );
		await gallery.items().first().hover();

		for ( const network of NETWORKS ) {
			const sent = await shareOn( page, bar.locator( `[data-network="${ network }"]` ) );

			expect( sent.status ).toBe( 200 );
		}

		expect( shares( 'item', item ) ).toBe( start );
		expect( dailyShares( 'item', item ) ).toBe( startDaily );
	} );

	test( 'a view-page footer share records nothing against the gallery or the album', { tag: [ '@api', '@layout' ] }, async ( {
		page,
	} ) => {
		const child = galleryPage( { layout: 'grid' } );
		const { id, view } = album( [ child.id ] );

		await page.goto( viewPage( child.id ) );
		for ( const network of NETWORKS ) {
			const sent = await shareOn(
				page,
				page.locator( `.fotogrids-share-bar--footer [data-network="${ network }"]` )
			);

			expect( sent.status ).toBe( 200 );
		}

		await page.goto( view );
		const sent = await shareOn(
			page,
			page.locator( '.fotogrids-share-bar--footer [data-network="copy_link"]' )
		);

		expect( sent.status ).toBe( 200 );
		expect( shares( 'gallery', child.id ) ).toBe( 0 );
		expect( shares( 'album', id ) ).toBe( 0 );
		expect( dailyShares( 'gallery', child.id ) ).toBe( 0 );
		expect( dailyShares( 'album', id ) ).toBe( 0 );
	} );

	test( 'a share still does its job when nothing is recorded', { tag: [ '@layout' ] }, async ( {
		page,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' } );
		const view = viewPage( id );
		const copy = page.locator( '.fotogrids-share-bar--footer [data-network="copy_link"]' );

		await page.goto( view );
		await copy.click();

		await expect( copy ).toHaveAttribute( 'aria-label', 'Link copied' );
		expect( await page.evaluate( () => navigator.clipboard.readText() ) ).toBe( view );

		const [ popup ] = await Promise.all( [
			page.waitForEvent( 'popup' ),
			page.locator( '.fotogrids-share-bar--footer [data-network="facebook"]' ).click(),
		] );

		expect( popup.url() ).toContain( 'facebook.com/sharer/sharer.php?u=' + encodeURIComponent( view ) );
	} );

	test( 'a gallery view is still recorded', { tag: [ '@api', '@layout' ] }, async ( { page } ) => {
		const { id } = galleryPage( { layout: 'grid' } );

		await Promise.all( [
			page.waitForResponse(
				( response ) =>
					'POST' === response.request().method() &&
					decodeURIComponent( response.url() ).includes( 'fotogrids/v1/stats/view' )
			),
			page.goto( viewPage( id ) ),
		] );

		expect( views( 'gallery', id ) ).toBe( 1 );
	} );

	test( 'a share of an object that does not exist still answers 404', { tag: [ '@api' ] }, async ( {
		request,
	} ) => {
		const response = await request.post( '/wp-json/fotogrids/v1/stats/share', {
			data: { object_type: 'item', object_id: 999999999, network: 'facebook' },
		} );

		expect( response.status() ).toBe( 404 );
		expect( ( await response.json() ).code ).toBe( 'fotogrids_stats_object_not_found' );
	} );

	test( 'turning tracking off keeps existing counts, and turning it back on records again', { tag: [ '@api', '@layout' ] }, async ( {
		page,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' } );
		const copy = page.locator( '.fotogrids-share-bar--footer [data-network="copy_link"]' );

		writeOption( sharing( true ) );
		await page.goto( viewPage( id ) );
		await shareOn( page, copy );
		expect( shares( 'gallery', id ) ).toBe( 1 );

		writeOption( sharing( true, [ 'view_page', 'lightbox', 'thumbnail' ], false ) );
		await page.reload();
		await shareOn( page, copy );
		expect( shares( 'gallery', id ) ).toBe( 1 );

		writeOption( sharing( true ) );
		await page.reload();
		await shareOn( page, copy );
		expect( shares( 'gallery', id ) ).toBe( 2 );

		writeOption( sharing( true, [ 'view_page', 'lightbox', 'thumbnail' ], false ) );
	} );

	test.describe( 'with sharing in the lightbox only', () => {
		test.beforeAll( () => {
			writeOption( sharing( true, [ 'lightbox' ], false ) );
		} );

		test.afterAll( () => {
			writeOption( sharing( true, [ 'view_page', 'lightbox', 'thumbnail' ], false ) );
		} );

		test( 'a lightbox share records nothing against the item on screen', { tag: [ '@api', '@lightbox' ] }, async ( {
			page,
		} ) => {
			const { id, url } = galleryPage( { layout: 'grid' } );
			const item = fixture< number[] >( 'F-small', 'items' )[ 0 ];
			const gallery = new GalleryRender( page, id );
			const lightbox = new Lightbox( page );
			const start = shares( 'item', item );

			await page.goto( url );
			await gallery.waitFor();
			await lightbox.openFrom( gallery );
			await lightbox.dialog().locator( '.fg-lb-share' ).click();

			const sent = await shareOn(
				page,
				page.locator( '.fotogrids-share-bar--lightbox-popover [data-network="linkedin"]' )
			);

			expect( sent.status ).toBe( 200 );
			expect( shares( 'item', item ) ).toBe( start );
		} );
	} );

	test.describe( 'with sharing turned off', () => {
		test.beforeAll( () => {
			writeOption( sharing( false, [ 'view_page', 'lightbox', 'thumbnail' ], false ) );
		} );

		test.afterAll( () => {
			writeOption( sharing( true, [ 'view_page', 'lightbox', 'thumbnail' ], false ) );
		} );

		test( 'the copy-link fallback on a view page records nothing', { tag: [ '@api', '@layout' ] }, async ( {
			page,
		} ) => {
			const { id } = galleryPage( { layout: 'grid' } );

			await page.goto( viewPage( id ) );
			const sent = await shareOn(
				page,
				page.locator( '.fotogrids-share-bar--footer [data-network="copy_link"]' )
			);

			expect( sent.status ).toBe( 200 );
			expect( shares( 'gallery', id ) ).toBe( 0 );
		} );
	} );
} );
