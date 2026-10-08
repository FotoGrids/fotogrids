import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor, wpEval } from './support/roles';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryEditor } from './support/gallery-editor';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The Library stat cards and the gallery items grid reflect an edit as soon as
 * it is saved, with no reload.
 *
 * Serial: writes library entries and attachment titles, which every spec shares.
 * Each test removes or restores what it wrote.
 */

test.describe.configure( { mode: 'serial' } );

const LIBRARY = '/wp-admin/admin.php?page=fotogrids-library';
const PREFIX = 'e2e-refresh-';

const TABS = [
	{ tab: 'Tags', singular: 'Tag', total: 'Total Tags' },
	{ tab: 'People', singular: 'Person', total: 'Total People' },
	{ tab: 'Locations', singular: 'Location', total: 'Total Locations' },
] as const;

function card( page: Page, label: string ): Locator {
	return page
		.locator( '.fg-lib-stat-card' )
		.filter( { hasText: new RegExp( label, 'i' ) } )
		.locator( '.fg-lib-stat-card__content .fg-lib-stat-card__value' );
}

function row( page: Page, name: string ): Locator {
	return page.locator( '.fotogrids-library-table tbody tr' ).filter( {
		has: page.locator( '.fotogrids-library-name-button', { hasText: name } ),
	} );
}

/** Set on the window, so a reload in between is caught. */
async function markPage( page: Page ): Promise< void > {
	await page.evaluate( () => {
		( window as unknown as { fgNoReload: boolean } ).fgNoReload = true;
	} );
}

async function expectNoReload( page: Page ): Promise< void > {
	expect(
		await page.evaluate(
			() => ( window as unknown as { fgNoReload?: boolean } ).fgNoReload
		)
	).toBe( true );
}

function removeLibraryEntries(): void {
	wpEval( `
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}fotogrids_tags WHERE name LIKE %s", '${ PREFIX }%' ) );
	` );
}

