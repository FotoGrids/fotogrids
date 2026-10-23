import type { Browser, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor } from './support/gallery-editor';
import { GalleryRender } from './support/gallery-render';
import { roles, storageStateFor, wpEval } from './support/roles';
import { getOption, setOption } from './support/site';
import {
	ModeSwitch,
	SITE_MODE_OPTION,
	TIP_DISMISSED_META,
	TIP_OPTION,
	USER_MODE_META,
	activeTab,
	noticeText,
	presetGroup,
	presetOption,
	setUserMeta,
	tip,
	userMeta,
} from './support/settings-mode';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Easy / Advanced setup mode on the gallery and album editors: what each mode
 * shows, whose choice it is, and that hiding a setting never changes it.
 *
 * Serial: every test writes user meta and site options.
 */

const EASY_GALLERY_TABS = [
	'Layout',
	'Styling',
	'Interactions',
	'Captions',
	'Pagination',
	'Sorting',
	'Filtering',
	'Effects',
	'Media',
	'Video',
	'Performance',
	'Permissions',
	'Security',
	'Sharing',
	'Exif',
	'SEO',
	'Advanced',
];
const EASY_ALBUM_TABS = [
	'Layout',
	'Navigation',
	'Styling',
	'Captions',
	'Pagination',
	'Sorting',
	'Filtering',
	'Effects',
	'Performance',
	'Permissions',
	'Security',
	'Sharing',
	'SEO',
	'Advanced',
];

const admin = () => roles().roles.administrator.user;
const editor = () => roles().roles.editor.user;

let savedSiteMode: string | null;
let savedTip: string | null;

function resetUsers(): void {
	for ( const login of [ admin(), editor() ] ) {
		setUserMeta( login, USER_MODE_META, null );
		setUserMeta( login, TIP_DISMISSED_META, null );
	}
}

test.beforeAll( () => {
	savedSiteMode = getOption( SITE_MODE_OPTION );
	savedTip = getOption( TIP_OPTION );
} );

test.afterAll( () => {
	setOption( SITE_MODE_OPTION, savedSiteMode );
	setOption( TIP_OPTION, savedTip );
	resetUsers();
} );

test.beforeEach( () => {
	setOption( SITE_MODE_OPTION, 'easy' );
	setOption( TIP_OPTION, null );
	resetUsers();
} );

/** Wait until the settings panel has rendered its tabs. */
async function panelReady( page: Page ): Promise< void > {
	await expect( page.locator( '.fotogrids-settings-tab__label' ).first() ).toBeVisible( { timeout: 20000 } );
}

async function openCollection( page: Page, id: number ): Promise< void > {
	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	await panelReady( page );
}

/** Press Update and wait for the edit screen to load again. */
async function submit( page: Page ): Promise< void > {
	await Promise.all( [
		page.waitForResponse( ( r ) => 'POST' === r.request().method() && /\/wp-admin\/post\.php/.test( r.url() ) ),
		page.locator( '#publish' ).click(),
	] );
	await page.waitForLoadState( 'load' );
	await panelReady( page );
}

function storedSettings( id: number ): Record< string, unknown > {
	return JSON.parse(
		wpEval( `echo wp_json_encode( FotoGrids\\Galleries\\Gallery_Repository::get_settings( ${ id } ) );` )
	);
}

const TRUE_VALUES = [ true, 1, '1', 'true', 'on' ];

async function pageAs( browser: Browser, role: 'editor' ): Promise< Page > {
	const context = await browser.newContext( {
		baseURL: process.env.WP_BASE_URL,
		storageState: storageStateFor( role ),
	} );
	return context.newPage();
}

