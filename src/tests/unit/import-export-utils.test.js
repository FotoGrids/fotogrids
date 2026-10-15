/**
 * Import / Export tool helpers.
 */
import {
	formatDate,
	importResultChips,
	itemsDetail,
	parseSummary,
} from '../../includes/tools/import-export/assets/utils.js';

describe( 'formatDate', () => {
	it( 'formats an ISO date for the locale', () => {
		const iso = '2026-10-11T18:29:04+03:00';

		expect( formatDate( iso ) ).toBe( new Date( iso ).toLocaleString() );
	} );
} );

describe( 'parseSummary', () => {
	it( 'returns nothing for an empty summary', () => {
		expect( parseSummary( '' ) ).toEqual( [] );
		expect( parseSummary( '   ' ) ).toEqual( [] );
		expect( parseSummary( undefined ) ).toEqual( [] );
	} );

	it( 'reads an export summary with counts, settings and the format', () => {
		expect(
			parseSummary( '12 galleries, 1 albums, 0 templates, settings · JSON' )
		).toEqual( [
			{ variant: 'count', count: 12, label: 'Galleries' },
			{ variant: 'count', count: 1, label: 'Album' },
			{ variant: 'empty', count: 0, label: 'Templates' },
			{ variant: 'count', label: 'Settings' },
			{ variant: 'format', label: 'JSON' },
		] );
	} );

	it( 'reads an import summary with a skipped count', () => {
		expect( parseSummary( '3 galleries, 1 items · 2 skipped' ) ).toEqual( [
			{ variant: 'count', count: 3, label: 'Galleries' },
			{ variant: 'count', count: 1, label: 'Item' },
			{ variant: 'skipped', count: 2, label: 'skipped' },
		] );
	} );

	it( 'reads a summary of skipped records only', () => {
		expect( parseSummary( ' · 1 skipped' ) ).toEqual( [
			{ variant: 'skipped', count: 1, label: 'skipped' },
		] );
	} );

	it( 'keeps an unknown data type as written', () => {
		expect( parseSummary( '4 widgets' ) ).toEqual( [
			{ variant: 'count', count: 4, label: 'widgets' },
		] );
	} );
} );

describe( 'importResultChips', () => {
	it( 'lists imported types in export order, singular for one', () => {
		expect(
			importResultChips( {
				albums: 1,
				galleries: 2,
				settings: true,
				items: 0,
			} )
		).toEqual( [
			{ key: 'galleries', count: 2, label: 'Galleries' },
			{ key: 'albums', count: 1, label: 'Album' },
			{ key: 'settings', label: 'Settings' },
		] );
	} );

	it( 'labels a type with no singular form by its export name', () => {
		expect( importResultChips( { statistics: 5 } ) ).toEqual( [
			{ key: 'statistics', label: 'Statistics' },
		] );
	} );

	it( 'returns nothing for an empty or missing side', () => {
		expect( importResultChips( {} ) ).toEqual( [] );
		expect( importResultChips( [] ) ).toEqual( [] );
		expect( importResultChips( undefined ) ).toEqual( [] );
	} );
} );

describe( 'itemsDetail', () => {
	it( 'names both kinds when there are images and videos', () => {
		expect( itemsDetail( { images: 83, videos: 4 } ) ).toBe( '(83 images, 4 videos)' );
	} );

	it( 'uses the singular for one', () => {
		expect( itemsDetail( { images: 1, videos: 1 } ) ).toBe( '(1 image, 1 video)' );
	} );

	it( 'names only the kind there is', () => {
		expect( itemsDetail( { images: 0, videos: 2 } ) ).toBe( '(2 videos)' );
		expect( itemsDetail( { images: 5, videos: 0 } ) ).toBe( '(5 images)' );
	} );

	it( 'says nothing without counts', () => {
		expect( itemsDetail( undefined ) ).toBe( '' );
		expect( itemsDetail( { images: 0, videos: 0 } ) ).toBe( '' );
	} );
} );

describe( 'importResultChips with an items split', () => {
	it( 'adds the split to the items chip only', () => {
		expect(
			importResultChips( {
				galleries: 1,
				items: 3,
				items_detail: { images: 1, videos: 2 },
			} )
		).toEqual( [
			{ key: 'galleries', count: 1, label: 'Gallery' },
			{ key: 'items', count: 3, label: 'Items', detail: '(1 image, 2 videos)' },
		] );
	} );

	it( 'leaves the items chip plain without a split', () => {
		expect( importResultChips( { items: 3 } ) ).toEqual( [
			{ key: 'items', count: 3, label: 'Items' },
		] );
	} );
} );