test.describe( 'library stat cards', () => {
	test.afterAll( removeLibraryEntries );

	for ( const { tab, singular, total } of TABS ) {
		test( `${ tab }: total follows create, rename, delete, merge and bulk delete`, { tag: [ '@admin' ] }, async ( {
			page,
		} ) => {
			const name = ( suffix: string ) => `${ PREFIX }${ tab.toLowerCase() }-${ suffix }`;
			const totalCard = card( page, total );

			await page.goto( LIBRARY );
			await page
				.locator( '.fotogrids-library-sidebar-tabs' )
				.getByText( tab, { exact: true } )
				.first()
				.click();
			await expect( totalCard ).toHaveText( /^\d+$/ );
			const start = Number( await totalCard.innerText() );
			await markPage( page );

			for ( const suffix of [ 'a', 'b', 'c' ] ) {
				await page.getByRole( 'button', { name: `Add ${ singular }` } ).click();
				await page.fill( '#fg-library-create-name', name( suffix ) );
				await page.getByRole( 'button', { name: 'Create', exact: true } ).click();
				await expect( row( page, name( suffix ) ) ).toBeVisible();
			}
			await expect( totalCard ).toHaveText( String( start + 3 ) );

			await row( page, name( 'a' ) ).locator( '.fotogrids-library-name-button' ).click();
			await page.locator( '.fotogrids-library-table tbody input[type=text]' ).first().fill( name( 'a2' ) );
			await page.keyboard.press( 'Enter' );
			await expect( row( page, name( 'a2' ) ) ).toBeVisible();
			await expect( totalCard ).toHaveText( String( start + 3 ) );

			await row( page, name( 'a2' ) ).getByRole( 'button', { name: 'Delete' } ).click();
			await page
				.locator( '.fotogrids-library-delete-popover' )
				.getByRole( 'button', { name: 'Delete' } )
				.click();
			await expect( totalCard ).toHaveText( String( start + 2 ) );

			await page.getByRole( 'button', { name: `Add ${ singular }` } ).click();
			await page.fill( '#fg-library-create-name', name( 'd' ) );
			await page.getByRole( 'button', { name: 'Create', exact: true } ).click();
			await expect( totalCard ).toHaveText( String( start + 3 ) );

			await row( page, name( 'c' ) ).locator( 'input[type=checkbox]' ).check();
			await row( page, name( 'd' ) ).locator( 'input[type=checkbox]' ).check();
			await page.getByRole( 'button', { name: 'Merge…' } ).click();
			await page
				.locator( '.fotogrids-library-merge-targets label', { hasText: name( 'b' ) } )
				.click();
			await page.getByRole( 'button', { name: 'Merge', exact: true } ).click();
			await expect( totalCard ).toHaveText( String( start + 1 ) );

			await row( page, name( 'b' ) ).locator( 'input[type=checkbox]' ).check();
			await page.getByRole( 'button', { name: 'Delete selected' } ).click();
			await page.locator( '.fg-confirm' ).getByRole( 'button', { name: 'Delete', exact: true } ).click();
			await expect( totalCard ).toHaveText( String( start ) );

			await expectNoReload( page );
		} );
	}

	test( 'Tags: the top-tags chart picks up a rename', { tag: [ '@admin' ] }, async ( { page } ) => {
		const before = `${ PREFIX }chart`;
		const after = `${ PREFIX }chart-renamed`;
		const chartLabels = () =>
			page.evaluate( () => {
				const canvas = document.querySelector( '.fg-lib-chart-panel canvas' );
				const chart = ( window as unknown as { Chart: { getChart: ( c: Element ) => { data: { labels: string[] } } | undefined } } ).Chart.getChart(
					canvas as Element
				);
				return chart ? chart.data.labels : [];
			} );

		await page.goto( LIBRARY );
		await page.getByRole( 'button', { name: 'Add Tag' } ).click();
		await page.fill( '#fg-library-create-name', before );
		await page.getByRole( 'button', { name: 'Create', exact: true } ).click();
		await expect.poll( chartLabels ).toContain( before );

		await row( page, before ).locator( '.fotogrids-library-name-button' ).click();
		await page.locator( '.fotogrids-library-table tbody input[type=text]' ).first().fill( after );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( chartLabels ).toContain( after );
		expect( await chartLabels() ).not.toContain( before );
	} );
} );

