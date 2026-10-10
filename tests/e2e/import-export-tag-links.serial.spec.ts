import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './support/test';
import { firstItem } from './support/fixtures';
import { apiAs, wpEval } from './support/roles';

/**
 * Item links to tags, people and locations across an export and import.
 *
 * Serial: these write to the site-wide Library tables, and remove what they
 * create.
 */

type Row = Record< string, string | number >;

type ExportFile = {
	meta: Row;
	items: Row[];
	item_metadata: Row[];
	tags?: Row[];
};

const EXPORT = '/fotogrids/v1/admin/tools/import-export/export';
const IMPORT = '/fotogrids/v1/admin/tools/import-export/import';

/** An id no attachment on the test site has. */
const MISSING_ATTACHMENT = 999999999;

const run = Date.now().toString( 36 );

function route( path: string, query: string[][] = [] ): string {
	return `/?${ new URLSearchParams( [ [ 'rest_route', path ], ...query ] ).toString() }`;
}

function attachment(): number {
	return firstItem( 'F-small' );
}

/** Add a Library entry and return its id. */
function addEntry( type: 'tag' | 'person', name: string ): number {
	return Number(
		wpEval(
			`echo \\FotoGrids\\Metadata_Manager::add_or_get_metadata( '${ type }', '${ name }' )->id;`
		).trim()
	);
}

function link( type: 'tag' | 'person', id: number ): void {
	wpEval( `\\FotoGrids\\Metadata_Manager::link_${ type }_to_item( ${ attachment() }, ${ id } );` );
}

/** Delete every Library entry with this name, and its links. */
function removeEntries( names: string[] ): void {
	for ( const name of names ) {
		wpEval( `
			global $wpdb;
			$ids = $wpdb->get_col( $wpdb->prepare( 'SELECT id FROM %i WHERE name = %s', $wpdb->prefix . 'fotogrids_tags', '${ name }' ) );
			foreach ( $ids as $id ) {
				\\FotoGrids\\Metadata_Manager::delete_metadata( (int) $id );
			}
		` );
	}
}

function entriesNamed( name: string ): Array< { id: number; usage_count: number } > {
	const rows = JSON.parse(
		wpEval( `
			global $wpdb;
			echo wp_json_encode( $wpdb->get_results( $wpdb->prepare( 'SELECT id, usage_count FROM %i WHERE name = %s', $wpdb->prefix . 'fotogrids_tags', '${ name }' ) ) );
		` )
	) as Row[];

	return rows.map( ( r ) => ( { id: Number( r.id ), usage_count: Number( r.usage_count ) } ) );
}

/** The attachments linked to one Library entry. */
function linkedTo( type: string, id: number ): number[] {
	return (
		JSON.parse(
			wpEval( `
				global $wpdb;
				echo wp_json_encode( $wpdb->get_col( $wpdb->prepare( 'SELECT attachment_id FROM %i WHERE metadata_type = %s AND metadata_id = %d', $wpdb->prefix . 'fotogrids_item_metadata', '${ type }', ${ id } ) ) );
			` )
		) as string[]
	).map( Number );
}

