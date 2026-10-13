import { execFileSync } from 'child_process';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { apiAnonymous, apiAs, storageStateFor, wpCli, type Role } from './support/roles';

/**
 * GET /album/{id} and GET /gallery/{id}, read by each role.
 *
 * Scoped: every collection here is the spec's own.
 */

type Child = 'draft' | 'private' | 'authorDraft' | 'second' | 'first';

const ORDER: Child[] = [ 'draft', 'private', 'authorDraft', 'second', 'first' ];

type Scenario = {
	galleries: Record< Child, number >;
	published: { id: number; url: string };
	registered: { id: number; url: string };
	draft: number;
};

let scenario: Scenario;

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

function route( path: string ): string {
	return `/?rest_route=${ encodeURIComponent( `/fotogrids/v1${ path }` ) }`;
}

/** The album's view count as stored. */
function albumViews( albumId: number ): number {
	return Number(
		wp( [
			'eval',
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT views FROM {$wpdb->prefix}fotogrids_statistics WHERE object_type = 'album' AND object_id = %d", ${ albumId } ) );`,
		] )
	);
}

test.beforeAll( () => {
	const items = fixture< number[] >( 'F-small', 'items' );
	const make = ( child: Child, index: number ): number => {
		const status = { draft: 'draft', private: 'private', authorDraft: 'draft', second: 'publish', first: 'publish' }[ child ];
		const author = 'authorDraft' === child ? 'fg-author' : 'admin';
		return galleryPage( {}, [ items[ index ] ], `REST read ${ child }`, author, status ).id;
	};

	// `first` is created before `second` but sits after it in the album.
	const ids = { first: make( 'first', 0 ) } as Record< Child, number >;
	( [ 'draft', 'private', 'authorDraft', 'second' ] as Child[] ).forEach( ( child, i ) => {
		ids[ child ] = make( child, i + 1 );
	} );
	const children = ORDER.map( ( child ) => ids[ child ] );

	scenario = {
		galleries: ids,
		published: album( children, {}, 'REST read album' ),
		registered: album( [ ids.first ], { who_can_view: 'registered_users' }, 'REST read registered album' ),
		draft: album( children, {}, 'REST read draft album', 'admin', 'draft' ).id,
	};
} );

type Reader = { context: APIRequestContext; headers: Record< string, string > };

async function readerFor( playwright: Parameters< typeof apiAs >[ 0 ], role: Role | null ): Promise< Reader > {
	if ( ! role ) {
		return { context: await apiAnonymous( playwright ), headers: {} };
	}
	const api = await apiAs( playwright, role );
	return { context: api.context, headers: { 'X-WP-Nonce': api.nonce } };
}

async function getAlbum( reader: Reader, albumId: number ) {
	const response = await reader.context.get( route( `/album/${ albumId }` ), { headers: reader.headers } );
	return { status: response.status(), body: await response.json() };
}

function names( ids: number[] ): Child[] {
	const byId = Object.fromEntries( ORDER.map( ( child ) => [ scenario.galleries[ child ], child ] ) );
	return ids.map( ( id ) => byId[ id ] );
}

/** The child galleries an album render shows, in album order. */
async function tiles( page: Page, albumId: number ): Promise< Child[] > {
	const ids = await page
		.locator( `[data-fg-album-id="${ albumId }"] [data-fg-gallery-id]` )
		.evaluateAll( ( els ) => els.map( ( el ) => Number( el.getAttribute( 'data-fg-gallery-id' ) ) ) );
	return names( [ ...new Set( ids ) ].filter( ( id ) => ORDER.some( ( c ) => scenario.galleries[ c ] === id ) ) );
}

const VISIBLE: Array< [ Role | null, Child[] ] > = [
	[ null, [ 'second', 'first' ] ],
	[ 'subscriber', [ 'second', 'first' ] ],
	[ 'contributor', [ 'second', 'first' ] ],
	[ 'author', [ 'authorDraft', 'second', 'first' ] ],
	[ 'editor', ORDER ],
	[ 'administrator', ORDER ],
];

