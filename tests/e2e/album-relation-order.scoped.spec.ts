import type { Browser, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';

/**
 * The order the album ↔ gallery relation queries return, and the direction
 * values they accept.
 *
 * Titles run against positions (Charlie, Alpha, Delta, Bravo) so a sort on the
 * wrong column, or in the wrong direction, shows in every assertion.
 */

type Fixture = {
	prefix: string;
	name: Record< number, string >;
	ids: Record< string, number >;
	zulu: { id: number; url: string; view: string };
	mike: { id: number; url: string; view: string };
};

const NAVIGATION = {
	navigation_show_breadcrumbs: true,
	navigation_show_back_button: true,
	navigation_show_breadcrumbs_on_direct_visit: true,
	use_ajax_from_album: false,
};

/** Zulu holds Charlie, Alpha, Delta (draft), Bravo; Mike holds Charlie. */
function build(): Fixture {
	const prefix = `Relation ${ Date.now() }-${ Math.random().toString( 36 ).slice( 2, 6 ) }`;
	const ids = {
		Charlie: galleryPage( {}, undefined, `${ prefix } Charlie` ).id,
		Alpha: galleryPage( {}, undefined, `${ prefix } Alpha` ).id,
		Delta: galleryPage( {}, undefined, `${ prefix } Delta`, undefined, 'draft' ).id,
		Bravo: galleryPage( {}, undefined, `${ prefix } Bravo` ).id,
	};
	const zulu = album( [ ids.Charlie, ids.Alpha, ids.Delta, ids.Bravo ], NAVIGATION, `${ prefix } Zulu` );
	const mike = album( [ ids.Charlie ], NAVIGATION, `${ prefix } Mike` );
	const name = Object.fromEntries( [
		...Object.entries( ids ).map( ( [ k, v ] ) => [ v, k ] ),
		[ zulu.id, 'Zulu' ],
		[ mike.id, 'Mike' ],
	] );

	return { prefix, name, ids, zulu, mike };
}

/** Child galleries an album render links to, by name. */
async function children( page: Page, f: Fixture ): Promise< string[] > {
	const ids = await page
		.locator( '.fotogrids-album a[data-fg-gallery-id]' )
		.evaluateAll( ( links ) => links.map( ( a ) => Number( a.getAttribute( 'data-fg-gallery-id' ) ) ) );
	return ids.map( ( id ) => f.name[ id ] ?? String( id ) );
}

async function childrenAs( browser: Browser, url: string, f: Fixture, admin = false ): Promise< string[] > {
	const context = await browser.newContext( admin ? { storageState: storageStateFor( 'administrator' ) } : {} );
	const page = await context.newPage();
	await page.goto( url );
	const names = await children( page, f );
	await context.close();
	return names;
}

/** The album a gallery's header links back to, or null. */
async function backAlbum( browser: Browser, url: string, f: Fixture ): Promise< string | null > {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto( url );
	const header = page.locator( '.fg-collection-header' );
	const id = ( await header.count() ) > 0 ? await header.first().getAttribute( 'data-fg-via-album' ) : null;
	await context.close();
	return null === id ? null : f.name[ Number( id ) ] ?? id;
}

/** Both relation queries for one `order` value: names returned and any SQL error. */
function query( f: Fixture, order: string ): { galleries: string[]; albums: string[]; error: string } {
	const out = wpEval( `
		global $wpdb;
		$wpdb->suppress_errors( true );
		$names = static fn( $rows ) => array_map( static fn( $row ) => (int) $row->ID, (array) $rows );
		$order = ${ JSON.stringify( order ) };
		$galleries = \\FotoGrids\\Gallery_Album_Relations::get_galleries_for_album( ${ f.zulu.id }, array( 'orderby' => 'position', 'order' => $order, 'include_meta' => false ) );
		$error = $wpdb->last_error;
		$albums = \\FotoGrids\\Gallery_Album_Relations::get_albums_for_gallery( ${ f.ids.Charlie }, array( 'orderby' => 'title', 'order' => $order, 'include_meta' => false ) );
		echo wp_json_encode( array( 'galleries' => $names( $galleries ), 'albums' => $names( $albums ), 'error' => $error . $wpdb->last_error ) );
	` );
	const parsed = JSON.parse( out.trim().split( '\n' ).pop() as string );

	return {
		galleries: parsed.galleries.map( ( id: number ) => f.name[ id ] ),
		albums: parsed.albums.map( ( id: number ) => f.name[ id ] ),
		error: parsed.error,
	};
}

const ASCENDING = { galleries: [ 'Charlie', 'Alpha', 'Delta', 'Bravo' ], albums: [ 'Mike', 'Zulu' ], error: '' };
const DESCENDING = { galleries: [ 'Bravo', 'Delta', 'Alpha', 'Charlie' ], albums: [ 'Zulu', 'Mike' ], error: '' };

test( 'the relation queries sort ASC or DESC and treat any other direction as ASC', { tag: '@api' }, () => {
	const f = build();

	expect( query( f, 'ASC' ) ).toEqual( ASCENDING );
	expect( query( f, 'DESC' ) ).toEqual( DESCENDING );
	expect( query( f, 'desc' ) ).toEqual( DESCENDING );
	expect( query( f, 'Desc' ) ).toEqual( DESCENDING );

	for ( const order of [ '', 'sideways', 'DESC, p.ID ASC', 'ASC LIMIT 1', 'DESC, (SELECT 1)', 'ASC; DROP TABLE wp_posts' ] ) {
		expect( query( f, order ), `order ${ JSON.stringify( order ) }` ).toEqual( ASCENDING );
	}
} );

test( 'an album lists its galleries in position order on the page, the view page and for an administrator', { tag: '@layout' }, async ( {
	browser,
} ) => {
	const f = build();

	expect( await childrenAs( browser, f.zulu.url, f ) ).toEqual( [ 'Charlie', 'Alpha', 'Bravo' ] );
	expect( await childrenAs( browser, f.zulu.view, f ) ).toEqual( [ 'Charlie', 'Alpha', 'Bravo' ] );
	expect( await childrenAs( browser, f.zulu.url, f, true ) ).toEqual( [ 'Charlie', 'Alpha', 'Delta', 'Bravo' ] );
} );

test( 'a gallery links back to its only album, to the album it was reached from, and to none when ambiguous', { tag: '@layout' }, async ( {
	browser,
} ) => {
	const f = build();
	const url = ( id: number ) => wpEval( `echo get_permalink( ${ id } );` ).trim();
	const charlie = url( f.ids.Charlie );

	expect( await backAlbum( browser, url( f.ids.Alpha ), f ) ).toBe( 'Zulu' );
	expect( await backAlbum( browser, charlie, f ) ).toBeNull();
	expect( await backAlbum( browser, `${ charlie }?fg_via=${ f.mike.id }`, f ) ).toBe( 'Mike' );
	expect( await backAlbum( browser, `${ charlie }?fg_via=${ f.zulu.id }`, f ) ).toBe( 'Zulu' );
} );

test.describe( 'admin screens', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	test( 'the album screen lists its galleries by position', { tag: '@admin' }, async ( { page } ) => {
		const f = build();

		await page.goto( `/wp-admin/post.php?post=${ f.zulu.id }&action=edit` );
		await expect( page.locator( '.fotogrids-assigned-galleries .fotogrids-gallery-item' ) ).toHaveText( [
			new RegExp( `${ f.prefix } Charlie` ),
			new RegExp( `${ f.prefix } Alpha` ),
			new RegExp( `${ f.prefix } Delta` ),
			new RegExp( `${ f.prefix } Bravo` ),
		] );
	} );

	test( 'the galleries list names a gallery\'s albums by title and the albums list counts their galleries', { tag: '@admin' }, async ( {
		page,
	} ) => {
		const f = build();

		await page.goto( `/wp-admin/edit.php?post_type=fotogrids_gallery&post_status=all&s=${ encodeURIComponent( f.prefix ) }` );
		const albums = page.locator( `#post-${ f.ids.Charlie } td.column-fotogrids_album` );
		await expect( albums.locator( 'a' ) ).toHaveText( [ `${ f.prefix } Mike`, `${ f.prefix } Zulu` ] );
		await expect( albums ).toContainText( '(2 albums)' );

		await page.goto( `/wp-admin/edit.php?post_type=fotogrids_album&s=${ encodeURIComponent( f.prefix ) }` );
		await expect( page.locator( `#post-${ f.zulu.id } td.column-fotogrids_galleries` ) ).toHaveText( '4' );
		await expect( page.locator( `#post-${ f.mike.id } td.column-fotogrids_galleries` ) ).toHaveText( '1' );
	} );
} );
