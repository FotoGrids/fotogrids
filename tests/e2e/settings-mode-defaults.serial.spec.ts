import type { Browser, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { roles, storageStateFor } from './support/roles';
import { getOption, setOption } from './support/site';
import {
	ModeSwitch,
	SITE_MODE_OPTION,
	USER_MODE_META,
	presetGroup,
	setUserMeta,
} from './support/settings-mode';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Settings > Defaults: the Setup Mode panel sets the site default that users
 * without a choice of their own follow, and the defaults tree follows the
 * viewer's own mode.
 *
 * Serial: writes the site default and user meta.
 */

const admin = () => roles().roles.administrator.user;
const editor = () => roles().roles.editor.user;

let savedSiteMode: string | null;

test.beforeAll( () => {
	savedSiteMode = getOption( SITE_MODE_OPTION );
} );

test.afterAll( () => {
	setOption( SITE_MODE_OPTION, savedSiteMode );
	setUserMeta( admin(), USER_MODE_META, null );
	setUserMeta( editor(), USER_MODE_META, null );
} );

test.beforeEach( () => {
	setOption( 'fotogrids_settings_mode_tip', null );
	setOption( SITE_MODE_OPTION, 'easy' );
	setUserMeta( admin(), USER_MODE_META, null );
	setUserMeta( editor(), USER_MODE_META, null );
} );

function setupPanel( page: Page ) {
	return page.locator( '.fotogrids-sidebar-layout__panel' ).filter( {
		has: page.getByRole( 'heading', { name: 'Setup Mode', exact: true } ),
	} );
}

function card( page: Page, label: 'Easy' | 'Advanced' ) {
	return setupPanel( page ).locator( 'label' ).filter( { hasText: new RegExp( `^\\s*${ label }` ) } );
}

function radio( page: Page, label: 'Easy' | 'Advanced' ) {
	return setupPanel( page ).getByRole( 'radio', { name: new RegExp( `^${ label }` ) } );
}

async function openDefaults( page: Page ): Promise< void > {
	await page.goto( '/wp-admin/admin.php?page=fotogrids-settings&tab=defaults&subtab=gallery' );
	await expect( new CollectionSettings( page ).activeLayout() ).toBeVisible( { timeout: 20000 } );
}

async function panelReady( page: Page ): Promise< void > {
	await expect( page.locator( '.fotogrids-settings-tab__label' ).first() ).toBeVisible( { timeout: 20000 } );
}

async function editorPage( browser: Browser ): Promise< Page > {
	const context = await browser.newContext( {
		baseURL: process.env.WP_BASE_URL,
		storageState: storageStateFor( 'editor' ),
	} );
	return context.newPage();
}

async function pick( page: Page, label: 'Easy' | 'Advanced' ): Promise< void > {
	const write = page.waitForResponse(
		( r ) =>
			'POST' === r.request().method() &&
			r.url().includes( 'admin-ajax.php' ) &&
			( r.request().postData() ?? '' ).includes( 'fotogrids_update_plugin_setting' )
	);
	await card( page, label ).click();
	expect( ( await ( await write ).json() ).success ).toBe( true );
	await expect( radio( page, label ) ).toBeChecked();
}

test( 'the Setup Mode panel sets the default that users without a choice follow', { tag: [ '@critical', '@admin', '@settings' ] }, async ( {
	page,
	browser,
} ) => {
	setUserMeta( admin(), USER_MODE_META, 'easy' );
	const { id: editorsOwn } = galleryPage( {}, undefined, 'Editor default-mode gallery', editor() );
	const { id: own } = galleryPage();

	await openDefaults( page );
	await expect( setupPanel( page ) ).toContainText( 'Default mode for new users' );
	await expect( setupPanel( page ) ).toContainText( "Used by everyone who hasn't picked a mode yet." );
	await expect( radio( page, 'Easy' ) ).toBeChecked();

	await pick( page, 'Advanced' );
	await expect( page.getByText( 'Default mode saved.' ) ).toBeVisible();
	expect( getOption( SITE_MODE_OPTION ) ).toBe( 'advanced' );

	await page.reload();
	await expect( radio( page, 'Advanced' ) ).toBeChecked( { timeout: 20000 } );

	const other = await editorPage( browser );
	try {
		await other.goto( `/wp-admin/post.php?post=${ editorsOwn }&action=edit` );
		await panelReady( other );
		await new ModeSwitch( other ).expectActive( 'advanced' );
		await expect( new CollectionSettings( other ).tabLabels() ).resolves.toContain( 'Performance' );

		// The administrator chose Easy for themselves, so the default does not move them.
		await page.goto( `/wp-admin/post.php?post=${ own }&action=edit` );
		await panelReady( page );
		await new ModeSwitch( page ).expectActive( 'easy' );

		await openDefaults( page );
		await pick( page, 'Easy' );
		expect( getOption( SITE_MODE_OPTION ) ).toBe( 'easy' );

		await other.reload();
		await panelReady( other );
		await new ModeSwitch( other ).expectActive( 'easy' );
	} finally {
		await other.context().close();
	}
} );

test( 'the Defaults tree follows the viewer’s own mode', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const panel = new CollectionSettings( page );
	setOption( SITE_MODE_OPTION, 'advanced' );
	setUserMeta( admin(), USER_MODE_META, 'easy' );

	await openDefaults( page );
	await panel.openTab( 'Layout' );
	await expect( presetGroup( page, 'Spacing' ) ).toBeVisible();
	await expect( panel.field( 'item_spacing' ) ).toHaveCount( 0 );

	setUserMeta( admin(), USER_MODE_META, 'advanced' );
	setOption( SITE_MODE_OPTION, 'easy' );
	await openDefaults( page );
	await panel.openTab( 'Layout' );
	await expect( panel.field( 'item_spacing' ) ).toBeVisible();
	await expect( presetGroup( page, 'Spacing' ) ).toHaveCount( 0 );
} );