test( 'Easy shows only the Easy tabs and settings on a gallery', { tag: [ '@critical', '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	setUserMeta( admin(), USER_MODE_META, 'easy' );
	const { id } = galleryPage( { item_click_behavior: 'external' } );
	const panel = new CollectionSettings( page );

	await openCollection( page, id );
	await new ModeSwitch( page ).expectActive( 'easy' );

	const tabs = await panel.tabLabels();
	expect( tabs ).toEqual( expect.arrayContaining( EASY_GALLERY_TABS ) );

	await panel.openTab( 'Layout' );
	await expect( panel.field( 'layout' ) ).toBeVisible();
	await expect( panel.field( 'columns' ) ).toBeVisible();
	await expect( presetGroup( page, 'Spacing' ) ).toBeVisible();
	await expect( panel.field( 'item_spacing' ) ).toHaveCount( 0 );

	await panel.openTab( 'Styling' );
	await expect( presetGroup( page, 'Corners' ) ).toBeVisible();
	await expect( presetGroup( page, 'Shadow' ) ).toBeVisible();
	await expect( panel.field( 'border_radius' ) ).toHaveCount( 0 );
	await expect( panel.field( 'shadow_enabled' ) ).toHaveCount( 0 );
	await expect( panel.field( 'background_enabled' ) ).toBeVisible();
	await expect( panel.field( 'border_enabled' ) ).toBeVisible();

	await panel.openTab( 'Interactions' );
	await expect( panel.field( 'item_click_behavior' ) ).toBeVisible();
	await expect( panel.field( 'external_url_manager' ) ).toBeVisible();

	await panel.openTab( 'Captions' );
	await expect( presetGroup( page, 'Caption Style' ) ).toBeVisible();
	await expect( panel.field( 'caption_placement' ) ).toHaveCount( 0 );

	await panel.openTab( 'Security' );
	await expect( panel.field( 'password_protect' ) ).toBeVisible();
	await expect( panel.field( 'disable_right_click' ) ).toBeVisible();
} );

test( 'Easy shows only the Easy tabs and settings on an album', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	setUserMeta( admin(), USER_MODE_META, 'easy' );
	const { id: galleryId } = galleryPage();
	const { id } = album( [ galleryId ] );
	const panel = new CollectionSettings( page );
	const modes = new ModeSwitch( page );

	await openCollection( page, id );
	await modes.expectActive( 'easy' );

	const tabs = await panel.tabLabels();
	expect( tabs ).toEqual( expect.arrayContaining( EASY_ALBUM_TABS ) );

	await panel.openTab( 'Navigation' );
	await expect( panel.field( 'navigation_show_breadcrumbs' ) ).toBeVisible();
	await expect( panel.field( 'navigation_show_back_button' ) ).toBeVisible();

	await modes.choose( 'advanced' );
	await expect( panel.tabLabels() ).resolves.toEqual( expect.arrayContaining( [ 'Performance', 'SEO', 'Advanced' ] ) );
} );

