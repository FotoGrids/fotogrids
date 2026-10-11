import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor, wpCli } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * A saved Font Weight or button-group choice shows as chosen when the editor
 * loads it again, including values stored as numeric text.
 *
 * Scoped: each test saves only a gallery it created.
 */

function storedMeta( id: number, key: string ): string {
	return execFileSync(
		wpCli(),
		[ 'post', 'meta', 'get', String( id ), `fotogrids_${ key }` ],
		{ encoding: 'utf8' }
	).trim();
}

/** Press Update and wait for the edit screen to load again. */
async function submit( page: Page ): Promise< void > {
	await Promise.all( [
		page.waitForResponse(
			( r ) => 'POST' === r.request().method() && /\/wp-admin\/post\.php/.test( r.url() )
		),
		page.locator( '#publish' ).click(),
	] );
	await page.waitForLoadState( 'load' );
}

/** Open a tab, then each subtab in order, matching labels exactly. */
async function openPath( page: Page, panel: CollectionSettings, tab: string, subtabs: string[] ): Promise< void > {
	await panel.openTab( tab );
	for ( const label of subtabs ) {
		await page
			.locator( '.fotogrids-lightbox-subtab:visible' )
			.filter( { hasText: new RegExp( `^\\s*${ label }\\s*$` ) } )
			.first()
			.click();
	}
}

function weightLabel( panel: CollectionSettings, key: string ) {
	return panel.field( key ).locator( '.fotogrids-render-select__selected' );
}

function activeButton( panel: CollectionSettings, key: string ) {
	return panel.field( key ).locator( '.fg-button-group__button.fg-is-active' );
}

const FONT_WEIGHT_FIELDS: Array< [ string, Settings, string, string[] ] > = [
	[ 'caption_title_font_weight', {}, 'Captions', [ 'Typography' ] ],
	[ 'caption_description_font_weight', {}, 'Captions', [ 'Typography' ] ],
	[ 'featured_show_all_font_weight', { layout: 'featured-item' }, 'Layout', [ 'Show All Button', 'Styling' ] ],
	[ 'pagination_button_font_weight', { layout: 'grid', pagination_type: 'paginated', pagination_method: 'load_more' }, 'Pagination', [ 'Styling' ] ],
	[ 'filter_btn_font_weight', { filtering_enabled: true, filter_ui_style: 'buttons' }, 'Filtering', [ 'Buttons' ] ],
	[ 'filter_dropdown_font_weight', { filtering_enabled: true, filter_ui_style: 'dropdowns' }, 'Filtering', [ 'Dropdowns' ] ],
	[ 'filter_cb_font_weight', { filtering_enabled: true, filter_ui_style: 'checkboxes' }, 'Filtering', [ 'Checkboxes' ] ],
];

test( 'a Font Weight chosen in the editor shows by name after Update', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
}, testInfo ) => {
	testInfo.setTimeout( 60_000 );
	const { id } = galleryPage();
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );
	const key = 'caption_title_font_weight';

	await editor.open( id );
	await openPath( page, panel, 'Captions', [ 'Typography' ] );
	await panel.field( key ).locator( '.fotogrids-render-select__trigger' ).click();
	await page.locator( '.fotogrids-render-select__option' ).filter( { hasText: /^Bold \(700\)$/ } ).click();
	await submit( page );

	expect( storedMeta( id, key ) ).toBe( '700' );

	await openPath( page, panel, 'Captions', [ 'Typography' ] );
	await expect( weightLabel( panel, key ) ).toHaveText( 'Bold (700)' );

	await panel.field( key ).locator( '.fotogrids-render-select__trigger' ).click();
	await expect(
		page.locator( '.fotogrids-render-select__option[aria-selected="true"]' )
	).toHaveText( 'Bold (700)' );
} );

for ( const [ key, settings, tab, subtabs ] of FONT_WEIGHT_FIELDS ) {
	test( `${ key } shows a saved weight by name`, { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
		const { id } = galleryPage( { ...settings, [ key ]: '600' } );
		const editor = new GalleryEditor( page );
		const panel = new CollectionSettings( page );

		await editor.open( id );
		await openPath( page, panel, tab, subtabs );

		await expect( weightLabel( panel, key ) ).toHaveText( 'Semi Bold (600)' );
	} );
}

test( 'Transition Duration marks a stored and a newly saved choice as active', { tag: [ '@admin', '@settings', '@lightbox' ] }, async ( {
	page,
}, testInfo ) => {
	testInfo.setTimeout( 60_000 );
	const { id } = galleryPage( { lightbox_transition_duration: '300' } );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );
	const key = 'lightbox_transition_duration';

	await editor.open( id );
	await openPath( page, panel, 'Lightbox', [ 'Navigation' ] );
	await expect( activeButton( panel, key ) ).toHaveAttribute( 'title', 'Normal' );

	await panel.field( key ).locator( '.fg-button-group__button[title="Slow"]' ).click();
	await submit( page );

	expect( storedMeta( id, key ) ).toBe( '450' );

	await openPath( page, panel, 'Lightbox', [ 'Navigation' ] );
	await expect( activeButton( panel, key ) ).toHaveCount( 1 );
	await expect( activeButton( panel, key ) ).toHaveAttribute( 'title', 'Slow' );
} );

test( 'Retain Statistics marks a saved day count as active', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const { id } = galleryPage( { enable_statistics: true, retain_statistics: '90' } );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	await editor.open( id );
	await openPath( page, panel, 'Advanced', [] );

	await expect( activeButton( panel, 'retain_statistics' ) ).toHaveAttribute( 'title', '90 Days' );
} );

test( 'button groups with number options still mark the saved choice', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const featured = galleryPage( { layout: 'featured-item', featured_thumbs_count: 9 } );
	const grid = galleryPage( { lightbox_overlay_blur: 0 } );
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );

	await editor.open( featured.id );
	await openPath( page, panel, 'Layout', [ 'Featured Item Layout' ] );
	await expect( activeButton( panel, 'featured_thumbs_count' ) ).toHaveAttribute( 'title', '9' );

	await editor.open( grid.id );
	await openPath( page, panel, 'Lightbox', [ 'Layout & Styling' ] );
	await expect( activeButton( panel, 'lightbox_overlay_blur' ) ).toHaveAttribute( 'title', 'None' );
} );
