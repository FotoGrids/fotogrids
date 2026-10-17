import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { ADMIN, ScratchSite, scratchSitesAvailable } from './support/scratch-site';

/**
 * LIFE-18 through wp-admin: Settings > Maintenance > Reset all settings clears
 * what the Plugin Settings tabs saved, keeps permissions and privacy choices,
 * and galleries show the defaults on the next view.
 *
 * Runs on a WordPress of its own, because a reset rewrites site-wide options
 * every other spec reads.
 */

test.describe.configure( { mode: 'serial' } );

test.skip( ! scratchSitesAvailable(), 'needs the ci-mode harness, which can build a scratch WordPress' );

let site: ScratchSite;

test.beforeEach( async ( {}, testInfo ) => {
	testInfo.setTimeout( 300_000 );
	site = await new ScratchSite( `reset_${ testInfo.testId }` ).create();
	site.wp( 'transient', 'delete', 'fotogrids_activation_redirect' );
	site.seed( 'F-small' );
} );

test.afterEach( () => {
	site?.destroy();
} );

function option( name: string ): string {
	return site.wp( 'eval', `echo wp_json_encode( get_option( '${ name }', null ) );` );
}

function setting( name: string, key: string ): string {
	return site.wp( 'eval', `$v = get_option( '${ name }', array() ); echo is_array( $v ) && isset( $v['${ key }'] ) ? (string) $v['${ key }'] : '';` );
}

