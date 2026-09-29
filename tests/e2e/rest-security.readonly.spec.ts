import { test, expect } from './support/test';
import type { APIRequestContext } from '@playwright/test';
import { fixture, firstItem } from './support/fixtures';
import { apiAnonymous, apiAs } from './support/roles';

/**
 * Who may read gallery data over REST, and what the routes hand back when they
 * should refuse.
 *
 * `readonly`: every request here either reads or is rejected, so nothing on the
 * site changes.
 *
 * Rows marked `test.fail` assert what the route should do. They fail today and
 * are expected to; the day the linked fix lands, Playwright reports the
 * unexpected pass and the marker comes off.
 */

function route( path: string, query: Record< string, string | number > = {} ) {
	const params = new URLSearchParams( { rest_route: path } );
	for ( const [ key, value ] of Object.entries( query ) ) {
		params.set( key, String( value ) );
	}
	return `/?${ params.toString() }`;
}

test.describe( 'gallery gates over REST', () => {
	let anon: APIRequestContext;

	test.beforeAll( async ( { playwright } ) => {
		anon = await apiAnonymous( playwright );
	} );

	test.afterAll( async () => {
		await anon.dispose();
	} );

	test( 'SEC-06: an anonymous unscoped item query returns nothing', async () => {
		const response = await anon.get( route( '/fotogrids/v1/items' ) );

		expect( response.status() ).toBe( 200 );
		expect( ( await response.json() ).items ).toEqual( [] );
	} );

	test( 'SEC-07: a draft gallery yields no items anonymously', async () => {
		for ( const key of [ 'draft', 'private', 'trashed' ] ) {
			const response = await anon.get(
				route( '/fotogrids/v1/items', {
					gallery: fixture< number >( 'F-draft', key ),
				} )
			);

			expect( response.status(), `${ key } gallery` ).toBe( 200 );
			expect( ( await response.json() ).items, `${ key } gallery` ).toEqual( [] );
		}
	} );

	test( 'a password gallery yields no items to an anonymous caller', async () => {
		test.fail( true, 'gates are not evaluated on /items — FotoGrids/backstage#378' );

		const response = await anon.get(
			route( '/fotogrids/v1/items', {
				gallery: fixture< number >( 'F-pw', 'gallery' ),
			} )
		);

		expect( ( await response.json() ).items ).toEqual( [] );
	} );

	test( 'a registered-users gallery yields no items to an anonymous caller', async () => {
		test.fail( true, 'gates are not evaluated on /items — FotoGrids/backstage#378' );

		const response = await anon.get(
			route( '/fotogrids/v1/items', {
				gallery: fixture< number >( 'F-reg', 'gallery' ),
			} )
		);

		expect( ( await response.json() ).items ).toEqual( [] );
	} );

	test( 'a password gallery is not readable through /gallery/{id}', async () => {
		test.fail( true, 'gates are not evaluated on /gallery/{id} — FotoGrids/backstage#378' );

		const response = await anon.get(
			route( `/fotogrids/v1/gallery/${ fixture< number >( 'F-pw', 'gallery' ) }` )
		);

		expect( response.status() ).toBe( 401 );
	} );

	test( 'a contributor sees no unpublished galleries they do not own', async ( {
		playwright,
	} ) => {
		test.fail( true, 'unscoped /items ignores authorship — FotoGrids/backstage#381' );

		const { context, nonce } = await apiAs( playwright, 'contributor' );

		const response = await context.get( route( '/fotogrids/v1/items' ), {
			headers: { 'X-WP-Nonce': nonce },
		} );
		const items: unknown[] = ( await response.json() ).items ?? [];
		await context.dispose();

		expect( items ).toEqual( [] );
	} );
} );