test( 'Advanced shows everything and the choice persists per user across a reload', { tag: [ '@critical', '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	const { id } = galleryPage();
	const panel = new CollectionSettings( page );
	const modes = new ModeSwitch( page );

	await openCollection( page, id );
	await modes.expectActive( 'easy' );

	await modes.choose( 'advanced' );
	await expect( panel.tabLabels() ).resolves.toEqual(
		expect.arrayContaining( EASY_GALLERY_TABS )
	);
	await panel.openTab( 'Layout' );
	await expect( panel.field( 'item_spacing' ) ).toBeVisible();
	await expect( presetGroup( page, 'Spacing' ) ).toHaveCount( 0 );

	expect( userMeta( admin(), USER_MODE_META ) ).toBe( 'advanced' );
	expect( getOption( SITE_MODE_OPTION ) ).toBe( 'easy' );

	await page.reload();
	await panelReady( page );
	await modes.expectActive( 'advanced' );
	await expect( panel.tabLabels() ).resolves.toContain( 'Performance' );

	// A subtab with nothing in Easy hands over to the first visible subtab.
	await panel.openTab( 'Captions' );
	await panel.openSubtab( 'Typography' );
	await modes.choose( 'easy' );
	await expect( activeTab( page ) ).toHaveText( 'Captions' );
	await expect( panel.field( 'caption_hide_title' ) ).toBeVisible();
	expect( userMeta( admin(), USER_MODE_META ) ).toBe( 'easy' );
} );

test( 'a second user keeps their own mode', { tag: [ '@admin', '@settings' ] }, async ( { page, browser } ) => {
	const { id: own } = galleryPage();
	const { id: editorsOwn } = galleryPage( {}, undefined, 'Editor mode gallery', editor() );
	const modes = new ModeSwitch( page );

	await openCollection( page, own );
	await modes.choose( 'advanced' );

	const other = await pageAs( browser, 'editor' );
	try {
		await openCollection( other, editorsOwn );
		await new ModeSwitch( other ).expectActive( 'easy' );
		await new CollectionSettings( other ).openTab( 'Layout' );
		await expect( new CollectionSettings( other ).field( 'item_spacing' ) ).toHaveCount( 0 );
		expect( userMeta( editor(), USER_MODE_META ) ).toBeNull();

		await new ModeSwitch( other ).choose( 'advanced' );
		await new ModeSwitch( other ).choose( 'easy' );
		expect( userMeta( editor(), USER_MODE_META ) ).toBe( 'easy' );
	} finally {
		await other.context().close();
	}

	await page.reload();
	await panelReady( page );
	await modes.expectActive( 'advanced' );
	expect( userMeta( admin(), USER_MODE_META ) ).toBe( 'advanced' );
} );

test( 'a value set in Advanced survives a save made in Easy and still renders', { tag: [ '@critical', '@admin', '@settings' ] }, async ( {
	page,
}, testInfo ) => {
	testInfo.setTimeout( 90_000 );
	setUserMeta( admin(), USER_MODE_META, 'advanced' );
	// `padding` is Advanced only and lands as --fg-padding on the gallery wrapper.
	const { id, url } = galleryPage( { padding: { desktop: 24, tablet: 24, mobile: 24 } } );
	const panel = new CollectionSettings( page );
	const modes = new ModeSwitch( page );

	await page.goto( url );
	const render = new GalleryRender( page, id );
	await render.waitFor();
	await expect( render.root ).toHaveAttribute( 'data-fg-spacing', '1' );
	await expect( render.root ).toHaveCSS( 'padding-top', '24px' );

	await openCollection( page, id );
	await panel.openTab( 'Layout' );
	await expect( panel.field( 'padding' ) ).toBeVisible();

	await modes.choose( 'easy' );
	await panel.openTab( 'Layout' );
	await expect( panel.field( 'padding' ) ).toHaveCount( 0 );
	await presetOption( page, 'Spacing', 'Large' ).click();
	await expect( presetOption( page, 'Spacing', 'Large' ) ).toHaveClass( /\bfg-is-active\b/ );
	await submit( page );

	const stored = storedSettings( id );
	expect( stored.item_spacing ).toMatchObject( { desktop: expect.anything() } );
	expect( Number( ( stored.item_spacing as Record< string, unknown > ).desktop ) ).toBe( 32 );
	expect( stored.padding ).toMatchObject( { desktop: expect.anything() } );
	expect( Number( ( stored.padding as Record< string, unknown > ).desktop ) ).toBe( 24 );

	await page.goto( url );
	await render.waitFor();
	await expect( render.root ).toHaveAttribute( 'data-fg-spacing', '1' );
	await expect( render.root ).toHaveCSS( 'padding-top', '24px' );
} );

test( 'Easy shows no notice about settings changed in Advanced editing mode', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
} ) => {
	setUserMeta( admin(), USER_MODE_META, 'easy' );
	const modes = new ModeSwitch( page );

	const gallery = galleryPage( { cache_duration: 48, preload_next_page: true } );
	await openCollection( page, gallery.id );
	await modes.expectActive( 'easy' );
	await expect( noticeText( page ) ).toHaveCount( 0 );
	await expect( page.locator( '.fotogrids-settings-mode-notice' ) ).toHaveCount( 0 );

	const albumPost = album( [ gallery.id ], { cache_duration: 48 } );
	await openCollection( page, albumPost.id );
	await modes.expectActive( 'easy' );
	await expect( noticeText( page ) ).toHaveCount( 0 );
} );

