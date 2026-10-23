import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { roles, storageStateFor, wpEval } from './support/roles';
import { getOption, setOption } from './support/site';
import {
	ModeSwitch,
	SITE_MODE_OPTION,
	USER_MODE_META,
	presetGroup,
	presetOption,
	presetSelected,
	setUserMeta,
} from './support/settings-mode';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Easy mode controls on the Styling, Captions, Interactions and Pagination
 * tabs: order, colour pickers, the border width buttons and option icons.
 *
 * Serial: writes the administrator's mode and the site default.
 */

const admin = () => roles().roles.administrator.user;

let savedSiteMode: string | null;

test.beforeAll( () => {
	savedSiteMode = getOption( SITE_MODE_OPTION );
} );

test.afterAll( () => {
	setOption( SITE_MODE_OPTION, savedSiteMode );
	setUserMeta( admin(), USER_MODE_META, null );
} );

test.beforeEach( () => {
	setOption( 'fotogrids_settings_mode_tip', null );
	setUserMeta( admin(), USER_MODE_META, 'easy' );
} );

async function open( page: Page, id: number ): Promise< CollectionSettings > {
	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	await expect( page.locator( '.fotogrids-settings-tab__label' ).first() ).toBeVisible( { timeout: 20000 } );
	return new CollectionSettings( page );
}

/** Whether each locator comes after the previous one in the document. */
async function inDocumentOrder( locators: Locator[] ): Promise< boolean[] > {
	const handles = [];
	for ( const locator of locators ) {
		await expect( locator ).toBeVisible();
		handles.push( await locator.elementHandle() );
	}
	const result: boolean[] = [];
	for ( let i = 1; i < handles.length; i++ ) {
		result.push(
			await handles[ i - 1 ]!.evaluate(
				( a, b ) => Boolean( a.compareDocumentPosition( b as Node ) & Node.DOCUMENT_POSITION_FOLLOWING ),
				handles[ i ]
			)
		);
	}
	return result;
}

function storedSettings( id: number ): Record< string, unknown > {
	return JSON.parse(
		wpEval( `echo wp_json_encode( FotoGrids\\Galleries\\Gallery_Repository::get_settings( ${ id } ) );` )
	);
}

test( 'Easy Styling keeps the Advanced order', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const panel = await open( page, galleryPage().id );
	await panel.switchTab( 'styling' );

	const order = await inDocumentOrder( [
		panel.field( 'background_enabled' ),
		presetGroup( page, 'Corners' ),
		panel.field( 'border_enabled' ),
		presetGroup( page, 'Shadow' ),
		panel.field( 'thumbnail_filter_enabled' ),
	] );
	expect( order ).toEqual( [ true, true, true, true ] );
} );

test( 'Easy Background and Border show colour pickers and width buttons', { tag: [ '@critical', '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage( { background_enabled: true, border_enabled: true } );
	const panel = await open( page, id );
	await panel.switchTab( 'styling' );

	await expect( panel.field( 'background_color' ) ).toBeVisible();
	await expect( panel.field( 'border_color' ) ).toBeVisible();
	await expect( panel.field( 'background_hover_color' ) ).toHaveCount( 0 );
	await expect( panel.subtab( /^\s*Hover\s*$/ ) ).toHaveCount( 0 );
	await expect( panel.field( 'border_width' ) ).toHaveCount( 0 );

	const width = presetGroup( page, 'Border Width' ).first();
	await expect( width.locator( '.fg-button-group__button' ) ).toHaveText( [ 'Thin', 'Medium', 'Thick' ] );
	await expect( width ).not.toHaveClass( /fg-button-group--big-icons/ );
	await expect( width.locator( 'svg' ) ).toHaveCount( 0 );
	await expect( presetSelected( page, 'Border Width' ).first() ).toHaveText( 'Thin' );

	await presetOption( page, 'Border Width', 'Medium' ).first().click();
	await Promise.all( [
		page.waitForResponse( ( r ) => 'POST' === r.request().method() && /\/wp-admin\/post\.php/.test( r.url() ) ),
		page.locator( '#publish' ).click(),
	] );
	await page.waitForLoadState( 'load' );

	const stored = storedSettings( id ).border_width as Record< string, unknown >;
	expect( [ stored.desktop, stored.tablet, stored.mobile ].map( Number ) ).toEqual( [ 2, 2, 2 ] );

	const again = await open( page, id );
	await again.switchTab( 'styling' );
	await expect( presetSelected( page, 'Border Width' ).first() ).toHaveText( 'Medium' );
} );

test( 'Caption Type and its promo show only in Advanced', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const panel = await open( page, galleryPage().id );
	await panel.switchTab( 'captions' );
	await expect( panel.field( 'caption_hide_title' ) ).toBeVisible();
	await expect( panel.field( 'caption_type' ) ).toHaveCount( 0 );
	await expect( panel.field( 'caption_type_promotion' ) ).toHaveCount( 0 );
	await expect( presetGroup( page, 'Caption Style' ).locator( '.fg-button-group__button' ) ).toHaveText( [
		'Below',
		'Overlay',
		'On hover',
	] );

	await new ModeSwitch( page ).choose( 'advanced' );
	await expect( panel.field( 'caption_type' ) ).toBeVisible();
	const promo = panel.field( 'caption_type_promotion' ).locator( '.fotogrids-settings_pro-message' );
	await expect( promo ).toBeVisible();
	await expect( promo ).toHaveCSS( 'position', 'relative' );
} );

test( 'Lightbox Style uses big icon buttons and Load More alignment buttons carry icons', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const panel = await open( page, galleryPage( { item_click_behavior: 'lightbox' } ).id );
	await panel.switchTab( 'interactions' );

	await expect( panel.field( 'lightbox_variant' ).locator( '.fg-button-group--big-icons' ) ).toHaveCount( 1 );
	const styles = panel.field( 'lightbox_variant' ).locator( '.fg-button-group__button' );
	await expect( styles ).toHaveCount( 3 );
	for ( const button of await styles.all() ) {
		await expect( button.locator( '.fg-button-icon svg' ) ).toHaveCount( 1 );
	}

	await new ModeSwitch( page ).choose( 'advanced' );
	await panel.switchTab( 'pagination' );
	await panel.openSubtab( /^\s*Button\s*$/ );
	const alignment = panel.field( 'load_more_button_alignment' ).locator( '.fg-button-group__button' );
	await expect( alignment ).toHaveCount( 3 );
	for ( const button of await alignment.all() ) {
		await expect( button.locator( '.fg-button-icon svg' ) ).toHaveCount( 1 );
	}
} );

test( 'View Page settings show only in Advanced', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const panel = await open( page, galleryPage().id );
	await panel.switchTab( 'advanced' );
	await expect( panel.field( 'enable_statistics' ) ).toBeVisible();
	await expect( panel.field( 'view_page_override_defaults' ) ).toHaveCount( 0 );
	await expect( panel.field( 'view_page_max_width' ) ).toHaveCount( 0 );

	await new ModeSwitch( page ).choose( 'advanced' );
	await expect( panel.field( 'view_page_override_defaults' ) ).toBeVisible();
} );