for ( const [ role, expected ] of VISIBLE ) {
	test.describe( role ?? 'a logged-out visitor', () => {
		test.use( { storageState: role ? storageStateFor( role ) : { cookies: [], origins: [] } } );

		test( 'reads the album galleries it can view, in album order', { tag: [ '@critical', '@api', '@permissions' ] }, async ( {
			playwright,
		} ) => {
			const { status, body } = await getAlbum( await readerFor( playwright, role ), scenario.published.id );

			expect( status ).toBe( 200 );
			expect( names( body.galleries.map( ( g: { id: number } ) => g.id ) ) ).toEqual( expected );
			for ( const gallery of body.galleries ) {
				expect( Object.keys( gallery ) ).toEqual( [ 'id', 'title', 'description', 'thumbnail', 'item_count' ] );
				expect( typeof gallery.id ).toBe( 'number' );
				expect( gallery.item_count ).toBe( 1 );
				expect( gallery.thumbnail ).toEqual( expect.any( String ) );
			}
		} );

		test( 'gets the same galleries from the route as from the album render', { tag: [ '@api', '@layout' ] }, async ( {
			page,
			playwright,
		} ) => {
			await page.goto( scenario.published.url );
			await expect( page.locator( `[data-fg-album-id="${ scenario.published.id }"]` ) ).toBeVisible();

			const { body } = await getAlbum( await readerFor( playwright, role ), scenario.published.id );
			expect( names( body.galleries.map( ( g: { id: number } ) => g.id ) ) ).toEqual( await tiles( page, scenario.published.id ) );
		} );
	} );
}

test( 'follows the album order after the galleries are reordered', { tag: [ '@api' ] }, async ( { playwright } ) => {
	const own = album( [ scenario.galleries.first, scenario.galleries.second ], {}, 'REST read reorder album' );
	const admin = await readerFor( playwright, 'administrator' );

	const reorder = await admin.context.post( route( `/admin/albums/${ own.id }/galleries/reorder` ), {
		headers: admin.headers,
		data: { gallery_ids: [ scenario.galleries.second, scenario.galleries.first ] },
	} );
	expect( reorder.status() ).toBe( 200 );

	const { body } = await getAlbum( await readerFor( playwright, null ), own.id );
	expect( names( body.galleries.map( ( g: { id: number } ) => g.id ) ) ).toEqual( [ 'second', 'first' ] );
} );

test( 'lists nothing for an album with no galleries', { tag: [ '@api' ] }, async ( { playwright } ) => {
	const empty = album( [], {}, 'REST read empty album' );

	const { status, body } = await getAlbum( await readerFor( playwright, null ), empty.id );
	expect( status ).toBe( 200 );
	expect( body.galleries ).toEqual( [] );
} );

test.describe( 'an album for registered users', () => {
	test( 'is refused to a logged-out visitor and counts no view', { tag: [ '@critical', '@api', '@permissions' ] }, async ( {
		playwright,
	} ) => {
		const before = albumViews( scenario.registered.id );

		const { status, body } = await getAlbum( await readerFor( playwright, null ), scenario.registered.id );

		expect( status ).toBe( 401 );
		expect( body.code ).toBe( 'fotogrids_album_locked' );
		expect( body ).not.toHaveProperty( 'galleries' );
		expect( albumViews( scenario.registered.id ) ).toBe( before );
	} );

	test( 'is read by a logged-in subscriber and counts the view', { tag: [ '@api', '@permissions' ] }, async ( { playwright } ) => {
		const before = albumViews( scenario.registered.id );

		const { status, body } = await getAlbum( await readerFor( playwright, 'subscriber' ), scenario.registered.id );

		expect( status ).toBe( 200 );
		expect( names( body.galleries.map( ( g: { id: number } ) => g.id ) ) ).toEqual( [ 'first' ] );
		expect( albumViews( scenario.registered.id ) ).toBe( before + 1 );
	} );
} );

test( 'keeps the errors for an unpublished or missing album', { tag: [ '@api' ] }, async ( { playwright } ) => {
	for ( const role of [ null, 'administrator' ] as Array< Role | null > ) {
		const reader = await readerFor( playwright, role );

		const draft = await getAlbum( reader, scenario.draft );
		expect( draft.status ).toBe( 403 );
		expect( draft.body.code ).toBe( 'album_not_published' );

		const gallery = await getAlbum( reader, scenario.galleries.first );
		expect( gallery.status ).toBe( 404 );
		expect( gallery.body.code ).toBe( 'album_not_found' );
	}
} );

test( 'returns a gallery with only its layout and columns in meta', { tag: [ '@api' ] }, async ( { playwright } ) => {
	const reader = await readerFor( playwright, null );

	const response = await reader.context.get( route( `/gallery/${ scenario.galleries.first }` ) );
	expect( response.status() ).toBe( 200 );

	const body = await response.json();
	expect( Object.keys( body.meta ) ).toEqual( [ 'layout', 'columns' ] );
	expect( body.items ).toHaveLength( 1 );
} );