test.describe( 'importing item links to the Library', { tag: [ '@api' ] }, () => {
	let admin: APIRequestContext;
	let headers: Record< string, string >;
	const names: string[] = [];

	test.beforeAll( async ( { playwright } ) => {
		const session = await apiAs( playwright, 'administrator' );
		admin = session.context;
		headers = { 'X-WP-Nonce': session.nonce };
	} );

	test.afterEach( () => {
		removeEntries( names.splice( 0 ) );
	} );

	test.afterAll( async () => {
		await admin.dispose();
	} );

	/** Entries with these names, linked to the test attachment. */
	function linkedEntries( type: 'tag' | 'person', ...entryNames: string[] ): number[] {
		return entryNames.map( ( name ) => {
			names.push( name );
			const id = addEntry( type, name );
			link( type, id );
			return id;
		} );
	}

	/** The site's export, narrowed to the test attachment and these entries. */
	async function exportOf( entryNames: string[] ): Promise< ExportFile > {
		const response = await admin.get(
			route( EXPORT, [
				[ 'include[]', 'items' ],
				[ 'include[]', 'tags' ],
			] ),
			{ headers }
		);
		expect( response.ok() ).toBe( true );

		const file = ( await response.json() ) as Required< ExportFile >;
		const tags = file.tags.filter( ( t ) => entryNames.includes( String( t.name ) ) );
		const keys = new Set( tags.map( ( t ) => `${ t.type }:${ t.id }` ) );

		return {
			meta: file.meta,
			items: file.items.filter( ( r ) => Number( r.attachment_id ) === attachment() ),
			item_metadata: file.item_metadata.filter(
				( r ) =>
					Number( r.attachment_id ) === attachment() &&
					keys.has( `${ r.metadata_type }:${ r.metadata_id }` )
			),
			tags,
		};
	}

	async function importFile( file: ExportFile, include: string[] ) {
		const response = await admin.post( route( IMPORT ), {
			headers,
			data: { phase: 'execute', file: JSON.stringify( file ), include },
		} );
		expect( response.status() ).toBe( 200 );
		return response.json();
	}

	test( 'a tag and a person the import recreates keep their items', async () => {
		const tag = `Harbour ${ run }`;
		const person = `Ada ${ run }`;
		const [ oldTag ] = linkedEntries( 'tag', tag );
		const [ oldPerson ] = linkedEntries( 'person', person );
		const file = await exportOf( [ tag, person ] );
		removeEntries( [ tag, person ] );

		const result = await importFile( file, [ 'items', 'tags' ] );
		expect( result.imported.tags ).toBe( 2 );

		for ( const [ type, name, oldId ] of [
			[ 'tag', tag, oldTag ],
			[ 'person', person, oldPerson ],
		] as const ) {
			const [ entry ] = entriesNamed( name );
			expect( entry.id ).not.toBe( oldId );
			expect( linkedTo( type, entry.id ) ).toEqual( [ attachment() ] );
			expect( entry.usage_count ).toBe( 1 );
			expect( linkedTo( type, oldId ) ).toEqual( [] );
		}
	} );

	test( 'a tag already on the site under another id takes the links', async () => {
		const tag = `Pier ${ run }`;
		const [ oldId ] = linkedEntries( 'tag', tag );
		const file = await exportOf( [ tag ] );
		removeEntries( [ tag ] );
		const siteId = addEntry( 'tag', tag );
		file.item_metadata.push( {
			attachment_id: MISSING_ATTACHMENT,
			metadata_type: 'tag',
			metadata_id: oldId,
		} );

		const result = await importFile( file, [ 'items', 'tags' ] );
		expect( result.skipped.tags ).toBe( 1 );

		expect( linkedTo( 'tag', siteId ) ).toEqual( [ attachment() ] );
		expect( entriesNamed( tag ) ).toEqual( [ { id: siteId, usage_count: 1 } ] );
		expect( linkedTo( 'tag', oldId ) ).toEqual( [] );
	} );

	test( 'with Tags left out, links reach tags already on the site and no tag is created', async () => {
		const kept = `Lighthouse ${ run }`;
		const gone = `Dune ${ run }`;
		const [ keptOld, goneOld ] = linkedEntries( 'tag', kept, gone );
		const file = await exportOf( [ kept, gone ] );
		removeEntries( [ kept, gone ] );
		const keptId = addEntry( 'tag', kept );

		const result = await importFile( file, [ 'items' ] );
		expect( result.imported.tags ).toBeUndefined();

		expect( linkedTo( 'tag', keptId ) ).toEqual( [ attachment() ] );
		expect( entriesNamed( kept ) ).toEqual( [ { id: keptId, usage_count: 1 } ] );
		expect( entriesNamed( gone ) ).toEqual( [] );
		expect( linkedTo( 'tag', keptOld ) ).toEqual( [] );
		expect( linkedTo( 'tag', goneOld ) ).toEqual( [] );
	} );

	test( 'a file exported without tags imports no links', async () => {
		const tag = `Quay ${ run }`;
		const [ oldId ] = linkedEntries( 'tag', tag );
		const file = await exportOf( [ tag ] );
		delete file.tags;
		removeEntries( [ tag ] );
		const siteId = addEntry( 'tag', tag );

		await importFile( file, [ 'items' ] );

		expect( linkedTo( 'tag', siteId ) ).toEqual( [] );
		expect( linkedTo( 'tag', oldId ) ).toEqual( [] );
	} );
} );
