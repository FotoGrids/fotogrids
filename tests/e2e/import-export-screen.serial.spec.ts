import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { storageStateFor, wpCli } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Tools > Import / Export: the Export and History tabs, the Import tab's file
 * handling, and the banner shown while an operation runs.
 *
 * Serial: exports and imports write the operation log, which is put back.
 */

test.describe.configure( { mode: 'serial' } );

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const ROUTES = '/fotogrids/v1/admin/tools/import-export/';
const LOG_OPTION = 'fotogrids_import_export_log';

function readLog(): string | null {
	try {
		return execFileSync( wpCli(), [ 'option', 'get', LOG_OPTION, '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}
}

function writeLog( value: string | null ): void {
	if ( null === value ) {
		execFileSync( wpCli(), [ 'option', 'delete', LOG_OPTION ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', LOG_OPTION, '--format=json', value ], {
		encoding: 'utf8',
	} );
}

async function openTab( page: Page, name: 'Export' | 'Import' | 'History' ): Promise< void > {
	await page.goto( SCREEN );
	await page.getByRole( 'tab', { name } ).click();
}

/** Click Export and return the downloaded file's name and contents. */
async function exportThroughUi( page: Page ): Promise< { name: string; body: string } > {
	const [ download ] = await Promise.all( [
		page.waitForEvent( 'download' ),
		page.getByRole( 'button', { name: 'Export', exact: true } ).click(),
	] );

	return {
		name: download.suggestedFilename(),
		body: readFileSync( ( await download.path() ) as string, 'utf8' ),
	};
}

/** Each chip in one History row as "count label", with its variant. */
function historyChips( page: Page, row: number ): Promise< string[] > {
	return page
		.locator( '.fg-ie-log-table tbody tr' )
		.nth( row )
		.locator( '.fg-ie-chip' )
		.evaluateAll( ( chips ) =>
			chips.map(
				( chip ) =>
					`${ Array.from( chip.children, ( part ) => part.textContent ).join( ' ' ) } [${ chip.className.replace( 'fg-ie-chip fg-ie-chip--', '' ) }]`
			)
		);
}

/** Upload a file on the Import tab and wait for the route to analyse it. */
async function chooseFile( page: Page, name: string, body: string ): Promise< Response > {
	const analysed = page.waitForResponse(
		( r ) =>
			decodeURIComponent( r.url() ).includes( `${ ROUTES }import` ) &&
			'analyse' === r.request().postDataJSON()?.phase
	);
	await page.locator( '#fg-ie-import-file' ).setInputFiles( {
		name,
		mimeType: 'application/json',
		buffer: Buffer.from( body ),
	} );

	return analysed;
}

/** An export file holding one item whose media this site does not have. */
function orphanItemFile( size?: number ): string {
	const body = JSON.stringify( {
		meta: { version: '1.2.0' },
		items: [ { attachment_id: 987654321, gallery_id: 0, position: 0, caption: 'Orphan' } ],
	} );

	return undefined === size ? body : body.padEnd( size, ' ' );
}

let log: string | null;

test.beforeAll( () => {
	log = readLog();
} );

test.afterAll( () => {
	writeLog( log );
} );

test( 'Export downloads the selected types in the chosen format', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	const own = galleryPage( {}, undefined, `Export screen ${ Date.now() }` );

	await openTab( page, 'Export' );

	const json = await exportThroughUi( page );
	expect( json.name ).toBe( 'fotogrids-export.json' );
	const all = JSON.parse( json.body );
	expect( Object.keys( all ) ).toEqual(
		expect.arrayContaining( [ 'meta', 'galleries', 'albums', 'items', 'tags', 'settings' ] )
	);
	expect( all.galleries.map( ( g: { id: number } ) => g.id ) ).toContain( own.id );

	await page.locator( '#fg-ie-export-select-all' ).click();
	await expect( page.getByRole( 'button', { name: 'Export', exact: true } ) ).toBeDisabled();
	await expect( page.getByText( 'Select at least one item to export.' ) ).toBeVisible();

	await page.locator( '#fg-ie-export-galleries' ).click();
	await page.getByRole( 'radiogroup', { name: 'Export file format' } ).getByRole( 'radio', { name: 'XML' } ).click();
	await expect(
		page.getByText( 'XML is more verbose and can be edited in any text editor.' )
	).toBeVisible();

	const xml = await exportThroughUi( page );
	expect( xml.name ).toBe( 'fotogrids-export.xml' );
	expect( xml.body ).toMatch( /^<\?xml/ );
	expect( xml.body ).toContain( '<galleries>' );
	expect( xml.body ).toContain( `<id>${ own.id }</id>` );
	expect( xml.body ).not.toContain( '<albums>' );
	expect( xml.body ).not.toContain( '<settings>' );
} );

test( 'a running export shows the do-not-close banner until it finishes', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	let release: () => void = () => {};
	const held = new Promise< void >( ( resolve ) => {
		release = resolve;
	} );
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( `${ ROUTES }export` ),
		async ( route ) => {
			await held;
			await route.continue();
		}
	);

	await openTab( page, 'Export' );
	const download = page.waitForEvent( 'download' );
	await page.getByRole( 'button', { name: 'Export', exact: true } ).click();

	const banner = page.locator( '.fg-ie-banner' );
	await expect( banner ).toHaveText( 'Exporting - please do not close this window…' );
	await expect( page.getByRole( 'button', { name: 'Exporting…' } ) ).toBeVisible();

	release();
	await download;
	await expect( banner ).toHaveCount( 0 );
} );

test( 'History lists each logged operation with its type, details and status', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	writeLog(
		JSON.stringify( [
			{
				id: 'e2e-import',
				date: '2026-10-11T18:29:04+00:00',
				type: 'import',
				summary: '3 galleries, 1 items · 2 skipped',
				status: 'partial',
			},
			{
				id: 'e2e-export',
				date: '2026-10-11T18:20:00+00:00',
				type: 'export',
				summary: '12 galleries, 1 albums, 0 templates, settings · JSON',
				status: 'complete',
			},
		] )
	);

	await openTab( page, 'History' );

	const rows = page.locator( '.fg-ie-log-table tbody tr' );
	await expect( rows ).toHaveCount( 2 );

	await expect( rows.nth( 0 ).locator( '.fg-ie-type-pill--import' ) ).toHaveText( 'Import' );
	await expect( rows.nth( 0 ).locator( '.fg-ie-status-pill--partial' ) ).toHaveText( 'Partial' );
	expect( await historyChips( page, 0 ) ).toEqual( [
		'3 Galleries [count]',
		'1 Item [count]',
		'2 skipped [skipped]',
	] );

	await expect( rows.nth( 1 ).locator( '.fg-ie-type-pill--export' ) ).toHaveText( 'Export' );
	await expect( rows.nth( 1 ).locator( '.fg-ie-status-pill--complete' ) ).toHaveText( 'Complete' );
	expect( await historyChips( page, 1 ) ).toEqual( [
		'12 Galleries [count]',
		'1 Album [count]',
		'0 Templates [empty]',
		'Settings [count]',
		'JSON [format]',
	] );
} );

