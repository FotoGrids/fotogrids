import { readFileSync } from 'fs';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { firstItem } from './support/fixtures';
import { storageStateFor, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Item links to tags and people across an export and an import made on the
 * Import / Export screen, checked in the Library.
 *
 * Serial: these write to the site-wide Library tables and import into the
 * whole site. Each test removes what it created.
 */

test.describe.configure( { mode: 'serial' } );

const TOOL = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const LIBRARY = '/wp-admin/admin.php?page=fotogrids-library';

const run = Date.now().toString( 36 );

function attachment(): number {
	return firstItem( 'F-small' );
}

/** Add a Library entry, link it to the test attachment and return its id. */
function linkedEntry( type: 'tag' | 'person', name: string ): number {
	return Number(
		wpEval( `
			$entry = \\FotoGrids\\Metadata_Manager::add_or_get_metadata( '${ type }', '${ name }' );
			\\FotoGrids\\Metadata_Manager::link_${ type }_to_item( ${ attachment() }, (int) $entry->id );
			echo $entry->id;
		` ).trim()
	);
}

/** Delete every Library entry with these names, and their links. */
function removeEntries( names: string[] ): void {
	for ( const name of names ) {
		wpEval( `
			global $wpdb;
			foreach ( $wpdb->get_col( $wpdb->prepare( 'SELECT id FROM %i WHERE name = %s', $wpdb->prefix . 'fotogrids_tags', '${ name }' ) ) as $id ) {
				\\FotoGrids\\Metadata_Manager::delete_metadata( (int) $id );
			}
		` );
	}
}

/** The ids of the entries with this name that link to the test attachment. */
function linkedIds( type: string, name: string ): number[] {
	return (
		JSON.parse(
			wpEval( `
				global $wpdb;
				echo wp_json_encode( $wpdb->get_col( $wpdb->prepare(
					'SELECT t.id FROM %i t JOIN %i l ON l.metadata_id = t.id AND l.metadata_type = t.type WHERE t.type = %s AND t.name = %s AND l.attachment_id = %d',
					$wpdb->prefix . 'fotogrids_tags',
					$wpdb->prefix . 'fotogrids_item_metadata',
					'${ type }',
					'${ name }',
					${ attachment() }
				) ) );
			` )
		) as string[]
	).map( Number );
}

/** The Items column of a Library entry, found through the tab's search; null when it is not listed. */
async function itemsInLibrary( page: Page, tab: string, name: string ): Promise< string | null > {
	await page.goto( LIBRARY );
	await page.locator( '.fotogrids-library-sidebar-tabs' ).getByText( tab, { exact: true } ).first().click();
	await page.locator( '.fotogrids-library-toolbar-search input' ).fill( name );
	await expect( page.locator( '.fotogrids-library-loading' ) ).toHaveCount( 0 );

	const row = page.locator( '.fotogrids-library-table tbody tr' ).filter( {
		has: page.locator( '.fotogrids-library-name-button', { hasText: name } ),
	} );
	await expect( row.or( page.locator( '.fotogrids-library-empty' ) ).first() ).toBeVisible();

	return ( await row.count() ) ? ( await row.locator( '.fotogrids-library-table__column-usage' ).innerText() ).trim() : null;
}

async function deleteInLibrary( page: Page, tab: string, name: string ): Promise< void > {
	await page.goto( LIBRARY );
	await page.locator( '.fotogrids-library-sidebar-tabs' ).getByText( tab, { exact: true } ).first().click();
	const row = page.locator( '.fotogrids-library-table tbody tr' ).filter( {
		has: page.locator( '.fotogrids-library-name-button', { hasText: name } ),
	} );
	await row.getByRole( 'button', { name: 'Delete' } ).click();
	await page.locator( '.fotogrids-library-delete-popover' ).getByRole( 'button', { name: 'Delete' } ).click();
	await expect( row ).toHaveCount( 0 );
}

/** Export items, item links and the Library from the Export tab; returns the file path. */
async function exportFile( page: Page, format: 'JSON' | 'XML' ): Promise< string > {
	const keep = [ 'Items', 'Item Metadata', 'Tags' ];

	await page.goto( TOOL );
	await page.locator( '.fotogrids-tab-bar__tab', { hasText: 'Export' } ).click();
	for ( const label of [ 'Galleries', 'Albums', 'Items', 'Item Metadata', 'Tags', 'Settings', 'Statistics', 'Templates' ] ) {
		const toggle = page.getByRole( 'switch', { name: label, exact: true } );
		if ( ( 'true' === ( await toggle.getAttribute( 'aria-checked' ) ) ) !== keep.includes( label ) ) {
			await toggle.click();
		}
	}
	await page.getByRole( 'radio', { name: format, exact: true } ).click();

	const [ download ] = await Promise.all( [
		page.waitForEvent( 'download' ),
		page.locator( '.fg-ie-actions' ).getByRole( 'button', { name: 'Export', exact: true } ).click(),
	] );
	const file = test.info().outputPath( `export.${ format.toLowerCase() }` );
	await download.saveAs( file );

	return file;
}

/** Import a file from the Import tab, switching off the listed types first. */
async function importFile( page: Page, file: string, off: string[] = [] ): Promise< void > {
	await page.goto( TOOL );
	await page.locator( '.fotogrids-tab-bar__tab', { hasText: 'Import' } ).click();
	await page.locator( 'input[type=file]' ).setInputFiles( file );

	await expect( page.locator( '#fg-ie-import-items' ) ).toBeVisible();
	await expect( page.locator( '#fg-ie-import-tags' ) ).toBeVisible();
	for ( const key of off ) {
		await page.locator( `#fg-ie-import-${ key }` ).click();
	}

	const executed = page.waitForResponse(
		( r ) =>
			decodeURIComponent( r.url() ).includes( 'import-export/import' ) &&
			( r.request().postData() ?? '' ).includes( '"execute"' )
	);
	await page.getByRole( 'button', { name: 'Import', exact: true } ).last().click();
	expect( ( await executed ).status() ).toBe( 200 );
	await expect( page.locator( '.fg-ie-done' ) ).toBeVisible();
}

test.describe( 'the Import / Export screen and the Library', { tag: [ '@admin' ] }, () => {
	const names: string[] = [];
	let createdItemRow = false;

	test.beforeAll( () => {
		// The Import tab offers Items only when the file carries an item row; Edit Item writes one.
		createdItemRow =
			'1' ===
			wpEval( `
				if ( null === \\FotoGrids\\Galleries\\Item_Meta::get( ${ attachment() } ) ) {
					\\FotoGrids\\Galleries\\Item_Meta::save( ${ attachment() }, array( 'credit' => '' ) );
					echo 1;
				}
			` ).trim();
	} );

	test.afterEach( () => {
		removeEntries( names.splice( 0 ) );
	} );

	test.afterAll( () => {
		if ( createdItemRow ) {
			wpEval( `
				global $wpdb;
				$wpdb->delete( $wpdb->prefix . 'fotogrids_item_meta', array( 'attachment_id' => ${ attachment() } ) );
			` );
		}
	} );

	for ( const format of [ 'JSON', 'XML' ] as const ) {
		test( `a tag and a person deleted in the Library come back with their item after a round trip through ${ format }`, async ( { page } ) => {
			const tag = `Harbour ${ format } ${ run }`;
			const person = `Ada ${ format } ${ run }`;
			names.push( tag, person );
			const oldTag = linkedEntry( 'tag', tag );
			const oldPerson = linkedEntry( 'person', person );

			const file = await exportFile( page, format );
			expect( readFileSync( file, 'utf8' ) ).toContain( tag );

			await deleteInLibrary( page, 'Tags', tag );
			await deleteInLibrary( page, 'People', person );
			expect( linkedIds( 'tag', tag ) ).toEqual( [] );

			await importFile( page, file );

			const [ newTag ] = linkedIds( 'tag', tag );
			const [ newPerson ] = linkedIds( 'person', person );
			expect( newTag ).toBeGreaterThan( oldTag );
			expect( newPerson ).toBeGreaterThan( oldPerson );
			expect( await itemsInLibrary( page, 'Tags', tag ) ).toBe( '1' );
			expect( await itemsInLibrary( page, 'People', person ) ).toBe( '1' );
		} );
	}

	test( 'with Tags switched off, an import links the item to the tag the Library already has and adds nothing', async ( {
		page,
	} ) => {
		const kept = `Lighthouse ${ run }`;
		const gone = `Grace ${ run }`;
		names.push( kept, gone );
		linkedEntry( 'tag', kept );
		linkedEntry( 'person', gone );

		const file = await exportFile( page, 'JSON' );
		await deleteInLibrary( page, 'Tags', kept );
		await deleteInLibrary( page, 'People', gone );

		await page.goto( LIBRARY );
		await page.locator( '.fotogrids-library-sidebar-tabs' ).getByText( 'Tags', { exact: true } ).first().click();
		await page.getByRole( 'button', { name: 'Add Tag' } ).click();
		await page.fill( '#fg-library-create-name', kept );
		await page.getByRole( 'button', { name: 'Create', exact: true } ).click();
		await expect( page.locator( '.fotogrids-library-name-button', { hasText: kept } ) ).toBeVisible();

		await importFile( page, file, [ 'tags' ] );

		expect( linkedIds( 'tag', kept ) ).toHaveLength( 1 );
		expect( await itemsInLibrary( page, 'Tags', kept ) ).toBe( '1' );
		expect( await itemsInLibrary( page, 'People', gone ) ).toBeNull();
	} );
} );
