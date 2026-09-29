import { test, expect } from './support/test';
import type { APIRequestContext } from '@playwright/test';
import { fixture, firstItem } from './support/fixtures';
import { apiAnonymous, apiAs, roles } from './support/roles';

/**
 * API-layer checks that the REST routes returning gallery item data outside the
 * render pipeline apply the same access rules as a rendered gallery, and that
 * the template preview requires an editor.
 *
 * Readonly: every collection is a seeded fixture, and unlocking a password
 * gallery writes only to the visitor's own cookie jar.
 */

/** A REST route as a query string: `?rest_route=` ignores permalink structure. */
function route( path: string, query: Record< string, string | number > = {} ) {
	const params = new URLSearchParams( { rest_route: path } );
	for ( const [ key, value ] of Object.entries( query ) ) {
		params.set( key, String( value ) );
	}
	return `/?${ params.toString() }`;
}

function slides( galleryId: number ) {
	return { data: { gallery_id: galleryId, offset: 0, limit: 10 } };
}

test.describe( 'REST routes that return item data outside the render pipeline', () => {
	let anon: APIRequestContext;

	const orphan = () => fixture< number >( 'F-orphan', 'item' );
	const publicGallery = () => fixture< number >( 'F-single', 'gallery' );
	const publicItem = () => firstItem( 'F-single' );
	const regGallery = () => fixture< number >( 'F-reg', 'gallery' );
	const regItem = () => firstItem( 'F-reg' );
	const pwGallery = () => fixture< number >( 'F-pw', 'gallery' );
	const pwItem = () => firstItem( 'F-pw' );

	test.beforeAll( async ( { playwright } ) => {
		anon = await apiAnonymous( playwright );
	} );

	test.afterAll( async () => {
		await anon.dispose();
	} );

	test( 'SEC-01: an anonymous lightbox item request with no gallery is refused', async () => {
		const response = await anon.get(
			route( `/fotogrids/v1/lightbox/item/${ orphan() }` )
		);
		expect( response.status() ).toBe( 401 );
	} );

	test( 'SEC-01: naming a public gallery does not unlock an item outside it', async () => {
		const response = await anon.get(
			route( `/fotogrids/v1/lightbox/item/${ orphan() }`, {
				gallery_id: publicGallery(),
			} )
		);
		expect( response.status() ).toBe( 401 );
	} );

	test( 'an item in a public gallery stays readable anonymously', async () => {
		const response = await anon.get(
			route( `/fotogrids/v1/lightbox/item/${ publicItem() }`, {
				gallery_id: publicGallery(),
			} )
		);
		expect( response.status() ).toBe( 200 );
		expect( ( await response.json() ).id ).toBe( publicItem() );
	} );

	test( 'SEC-02: a lightbox item in a password gallery is refused until unlocked', async ( {
		playwright,
	} ) => {
		const itemRoute = route( `/fotogrids/v1/lightbox/item/${ pwItem() }`, {
			gallery_id: pwGallery(),
		} );
		expect( ( await anon.get( itemRoute ) ).status() ).toBe( 401 );

		const visitor = await apiAnonymous( playwright );
		const unlock = await visitor.post(
			route( `/fotogrids/v1/gallery/${ pwGallery() }/unlock` ),
			{ data: { password: fixture< string >( 'F-pw', 'password' ) } }
		);
		expect( unlock.status() ).toBe( 200 );
		expect( ( await visitor.get( itemRoute ) ).status() ).toBe( 200 );
		await visitor.dispose();
	} );

	test( 'SEC-02: a lightbox item in a registered-users gallery needs a signed-in visitor', async ( {
		playwright,
	} ) => {
		const itemRoute = route( `/fotogrids/v1/lightbox/item/${ regItem() }`, {
			gallery_id: regGallery(),
		} );
		expect( ( await anon.get( itemRoute ) ).status() ).toBe( 401 );

		const { context, nonce } = await apiAs( playwright, 'subscriber' );
		const response = await context.get( itemRoute, {
			headers: { 'X-WP-Nonce': nonce },
		} );
		expect( response.status() ).toBe( 200 );
		await context.dispose();
	} );

	test( 'SEC-03: lightbox slides for a registered-users gallery need a signed-in visitor', async ( {
		playwright,
	} ) => {
		const slidesRoute = route( '/fotogrids/v1/gallery/lightbox/slides' );
		expect(
			( await anon.post( slidesRoute, slides( regGallery() ) ) ).status()
		).toBe( 401 );

		const { context, nonce } = await apiAs( playwright, 'subscriber' );
		const response = await context.post( slidesRoute, {
			...slides( regGallery() ),
			headers: { 'X-WP-Nonce': nonce },
		} );
		expect( response.status() ).toBe( 200 );
		expect( ( await response.json() ).total ).toBe( 1 );
		await context.dispose();
	} );

	test( 'SEC-04: lightbox slides for a password gallery are refused until unlocked', async ( {
		playwright,
	} ) => {
		const slidesRoute = route( '/fotogrids/v1/gallery/lightbox/slides' );
		expect(
			( await anon.post( slidesRoute, slides( pwGallery() ) ) ).status()
		).toBe( 401 );

		const visitor = await apiAnonymous( playwright );
		await visitor.post(
			route( `/fotogrids/v1/gallery/${ pwGallery() }/unlock` ),
			{ data: { password: fixture< string >( 'F-pw', 'password' ) } }
		);
		const response = await visitor.post(
			slidesRoute,
			slides( pwGallery() )
		);
		expect( response.status() ).toBe( 200 );
		expect( ( await response.json() ).total ).toBe( 1 );
		await visitor.dispose();
	} );

	test( 'lightbox slides for a public gallery stay readable anonymously', async () => {
		const response = await anon.post(
			route( '/fotogrids/v1/gallery/lightbox/slides' ),
			slides( publicGallery() )
		);
		expect( response.status() ).toBe( 200 );
		expect( ( await response.json() ).total ).toBe( 1 );
	} );

	test( 'SEC-05: the template preview needs an editor, whatever nonce is sent', async ( {
		playwright,
	} ) => {
		const preview = ( nonce?: string ) =>
			route( '/fotogrids/v1/templates/preview', {
				template_id: 'clean-grid',
				category: 'gallery',
				...( nonce ? { _wpnonce: nonce } : {} ),
			} );

		expect( ( await anon.get( preview() ) ).status() ).toBe( 401 );
		// Core answers a malformed nonce with rest_cookie_invalid_nonce (403).
		expect( [ 401, 403 ] ).toContain(
			( await anon.get( preview( '0123456789' ) ) ).status()
		);
		expect(
			( await anon.get( preview( roles().guestNonce ) ) ).status()
		).toBe( 401 );

		const subscriber = await apiAs( playwright, 'subscriber' );
		expect(
			(
				await subscriber.context.get( preview( subscriber.nonce ) )
			).status()
		).toBe( 403 );
		await subscriber.context.dispose();

		const admin = await apiAs( playwright, 'administrator' );
		const response = await admin.context.get( preview( admin.nonce ) );
		expect( response.status() ).toBe( 200 );
		expect( response.headers()[ 'content-type' ] ).toContain( 'text/html' );
		await admin.context.dispose();
	} );
} );