function cachedRenders(): number {
	return Number( site.wp( 'eval', 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache" );' ) );
}

async function logIn( page: Page ): Promise< void > {
	await page.goto( `${ site.url }/wp-login.php` );
	await page.waitForLoadState( 'networkidle' );
	await page.fill( '#user_login', ADMIN.user );
	await page.fill( '#user_pass', ADMIN.pass );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
}

async function openTab( page: Page, tab: string ): Promise< void > {
	await page.goto( `${ site.url }/wp-admin/admin.php?page=fotogrids-settings&tab=${ tab }` );
	await expect( page.locator( '.fotogrids-save-bar' ) ).toBeVisible( { timeout: 20_000 } );
	// The tab reads its stored values over REST after it mounts; a field typed
	// into before that read lands is overwritten by it.
	await page.waitForLoadState( 'networkidle' );
}

/** Wait for autosave to write the tab, which it does 2s after the last change. */
async function save( page: Page ): Promise< void > {
	await expect( page.getByRole( 'button', { name: /save changes/i } ) ).toBeDisabled( { timeout: 15_000 } );
	await page.waitForLoadState( 'networkidle' );
}

async function fill( page: Page, selector: string, value: string ): Promise< void > {
	await page.locator( selector ).fill( value );
	await page.locator( selector ).blur();
	await save( page );
}

async function switchRow( page: Page, title: string ): Promise< void > {
	await page.locator( '.fotogrids-sidebar-layout__panel__row' )
		.filter( { hasText: title } )
		.getByRole( 'switch' )
		.first()
		.click();
	await save( page );
}

/** Settings > Maintenance > Reset all settings, through the typed confirmation. */
async function resetAllSettings( page: Page ): Promise< string > {
	await openTab( page, 'maintenance' );

	const card = page.locator( '.fotogrids-danger-zone, [class*="danger"]' ).filter( { hasText: 'Reset all settings' } ).first();
	await expect( card ).toContainText( 'permissions, your Pro licence and your privacy choices are preserved' );

	await page.getByRole( 'button', { name: 'Reset settings' } ).first().click();

	const dialog = page.getByRole( 'dialog' );
	await expect( dialog ).toContainText( 'permissions, Pro licence and privacy choices are not affected' );
	await expect( dialog.getByRole( 'button', { name: 'Reset settings' } ) ).toBeDisabled();
	await dialog.getByRole( 'textbox' ).fill( 'CONFIRM' );

	const done = page.waitForResponse( ( r ) => decodeURIComponent( r.url() ).includes( '/admin/maintenance/reset-options' ) );
	await dialog.getByRole( 'button', { name: 'Reset settings' } ).click();
	const response = await done;
	expect( response.status() ).toBe( 200 );

	return JSON.stringify( await response.json() );
}

test( 'LIFE-18: a reset clears every settings tab and keeps permissions and privacy choices', { tag: [ '@settings', '@admin', '@lifecycle' ] }, async ( { page } ) => {
	await logIn( page );

	await openTab( page, 'responsiveness' );
	await fill( page, '#fg-bp-mobile', '600' );
	await expect.poll( () => setting( 'fotogrids_general_settings', 'mobile_breakpoint' ) ).toBe( '600' );

	await openTab( page, 'media' );
	await fill( page, '#fg-masonry-width', '777' );
	await expect.poll( () => option( 'fotogrids_media_settings' ) ).toContain( '777' );

	await openTab( page, 'gallery_items' );
	await page.getByRole( 'radio', { name: 'Plain text' } ).click();
	await expect.poll( () => setting( 'fotogrids_text_formatting', 'mode' ) ).toBe( 'plain' );

	await openTab( page, 'view_pages' );
	await fill( page, '#fg-view-base-gallery', 'portfolio' );
	await expect.poll( () => option( 'fotogrids_view_settings' ) ).toContain( 'portfolio' );

	await openTab( page, 'sharing' );
	await switchRow( page, 'Enable sharing' );
	await fill( page, '#fg-sharing-custom-text', 'Look at {title}' );
	await expect.poll( () => setting( 'fotogrids_sharing_settings', 'custom_text' ) ).toBe( 'Look at {title}' );
	expect( setting( 'fotogrids_sharing_settings', 'enable_social_sharing' ) ).toBe( '1' );

	await openTab( page, 'watermark' );
	await switchRow( page, 'Enable watermark' );
	await fill( page, '#fg-watermark-text', 'MARKED' );
	await expect.poll( () => setting( 'fotogrids_watermark_settings', 'watermark_text' ) ).toBe( 'MARKED' );
	expect( setting( 'fotogrids_watermark_settings', 'enable_watermark' ) ).toBe( '1' );

	await openTab( page, 'seo' );
	await fill( page, '#fg-seo-twitter-handle', '@fgtest' );
	await expect.poll( () => option( 'fotogrids_seo_settings' ) ).toContain( 'fgtest' );

	await openTab( page, 'permissions_manager' );
	await page.getByRole( 'radio', { name: 'Hide entirely' } ).click();
	await save( page );
	await expect.poll( () => option( 'fotogrids_unauthorised_settings_visibility' ) ).toBe( '"hidden"' );

	await openTab( page, 'advanced' );
	await page.locator( '#fotogrids_allow_google_fonts' ).click();
	await page.locator( '#fotogrids_allow_news_updates' ).click();
	await save( page );
	await page.locator( '#fotogrids_autosave' ).click();
	// With Autosave off, the switch that turned it off needs Save.
	await page.getByRole( 'button', { name: /save changes/i } ).click();
	await save( page );
	await expect.poll( () => option( 'fotogrids_allow_google_fonts' ) ).toBe( '"0"' );
	await expect.poll( () => option( 'fotogrids_allow_news_updates' ) ).toBe( '"0"' );
	await expect.poll( () => option( 'fotogrids_autosave' ) ).toBe( '"0"' );

	await openTab( page, 'maintenance' );
	await page.locator( '[id^="fotogrids_debug_channel_"]' ).first().click();
	await page.getByRole( 'button', { name: /save changes/i } ).click();
	await save( page );
	await expect.poll( () => option( 'fotogrids_debug_channels' ) ).not.toBe( 'null' );

	await page.locator( '#fotogrids-notice-bar .fotogrids-dismiss-button' ).click();
	await expect.poll( () => option( 'fotogrids_notice_bar_dismissed' ) ).not.toBe( 'null' );

	// A gallery cached with the saved settings.
	const gallery = site.wp( 'post', 'list', '--post_type=fotogrids_gallery', '--field=ID', '--posts_per_page=1' );
	const pageId = site.wp( 'post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Gallery page', `--post_content=[fotogrids_gallery id="${ gallery }"]`, '--porcelain' );
	await page.context().clearCookies();
	await page.goto( `${ site.url }/?page_id=${ pageId }` );
	await expect( page.locator( '.fotogrids-gallery' ).first() ).toBeVisible();
	expect( cachedRenders(), 'the visitor view was cached' ).toBeGreaterThan( 0 );

	await logIn( page );
	const response = await resetAllSettings( page );
	expect( response ).toContain( '"success":true' );

	// Cleared.
	for ( const name of [
		'fotogrids_general_settings',
		'fotogrids_view_settings',
		'fotogrids_sharing_settings',
		'fotogrids_watermark_settings',
		'fotogrids_watermark_config_hash',
		'fotogrids_seo_settings',
		'fotogrids_text_formatting',
		'fotogrids_autosave',
		'fotogrids_debug_channels',
	] ) {
		expect( option( name ), `${ name } was not cleared` ).toBe( 'null' );
	}
	expect( option( 'fotogrids_media_settings' ), 'media sizes are back to the activation defaults' ).not.toContain( '777' );
	expect( cachedRenders(), 'cached renders were flushed' ).toBe( 0 );

	// Kept.
	expect( option( 'fotogrids_unauthorised_settings_visibility' ) ).toBe( '"hidden"' );
	expect( option( 'fotogrids_allow_google_fonts' ) ).toBe( '"0"' );
	expect( option( 'fotogrids_allow_news_updates' ) ).toBe( '"0"' );
	expect( option( 'fotogrids_notice_bar_dismissed' ) ).not.toBe( 'null' );

	// What the screens show afterwards.
	await openTab( page, 'responsiveness' );
	await expect( page.locator( '#fg-bp-mobile' ) ).toHaveValue( '767' );
	await openTab( page, 'watermark' );
	await expect( page.locator( '.fotogrids-sidebar-layout__panel__row' ).filter( { hasText: 'Enable watermark' } ).getByRole( 'switch' ).first() ).toHaveAttribute( 'aria-checked', 'false' );
	await openTab( page, 'seo' );
	await expect( page.locator( '#fg-seo-twitter-handle' ) ).toHaveValue( '' );
	await openTab( page, 'gallery_items' );
	await expect( page.getByRole( 'radio', { name: 'Basic formatting' } ) ).toHaveAttribute( 'aria-checked', 'true' );
	await openTab( page, 'advanced' );
	await expect( page.locator( '#fotogrids_autosave' ) ).toHaveAttribute( 'aria-checked', 'true' );
	await expect( page.locator( '#fotogrids_allow_google_fonts' ) ).toHaveAttribute( 'aria-checked', 'false' );
	await expect( page.locator( '#fotogrids_allow_news_updates' ) ).toHaveAttribute( 'aria-checked', 'false' );
	await expect( page.locator( '#fotogrids-notice-bar' ) ).toHaveCount( 0 );
	await openTab( page, 'permissions_manager' );
	await expect( page.getByRole( 'radio', { name: 'Hide entirely' } ) ).toBeChecked();

	// The gallery renders with the defaults, and a view page answers at the default base.
	await page.context().clearCookies();
	const visit = await page.goto( `${ site.url }/?page_id=${ pageId }` );
	expect( visit?.status() ).toBe( 200 );
	await expect( page.locator( '.fotogrids-gallery' ).first() ).toBeVisible();

	expect( site.phpErrors() ).toEqual( [] );
} );