test.describe( 'the unlock route gives nothing away', () => {
	let anon: APIRequestContext;

	const unlock = ( id: number, password: string ) =>
		anon.post( route( `/fotogrids/v1/gallery/${ id }/unlock` ), {
			data: { password },
		} );

	test.beforeAll( async ( { playwright } ) => {
		anon = await apiAnonymous( playwright );
	} );

	test.afterAll( async () => {
		await anon.dispose();
	} );

	/**
	 * SEC-10. A gallery with no password must answer a guess exactly as a
	 * password gallery answers a wrong one, or the response tells an attacker
	 * which galleries are worth attacking.
	 */
	test( 'SEC-10: a wrong password and an unprotected gallery answer alike', async () => {
		const wrong = await unlock( fixture< number >( 'F-pw', 'gallery' ), 'nope' );
		const none = await unlock( fixture< number >( 'F-small', 'gallery' ), 'nope' );

		expect( wrong.status() ).toBe( 401 );
		expect( none.status() ).toBe( 401 );
		expect( ( await none.json() ).code ).toBe( ( await wrong.json() ).code );
	} );

	test( 'SEC-10: the right password unlocks', async () => {
		const response = await unlock(
			fixture< number >( 'F-pw', 'gallery' ),
			fixture< string >( 'F-pw', 'password' )
		);

		expect( response.status() ).toBe( 200 );
	} );
} );

test.describe( 'capabilities on admin and preview routes', () => {
	/** SEC-20. Preview skips every gate, so it must require the manage cap. */
	test( 'SEC-20: preview refuses an editor', async ( { playwright } ) => {
		const { context, nonce } = await apiAs( playwright, 'editor' );

		const response = await context.post(
			route(
				`/fotogrids/v1/preview/gallery/${ fixture< number >( 'F-pw', 'gallery' ) }`
			),
			{ headers: { 'X-WP-Nonce': nonce } }
		);
		await context.dispose();

		expect( response.status() ).toBe( 403 );
	} );

	/**
	 * SEC-12. Media settings are the one settings route on `manage_fotogrids`;
	 * every sibling uses `manage_fotogrids_settings`. Both default to
	 * administrator, so this pins the asymmetry rather than a privilege gap.
	 */
	test( 'SEC-12: media settings and general settings agree for an editor', async ( {
		playwright,
	} ) => {
		const { context, nonce } = await apiAs( playwright, 'editor' );
		const headers = { 'X-WP-Nonce': nonce };

		const media = await context.get(
			route( '/fotogrids/v1/admin/media-settings' ),
			{ headers }
		);
		const general = await context.get(
			route( '/fotogrids/v1/admin/general-settings' ),
			{ headers }
		);
		await context.dispose();

		expect( media.status() ).toBe( 403 );
		expect( general.status() ).toBe( 403 );
	} );
} );

test.describe( 'query arguments reach SQL safely', () => {
	let anon: APIRequestContext;

	test.beforeAll( async ( { playwright } ) => {
		anon = await apiAnonymous( playwright );
	} );

	test.afterAll( async () => {
		await anon.dispose();
	} );

	/**
	 * SEC-16. A probe that reached SQL unprepared would surface as a 500 or a
	 * database error in the body; a prepared one is simply an unmatched search.
	 */
	test( 'SEC-16: injection probes return a normal empty result', async () => {
		const probes = [
			"' OR 1=1 --",
			'"; DROP TABLE wp_posts; --',
			"1' UNION SELECT user_pass FROM wp_users --",
		];

		for ( const probe of probes ) {
			const response = await anon.get(
				route( '/fotogrids/v1/items', {
					gallery: fixture< number >( 'F-small', 'gallery' ),
					search: probe,
				} )
			);

			expect( response.status(), probe ).toBe( 200 );
			expect( await response.text(), probe ).not.toMatch(
				/SQL|mysqli|database error/i
			);
		}
	} );

	test( 'SEC-16: a public item request still works alongside the probes', async () => {
		const response = await anon.get(
			route( `/fotogrids/v1/lightbox/item/${ firstItem( 'F-small' ) }`, {
				gallery_id: fixture< number >( 'F-small', 'gallery' ),
			} )
		);

		expect( response.status() ).toBe( 200 );
	} );
} );
