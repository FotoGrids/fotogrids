/**
 * Import / Export tool helpers.
 */
import {
	formatBytes,
	formatDate,
	importResultChips,
	parseSummary,
} from '../../includes/tools/import-export/assets/utils.js';

describe( 'formatBytes', () => {
	it( 'reports bytes, kilobytes and megabytes', () => {
		expect( formatBytes( 512 ) ).toBe( '512 B' );
		expect( formatBytes( 1536 ) ).toBe( '1.5 KB' );
		expect( formatBytes( 3 * 1048576 ) ).toBe( '3.0 MB' );
	} );
} );

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