test( 'the upgrade tip shows once per user and stays dismissed', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
	browser,
} ) => {
	const { id } = galleryPage();
	const { id: editorsOwn } = galleryPage( {}, undefined, 'Editor tip gallery', editor() );

	// A fresh install has no pending tip.
	await openCollection( page, id );
	await expect( tip( page ) ).toHaveCount( 0 );

	setOption( TIP_OPTION, '1' );
	await page.reload();
	await panelReady( page );
	const popover = tip( page );
	await expect( popover ).toBeVisible();
	await expect( popover ).toContainText(
		'Easy editing mode shows only the essential controls. Switch to Advanced editing mode any time to see every setting.'
	);

	// Esc closes the tooltip and records the dismissal.
	await popover.getByRole( 'button', { name: 'Got it' } ).focus();
	await page.keyboard.press( 'Escape' );
	await expect( popover ).toHaveCount( 0 );
	await expect.poll( () => userMeta( admin(), TIP_DISMISSED_META ) ).toBe( '1' );

	setUserMeta( admin(), TIP_DISMISSED_META, null );
	await page.reload();
	await panelReady( page );
	await expect( popover ).toBeVisible();
	// fg-tooltip is fixed-position and follows its host, so bring the switch into view first.
	await page.locator( '.fotogrids-settings-docs-strip__mode' ).scrollIntoViewIfNeeded();
	await popover.getByRole( 'button', { name: 'Got it' } ).click();
	await expect( popover ).toHaveCount( 0 );
	await expect.poll( () => userMeta( admin(), TIP_DISMISSED_META ) ).toBe( '1' );

	await page.reload();
	await panelReady( page );
	await expect( tip( page ) ).toHaveCount( 0 );

	// Another user still has it, and switching mode dismisses it too.
	const other = await pageAs( browser, 'editor' );
	try {
		await openCollection( other, editorsOwn );
		await expect( tip( other ) ).toBeVisible();
		await new ModeSwitch( other ).choose( 'advanced' );
		await expect( tip( other ) ).toHaveCount( 0 );
		await expect.poll( () => userMeta( editor(), TIP_DISMISSED_META ) ).toBe( '1' );

		await other.reload();
		await panelReady( other );
		await expect( tip( other ) ).toHaveCount( 0 );
	} finally {
		await other.context().close();
	}
} );

test( 'Sharing can be turned off for one gallery in Easy', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const sharing = wpEval( "echo wp_json_encode( get_option( 'fotogrids_sharing_settings', null ) );" ).trim();
	wpEval(
		"FotoGrids\\Settings\\Sharing_Settings_Store::save( array_merge( FotoGrids\\Settings\\Sharing_Settings_Store::get(), array( 'enable_social_sharing' => true ) ) );"
	);
	try {
		setUserMeta( admin(), USER_MODE_META, 'easy' );
		const { id } = galleryPage();
		const panel = new CollectionSettings( page );

		await openCollection( page, id );
		await panel.openTab( 'Sharing' );
		await expect( panel.field( 'sharing_override' ) ).toHaveCount( 0 );

		await expect( panel.field( 'sharing_disabled_for_collection' ) ).toHaveCount( 0 );
		await presetOption( page, 'Sharing', 'Off for this Gallery' ).click();
		await submit( page );

		const stored = storedSettings( id );
		expect( TRUE_VALUES ).toContain( stored.sharing_disabled_for_collection );
		expect( TRUE_VALUES ).toContain( stored.sharing_override );
	} finally {
		wpEval(
			'null' === sharing
				? "delete_option( 'fotogrids_sharing_settings' );"
				: `update_option( 'fotogrids_sharing_settings', json_decode( ${ JSON.stringify( sharing ) }, true ) );`
		);
	}
} );
