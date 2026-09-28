import { test, expect, APIRequestContext } from '@playwright/test';
import { galleryPage, Settings } from './support/collections';
import { firstItem } from './support/fixtures';
import { apiAnonymous } from './support/roles';

/**
 * The Lightbox item route returns only what the gallery's info panel shows.
 *
 * Scoped: each test builds its own gallery around a seeded item and reads it;
 * the seeded items themselves are never written.
 */

function itemRoute( itemId: number, galleryId: number ) {
	const params = new URLSearchParams( {
		rest_route: `/fotogrids/v1/lightbox/item/${ itemId }`,
		gallery_id: String( galleryId ),
	} );
	return `/?${ params.toString() }`;
}

const ALL_BLOCKS = [
	'caption',
	'description',
	'file_info',
	'exif',
	'credit',
	'tags',
	'people',
	'location',
];

/** A list setting, as JSON text: the settings codec keeps a list only in that form. */
function list( values: string[] ): string {
	return JSON.stringify( values );
}

function blocksWithout( block: string ): string {
	return list( ALL_BLOCKS.filter( ( b ) => b !== block ) );
}

test.describe( 'GET /lightbox/item/{id}', () => {
	let anon: APIRequestContext;

	test.beforeAll( async ( { playwright } ) => {
		anon = await apiAnonymous( playwright );
	} );

	test.afterAll( async () => {
		await anon.dispose();
	} );

	async function itemData( itemId: number, settings: Settings ) {
		const { id } = galleryPage( settings, [ itemId ] );
		const response = await anon.get( itemRoute( itemId, id ) );
		expect( response.status() ).toBe( 200 );
		return response.json();
	}

	test( 'EXIF holds only the fields the gallery displays', async () => {
		const data = await itemData( firstItem( 'F-exif' ), {
			display_exif: true,
			exif_fields: list( [ 'camera' ] ),
			lightbox_info_blocks: list( ALL_BLOCKS ),
		} );

		expect( Object.keys( data.exif ?? {} ) ).toEqual( [ 'camera' ] );
	} );

	test( 'EXIF is empty when the EXIF block is off', async () => {
		const data = await itemData( firstItem( 'F-exif' ), {
			display_exif: true,
			exif_fields: list( [ 'camera', 'gps_latitude' ] ),
			lightbox_info_blocks: blocksWithout( 'exif' ),
		} );

		expect( data.exif ).toBeNull();
	} );

	test( 'location coordinates are returned when the location block is shown', async () => {
		const data = await itemData( firstItem( 'F-tagged' ), {
			lightbox_info_blocks: list( ALL_BLOCKS ),
		} );

		expect( data.location ).toEqual( {
			name: 'Tel Aviv',
			latitude: 32.0853,
			longitude: 34.7818,
		} );
	} );

	test( 'location coordinates are withheld when the location block is off', async () => {
		const data = await itemData( firstItem( 'F-tagged' ), {
			lightbox_info_blocks: blocksWithout( 'location' ),
		} );

		expect( data.location ).toEqual( { name: 'Tel Aviv' } );
	} );
} );