test( 'History says so when nothing has been logged', { tag: [ '@admin' ] }, async ( { page } ) => {
	writeLog( null );

	await openTab( page, 'History' );

	await expect(
		page.getByText( 'No operations recorded yet. Export or import data to see a log here.' )
	).toBeVisible();
	await expect( page.locator( '.fg-ie-log-table' ) ).toHaveCount( 0 );
} );

test( 'a chosen file is summarised and can be swapped for another', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	await openTab( page, 'Import' );
	await expect( page.getByRole( 'heading', { name: 'Select export file' } ) ).toBeVisible();

	await chooseFile( page, 'items.json', orphanItemFile( 15360 ) );

	await expect( page.getByRole( 'heading', { name: 'Selected export file' } ) ).toBeVisible();
	await expect( page.locator( '.fg-ie-summary__file-name' ) ).toHaveText( 'items.json' );
	await expect( page.locator( '.fg-ie-summary__file-size' ) ).toHaveText( '15 KB' );
	await expect( page.locator( '.fg-ie-summary__chip' ) ).toHaveText( [ '1 Items' ] );
	await expect( page.getByRole( 'heading', { name: 'What to import' } ) ).toBeVisible();

	await page.getByRole( 'button', { name: 'Choose a different file' } ).click();

	await expect( page.getByRole( 'heading', { name: 'Select export file' } ) ).toBeVisible();
	await expect( page.locator( '#fg-ie-import-file' ) ).toHaveCount( 1 );
	await expect( page.getByRole( 'heading', { name: 'What to import' } ) ).toHaveCount( 0 );
} );

test( 'Import another file returns from the result to the file picker', { tag: [ '@admin' ] }, async ( {
	page,
} ) => {
	await openTab( page, 'Import' );
	await chooseFile( page, 'items.json', orphanItemFile() );

	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Import result' } ) ).toBeVisible();
	await expect( page.getByRole( 'heading', { name: 'Nothing was imported' } ) ).toBeVisible();

	await page.getByRole( 'button', { name: 'Import another file' } ).click();

	await expect( page.getByRole( 'heading', { name: 'Select export file' } ) ).toBeVisible();
	await expect( page.locator( '#fg-ie-import-file' ) ).toHaveCount( 1 );
	await expect( page.getByRole( 'heading', { name: 'Import result' } ) ).toHaveCount( 0 );
} );

test.describe( 'a file the route cannot parse', () => {
	test.use( { allowConsoleErrors: 'the analyse request answers 422, which Chrome logs' } );

	test( 'is reported and leaves the file picker in place', { tag: [ '@admin' ] }, async ( { page } ) => {
		await openTab( page, 'Import' );

		const answer = await chooseFile( page, 'broken.json', '{ not json' );
		expect( answer.status() ).toBe( 422 );

		await expect( page.getByRole( 'alert' ) ).toHaveText(
			'The file could not be parsed. Please ensure it is a valid FotoGrids JSON export.'
		);
		await expect( page.locator( '#fg-ie-import-file' ) ).toHaveCount( 1 );
		await expect( page.getByRole( 'heading', { name: 'What to import' } ) ).toHaveCount( 0 );
	} );
} );
