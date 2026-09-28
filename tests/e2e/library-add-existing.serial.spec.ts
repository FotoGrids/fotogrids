import { test, expect, APIRequestContext } from '@playwright/test';
import { apiAs } from './support/roles';

/**
 * Adding a tag, person or location that already exists.
 *
 * Library "Add" refuses an existing name and changes nothing. The item editor's
 * add-by-name route reuses the existing entry and only fills coordinates it
 * does not have yet.
 *
 * Serial: these write to the site-wide Library tables, and remove what they
 * create.
 */

function route( path: string, query: Record< string, string > = {} ) {
	return `/?${ new URLSearchParams( {
		rest_route: path,
		...query,
	} ).toString() }`;
}

test.describe( 'adding an existing Library entry', () => {
	let admin: APIRequestContext;
	let headers: Record< string, string >;
	const created: Array< { type: string; id: number } > = [];

	test.beforeAll( async ( { playwright } ) => {
		const session = await apiAs( playwright, 'administrator' );
		admin = session.context;
		headers = { 'X-WP-Nonce': session.nonce };
	} );

	test.afterAll( async () => {
		for ( const { type, id } of created ) {
			await admin.delete(
				route( `/fotogrids/v1/library/${ type }/${ id }` ),
				{ headers }
			);
		}
		await admin.dispose();
	} );

	async function findLocation( name: string ) {
		const response = await admin.get(
			route( '/fotogrids/v1/library/locations', { search: name } ),
			{ headers }
		);
		const body = await response.json();
		return body.items.find( ( i: { name: string } ) => i.name === name );
	}

	test( 'a tag name in any case is refused as existing', async () => {
		const response = await admin.post(
			route( '/fotogrids/v1/library/tags' ),
			{ headers, data: { name: 'sunset' } }
		);

		expect( response.status() ).toBe( 409 );
		const body = await response.json();
		expect( body.code ).toBe( 'fotogrids_library_exists' );
		expect( body.message ).toContain( 'Sunset' );
	} );

	test( 'an existing location keeps its coordinates', async () => {
		const response = await admin.post(
			route( '/fotogrids/v1/library/locations' ),
			{ headers, data: { name: 'Kyoto', latitude: 1, longitude: 2 } }
		);

		expect( response.status() ).toBe( 409 );
		expect( await findLocation( 'Kyoto' ) ).toMatchObject( {
			latitude: 35.0116,
			longitude: 135.7681,
		} );
	} );

	test( 'the item editor reuses an existing location without moving it', async () => {
		const response = await admin.post(
			route( '/fotogrids/v1/metadata/locations' ),
			{ headers, data: { name: 'kyoto', latitude: 1, longitude: 2 } }
		);

		expect( response.status() ).toBe( 200 );
		expect( await response.json() ).toMatchObject( {
			name: 'Kyoto',
			latitude: 35.0116,
			longitude: 135.7681,
		} );
	} );

	test( 'the item editor fills coordinates a location does not have', async () => {
		const add = await admin.post(
			route( '/fotogrids/v1/library/locations' ),
			{ headers, data: { name: 'E2E No Coordinates' } }
		);
		expect( add.status() ).toBe( 200 );
		const location = await add.json();
		created.push( { type: 'locations', id: location.id } );
		expect( location.latitude ).toBeNull();

		const reuse = await admin.post(
			route( '/fotogrids/v1/metadata/locations' ),
			{
				headers,
				data: {
					name: 'E2E No Coordinates',
					latitude: 48.8566,
					longitude: 2.3522,
				},
			}
		);

		expect( await reuse.json() ).toMatchObject( {
			id: location.id,
			latitude: 48.8566,
			longitude: 2.3522,
		} );
	} );

	test( 'coordinates out of range or half-entered are refused', async () => {
		for ( const data of [
			{ name: 'E2E Bad', latitude: 91, longitude: 0 },
			{ name: 'E2E Bad', latitude: 'abc', longitude: 0 },
			{ name: 'E2E Bad', latitude: 10 },
		] ) {
			const response = await admin.post(
				route( '/fotogrids/v1/library/locations' ),
				{ headers, data }
			);
			expect( response.status() ).toBe( 400 );
			expect( ( await response.json() ).code ).toBe(
				'fotogrids_invalid_coordinates'
			);
		}
		expect( await findLocation( 'E2E Bad' ) ).toBeUndefined();
	} );

	test( 'the Locations list counts coordinates across every location', async () => {
		const response = await admin.get(
			route( '/fotogrids/v1/library/locations', { per_page: '1' } ),
			{ headers }
		);
		const body = await response.json();

		expect( body.items ).toHaveLength( 1 );
		expect( body.summary.with_coordinates ).toBeGreaterThanOrEqual( 2 );
	} );
} );
