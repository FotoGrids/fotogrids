import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { storageStateFor, wpEval, type Role } from './support/roles';

/**
 * An album shows each viewer only the child galleries that viewer can read.
 *
 * One published, draft and private gallery owned by the administrator, and a
 * draft owned by the author, each with its own item so the album's fallback
 * cover names the gallery it came from. Drafts come first, so a cover taken
 * from an unreadable gallery would be the one picked.
 *
 * Scoped: every collection here is the spec's own.
 */

type Child = 'draft' | 'private' | 'authorDraft' | 'published';

type Scenario = {
	galleries: Record< Child, number >;
	files: Record< Child, string >;
	published: { id: number; url: string; view: string };
	draft: { id: number; url: string; view: string };
	featured: { id: number; url: string; view: string };
};

const ORDER: Child[] = [ 'draft', 'private', 'authorDraft', 'published' ];

let scenario: Scenario;

test.beforeAll( () => {
	const items = fixture< number[] >( 'F-small', 'items' );
	const make = ( child: Child, index: number ): number => {
		const status = { draft: 'draft', private: 'private', authorDraft: 'draft', published: 'publish' }[ child ];
		const author = 'authorDraft' === child ? 'fg-author' : 'admin';
		return galleryPage( {}, [ items[ index ] ], `Visibility ${ child }`, author, status ).id;
	};

	const galleries = Object.fromEntries( ORDER.map( ( child, i ) => [ child, make( child, i ) ] ) ) as Record< Child, number >;
	const files = Object.fromEntries(
		ORDER.map( ( child, i ) => [
			child,
			wpEval( `echo pathinfo( get_attached_file( ${ items[ i ] } ), PATHINFO_FILENAME );` ).trim(),
		] )
	) as Record< Child, string >;
	const children = ORDER.map( ( child ) => galleries[ child ] );

	scenario = {
		galleries,
		files,
		published: album( children, {}, 'Visibility album' ),
		draft: album( children, {}, 'Visibility draft album', 'admin', 'draft' ),
		featured: album( children, {}, 'Visibility featured album' ),
	};

	wpEval( `update_post_meta( ${ scenario.featured.id }, 'fotogrids_featured_gallery', ${ galleries.private } );` );
} );

/** A role's saved session, or none at all for a logged-out visitor. */
function sessionOf( role: Role | null ) {
	return role ? storageStateFor( role ) : { cookies: [], origins: [] };
}

/** The child galleries an album render shows, by name, in album order. */
async function tiles( page: Page, albumId: number ): Promise< Child[] > {
	const ids = await page
		.locator( `[data-fg-album-id="${ albumId }"] [data-fg-gallery-id]` )
		.evaluateAll( ( els ) => els.map( ( el ) => Number( el.getAttribute( 'data-fg-gallery-id' ) ) ) );
	const byId = Object.fromEntries( ORDER.map( ( child ) => [ scenario.galleries[ child ], child ] ) );

	return [ ...new Set( ids ) ].filter( ( id ) => byId[ id ] ).map( ( id ) => byId[ id ] );
}

const VISIBLE: Array< [ Role | null, Child[] ] > = [
	[ null, [ 'published' ] ],
	[ 'subscriber', [ 'published' ] ],
	[ 'author', [ 'authorDraft', 'published' ] ],
	[ 'editor', ORDER ],
	[ 'administrator', ORDER ],
];

for ( const [ role, expected ] of VISIBLE ) {
	test.describe( role ?? 'a logged-out visitor', () => {
		test.use( { storageState: sessionOf( role ) } );

		test( 'sees only readable galleries in an album shortcode', { tag: [ '@critical', '@permissions', '@layout' ] }, async ( {
			page,
		} ) => {
			await page.goto( scenario.published.url );

			await expect( page.locator( `[data-fg-album-id="${ scenario.published.id }"]` ) ).toBeVisible();
			expect( await tiles( page, scenario.published.id ) ).toEqual( expected );
		} );

		test( 'gets a view page whose tiles, count and share image match', { tag: [ '@permissions', '@layout' ] }, async ( {
			page,
		} ) => {
			await page.goto( scenario.published.view );

			expect( await tiles( page, scenario.published.id ) ).toEqual( expected );

			const count = expected.length;
			await expect( page.locator( 'meta[property="og:description"]' ) ).toHaveAttribute(
				'content',
				new RegExp( `^${ count } galler${ 1 === count ? 'y' : 'ies' } in ` )
			);
			await expect( page.locator( 'meta[property="og:image"]' ) ).toHaveAttribute(
				'content',
				new RegExp( scenario.files[ expected[ 0 ] ] )
			);
		} );
	} );
}

const FEATURED: Array< [ Role | null, Child ] > = [
	[ null, 'published' ],
	[ 'editor', 'private' ],
];

for ( const [ role, cover ] of FEATURED ) {
	test.describe( `an album featuring a private gallery, for ${ role ?? 'a logged-out visitor' }`, () => {
		test.use( { storageState: sessionOf( role ) } );

		test( 'shares the featured gallery only with viewers who can read it', { tag: [ '@permissions', '@layout' ] }, async ( {
			page,
		} ) => {
			await page.goto( scenario.featured.view );

			await expect( page.locator( 'meta[property="og:image"]' ) ).toHaveAttribute(
				'content',
				new RegExp( scenario.files[ cover ] )
			);
		} );
	} );
}

test.describe( 'a draft album', () => {
	test.describe( 'for a logged-out visitor', () => {
		test.use( { storageState: sessionOf( null ) } );

		test( 'renders nothing and has no view page', { tag: [ '@critical', '@permissions' ] }, async ( { page } ) => {
			const view = await page.request.get( scenario.draft.view );
			expect( view.status() ).toBe( 404 );

			await page.goto( scenario.draft.url );
			await expect( page.locator( `[data-fg-album-id="${ scenario.draft.id }"]` ) ).toHaveCount( 0 );
		} );
	} );

	test.describe( 'for an editor', () => {
		test.use( { storageState: sessionOf( 'editor' ) } );

		test( 'previews with its unpublished galleries', { tag: [ '@permissions', '@layout' ] }, async ( { page } ) => {
			for ( const url of [ scenario.draft.view, scenario.draft.url ] ) {
				await page.goto( url );
				expect( await tiles( page, scenario.draft.id ), url ).toEqual( ORDER );
			}
		} );
	} );
} );

test.describe( 'the album editor', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	test( 'still lists every assigned gallery, whatever its status', { tag: [ '@admin' ] }, async ( { page } ) => {
		await page.goto( `/wp-admin/post.php?post=${ scenario.published.id }&action=edit` );

		const assigned = await page.evaluate( () =>
			( window as unknown as { fotogridsAlbumGalleries?: { assignedGalleries: Array< { ID: string } > } } )
				.fotogridsAlbumGalleries?.assignedGalleries.map( ( gallery ) => Number( gallery.ID ) ) ?? []
		);

		expect( assigned ).toEqual( ORDER.map( ( child ) => scenario.galleries[ child ] ) );
	} );
} );