test.describe( 'gallery items grid', () => {
	let itemId: number;
	let original: string;

	test.beforeAll( () => {
		itemId = fixture< number[] >( 'F-small', 'items' )[ 0 ];
		original = wpEval(
			`echo wp_json_encode( array( get_post_field( 'post_title', ${ itemId } ), get_post_meta( ${ itemId }, '_wp_attachment_image_alt', true ) ) );`
		).trim();
	} );

	test.afterAll( () => {
		wpEval( `
			$o = json_decode( base64_decode( '${ Buffer.from( original ).toString( 'base64' ) }' ), true );
			wp_update_post( wp_slash( array( 'ID' => ${ itemId }, 'post_title' => $o[0] ) ) );
			update_post_meta( ${ itemId }, '_wp_attachment_image_alt', wp_slash( $o[1] ) );
		` );
	} );

	async function openItem( page: Page, editor: GalleryEditor ): Promise< void > {
		await editor.item( itemId ).hover();
		await editor.editItem( itemId ).click();
		await expect( page.locator( '#fotogrids-item-title' ) ).toBeVisible();
	}

	async function saveItem( page: Page, title: string, alt: string ): Promise< void > {
		await page.fill( '#fotogrids-item-title', title );
		await page.fill( '#fotogrids-item-alt', alt );
		const saved = page.waitForResponse( ( r ) =>
			decodeURIComponent( r.url() ).includes( `/items/${ itemId }/save` )
		);
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		await saved;
	}

	test( 'a saved title and alt text show in the grid without a reload', { tag: [ '@admin' ] }, async ( {
		page,
	} ) => {
		const { id } = galleryPage();
		const editor = new GalleryEditor( page );
		const title = editor.item( itemId ).locator( '.fotogrids-item-title' );
		const thumb = editor.item( itemId ).locator( 'img' ).first();

		await editor.open( id );
		await markPage( page );
		await openItem( page, editor );

		await saveItem( page, 'Harbour at dawn', 'Boats in the harbour' );
		await expect( title ).toHaveText( 'Harbour at dawn' );
		await expect( thumb ).toHaveAttribute( 'alt', 'Boats in the harbour' );

		// The grid shows what the server stored, fallbacks included.
		await saveItem( page, '  <b>Bold</b>  ', '' );
		await expect( title ).toHaveText( 'Bold' );
		await expect( thumb ).toHaveAttribute( 'alt', 'Bold' );

		await saveItem( page, '', 'Only alt' );
		await expect( title ).toHaveText( 'Untitled' );
		await expect( thumb ).toHaveAttribute( 'alt', 'Only alt' );

		await expectNoReload( page );
		const live = [ await title.innerText(), await thumb.getAttribute( 'alt' ) ];
		await editor.open( id );
		expect( [ await title.innerText(), await thumb.getAttribute( 'alt' ) ] ).toEqual( live );
	} );

	test( 'ampersands, quotes and apostrophes show as characters, not HTML entities', { tag: [ '@admin' ] }, async ( {
		page,
	} ) => {
		const { id } = galleryPage();
		const editor = new GalleryEditor( page );
		const title = editor.item( itemId ).locator( '.fotogrids-item-title' );
		const thumb = editor.item( itemId ).locator( 'img' ).first();
		const entity = /&#?\w+;/;

		wpEval( `
			wp_update_post( wp_slash( array( 'ID' => ${ itemId }, 'post_title' => 'Tom & "Jerry" \\'s' ) ) );
			delete_post_meta( ${ itemId }, '_wp_attachment_image_alt' );
		` );
		await editor.open( id );
		await expect( title ).toHaveText( 'Tom & “Jerry” ‘s' );
		await expect( thumb ).toHaveAttribute( 'alt', 'Tom & “Jerry” ‘s' );

		await openItem( page, editor );
		await expect( page.locator( '#fotogrids-item-title' ) ).toHaveValue( 'Tom & "Jerry" \'s' );
		await saveItem( page, 'Fish & "Chips" isn\'t', '' );
		await expect( title ).toHaveText( 'Fish & “Chips” isn’t' );
		await expect( thumb ).toHaveAttribute( 'alt', 'Fish & “Chips” isn’t' );
		expect( wpEval( `echo get_post_field( 'post_title', ${ itemId }, 'raw' );` ).trim() ).toBe(
			'Fish & "Chips" isn\'t'
		);

		await editor.open( id );
		await expect( title ).toHaveText( 'Fish & “Chips” isn’t' );
		expect( await title.innerText() ).not.toMatch( entity );
		expect( await thumb.getAttribute( 'alt' ) ).not.toMatch( entity );
	} );

	test.describe( () => {
		test.use( { allowConsoleErrors: 'asserts the failed-save path, which logs the 500' } );

		test( 'a failed save leaves the grid as it was', { tag: [ '@admin' ] }, async ( { page } ) => {
			const { id } = galleryPage();
			const editor = new GalleryEditor( page );
			const title = editor.item( itemId ).locator( '.fotogrids-item-title' );

			await editor.open( id );
			const before = await title.innerText();
			await page.route( `**/*`, ( route ) =>
				decodeURIComponent( route.request().url() ).includes( `/items/${ itemId }/save` )
					? route.fulfill( {
							status: 500,
							contentType: 'application/json',
							body: JSON.stringify( { success: false, message: 'Forced failure' } ),
					  } )
					: route.continue()
			);

			await openItem( page, editor );
			await saveItem( page, 'Never stored', 'Never stored' );
			await expect( title ).toHaveText( before );
		} );
	} );
} );
