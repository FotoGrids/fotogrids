import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { getOption, setOption } from './support/site';
import {
	bubble,
	bubbleButton,
	expectTourState,
	freshUser,
	startFromIntro,
	step,
	tourStates,
	type FreshUser,
} from './support/walkthrough';

/**
 * The walkthrough tours on the gallery editor, the album editor and the
 * Dashboard: when they open by themselves, what they point at, and what
 * they store.
 *
 * Serial: every test creates a user and writes user meta and site options.
 */

const TIP_OPTION = 'fotogrids_settings_mode_tip';

let user: FreshUser | null = null;
let savedTip: string | null;

test.beforeAll( () => {
	savedTip = getOption( TIP_OPTION );
} );

test.afterAll( () => {
	setOption( TIP_OPTION, savedTip );
} );

test.afterEach( async () => {
	await user?.close();
	user = null;
} );

const newGallery = '/wp-admin/post-new.php?post_type=fotogrids_gallery';
const newAlbum = '/wp-admin/post-new.php?post_type=fotogrids_album';
const dashboard = '/wp-admin/admin.php?page=fotogrids';

test( 'a first-time user is guided from an empty gallery to a published one', { tag: [ '@critical', '@admin' ] }, async ( {
	browser,
} ) => {
	user = await freshUser( browser );
	const { page } = user;

	await page.goto( newGallery );
	await startFromIntro( page );

	await expect( step( page, 'Add your images' ) ).toBeVisible();
	await expect( bubble( page ) ).toContainText( 'Step 1 of 4' );
	await bubbleButton( page, 'Next' ).click();

	await expect( step( page, 'Choose a layout' ) ).toBeVisible();
	await expect( page.locator( '.fotogrids-settings-tab.fg-is-active[data-fg-settings-tab="layout"]' ) ).toBeVisible();
	await expect( page.locator( '[data-fg-setting="layout"]' ) ).toBeInViewport();
	await bubbleButton( page, 'Next' ).click();

	await expect( step( page, 'Check the preview' ) ).toBeVisible();
	await bubbleButton( page, 'Next' ).click();

	await expect( step( page, 'Publish' ) ).toBeVisible();
	await expect( bubble( page ) ).toContainText( 'this tour comes back' );
	await expectTourState( user.id, 'gallery', 'publish-pending' );
	await bubbleButton( page, 'Got it' ).click();
	await expect( bubble( page ) ).toHaveCount( 0 );

	await page.locator( '#title' ).fill( 'Walkthrough gallery' );
	await Promise.all( [ page.waitForURL( /post\.php\?post=\d+/ ), page.locator( '#publish' ).click() ] );

	await expect( step( page, 'Put it on a page' ) ).toBeVisible( { timeout: 30000 } );
	await expect( bubble( page ) ).toContainText( 'Step 1 of 1' );
	await bubbleButton( page, 'Done' ).click();

	await expectTourState( user.id, 'gallery', 'done' );
	await expect( page.getByText( 'Your gallery is ready' ) ).toBeVisible();
} );

test( 'Not now skips the gallery tour for good', { tag: [ '@admin' ] }, async ( { browser } ) => {
	user = await freshUser( browser );
	const { page } = user;

	await page.goto( newGallery );
	await page.getByRole( 'button', { name: 'Not now', exact: true } ).click( { timeout: 30000 } );
	await expectTourState( user.id, 'gallery', 'skipped' );

	await page.goto( newGallery );
	await expect( page.locator( '.fotogrids-gallery-header' ) ).toBeVisible();
	await page.waitForTimeout( 1500 );
	await expect( page.getByRole( 'button', { name: 'Start the tour' } ) ).toHaveCount( 0 );
} );

test( 'Esc closes a step, stores skipped and gives focus back', { tag: [ '@admin' ] }, async ( { browser } ) => {
	user = await freshUser( browser );
	const { page } = user;

	await page.goto( newGallery );
	await startFromIntro( page );
	await expect( step( page, 'Add your images' ) ).toBeVisible();
	await expect( page.locator( '.fotogrids-walkthrough-bubble__title' ) ).toBeFocused();

	await page.keyboard.press( 'Escape' );
	await expect( bubble( page ) ).toHaveCount( 0 );
	await expectTourState( user.id, 'gallery', 'skipped' );
} );

test( 'the tour is keyboard operable', { tag: [ '@admin' ] }, async ( { browser } ) => {
	user = await freshUser( browser );
	const { page } = user;

	await page.goto( newGallery );
	await startFromIntro( page );
	await expect( step( page, 'Add your images' ) ).toBeVisible();

	await page.keyboard.press( 'Tab' );
	await expect( bubbleButton( page, 'Skip tour' ) ).toBeFocused();
	await page.keyboard.press( 'Tab' );
	await expect( bubbleButton( page, 'Next' ) ).toBeFocused();
	await page.keyboard.press( 'Enter' );
	await expect( step( page, 'Choose a layout' ) ).toBeVisible();
	await expect( page.locator( '.fotogrids-walkthrough-bubble__title' ) ).toBeFocused();
} );

test( 'no auto-start for a user who has made a gallery before', { tag: [ '@admin' ] }, async ( { browser } ) => {
	user = await freshUser( browser );
	galleryPage( {}, undefined, 'Earlier gallery', user.login );
	const { page } = user;

	await page.goto( newGallery );
	await expect( page.locator( '.fotogrids-gallery-header' ) ).toBeVisible();
	await page.waitForTimeout( 1500 );
	await expect( page.getByRole( 'button', { name: 'Start the tour' } ) ).toHaveCount( 0 );
	expect( tourStates( user.id ) ).toEqual( {} );
} );

test( 'Tour in the settings bar replays every step of a saved gallery', { tag: [ '@admin' ] }, async ( { browser } ) => {
	user = await freshUser( browser, 'editor', { fotogrids_settings_mode: 'easy' } );
	const { id } = galleryPage( {}, undefined, 'Saved gallery', user.login );
	const { page } = user;

	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	await page.locator( '.fotogrids-settings-docs-strip__tour' ).click( { timeout: 30000 } );

	for ( const title of [ 'Add your images', 'Choose a layout', 'Check the preview', 'Publish', 'Put it on a page' ] ) {
		await expect( step( page, title ) ).toBeVisible();
		await expect( bubble( page ) ).toContainText( 'of 5' );
		await bubbleButton( page, title === 'Put it on a page' ? 'Done' : 'Next' ).click();
	}

	await expectTourState( user.id, 'gallery', 'done' );
} );

test( 'a tour and the Easy mode upgrade tip never share a page load', { tag: [ '@admin', '@settings' ] }, async ( {
	browser,
} ) => {
	setOption( TIP_OPTION, '1' );
	user = await freshUser( browser );
	const { page } = user;
	const tip = page.locator( '#fg-tooltip' ).getByRole( 'dialog', { name: 'Settings are simpler now' } );

	await page.goto( newGallery );
	await expect( page.getByRole( 'button', { name: 'Start the tour' } ) ).toBeVisible( { timeout: 30000 } );
	await expect( tip ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Not now', exact: true } ).click();
	await expectTourState( user.id, 'gallery', 'skipped' );

	await page.goto( newGallery );
	await expect( tip ).toBeVisible( { timeout: 30000 } );
} );

test( 'fotogrids_walkthrough=1 opens the tour whatever was stored', { tag: [ '@admin' ] }, async ( { browser } ) => {
	user = await freshUser( browser, 'editor', {} );
	galleryPage( {}, undefined, 'Earlier gallery', user.login );
	const { page } = user;

	await page.goto( `${ newGallery }&fotogrids_walkthrough=1` );
	await startFromIntro( page );
	await expect( step( page, 'Add your images' ) ).toBeVisible();
} );

test( 'the album tour runs to Publish, then shows the shortcode after saving', { tag: [ '@admin' ] }, async ( {
	browser,
} ) => {
	user = await freshUser( browser );
	const { page } = user;

	await page.goto( newAlbum );
	await startFromIntro( page );

	await expect( step( page, 'Add galleries' ) ).toBeVisible();
	await expect( bubble( page ) ).toContainText( 'Step 1 of 3' );
	await bubbleButton( page, 'Next' ).click();
	await expect( step( page, 'Choose a layout' ) ).toBeVisible();
	await bubbleButton( page, 'Next' ).click();
	await expect( step( page, 'Publish' ) ).toBeVisible();
	await expectTourState( user.id, 'album', 'publish-pending' );
	await bubbleButton( page, 'Got it' ).click();

	await page.locator( '#title' ).fill( 'Walkthrough album' );
	await Promise.all( [ page.waitForURL( /post\.php\?post=\d+/ ), page.locator( '#publish' ).click() ] );

	await expect( step( page, 'Put it on a page' ) ).toBeVisible( { timeout: 30000 } );
	await bubbleButton( page, 'Done' ).click();
	await expectTourState( user.id, 'album', 'done' );
} );

test( 'the Dashboard tour opens for a first-time user and replays from Learn', { tag: [ '@admin' ] }, async ( {
	browser,
} ) => {
	user = await freshUser( browser );
	const { page } = user;

	await page.goto( dashboard );
	await page.getByRole( 'button', { name: 'Not now', exact: true } ).click( { timeout: 30000 } );
	await expectTourState( user.id, 'dashboard', 'skipped' );

	await page.getByRole( 'button', { name: 'Take the tour' } ).click();
	for ( const title of [ 'Start here', 'Or drop images straight in', 'More ways to start' ] ) {
		await expect( step( page, title ) ).toBeVisible();
		await bubbleButton( page, 'Next' ).click();
	}

	// The setup card is replaced by Recently Edited once the site is set up.
	const setup = step( page, 'Track your setup' );
	const help = step( page, 'Help when you need it' );
	await expect( setup.or( help ) ).toBeVisible();
	if ( await setup.isVisible() ) {
		await bubbleButton( page, 'Next' ).click();
	}
	await expect( help ).toBeVisible();
	await bubbleButton( page, 'Done' ).click();
	await expectTourState( user.id, 'dashboard', 'done' );
} );

test( 'the step bubble fits a narrow screen', { tag: [ '@admin' ] }, async ( { browser } ) => {
	user = await freshUser( browser );
	const { page } = user;
	await page.setViewportSize( { width: 600, height: 900 } );

	await page.goto( newGallery );
	await startFromIntro( page );
	await expect( step( page, 'Add your images' ) ).toBeVisible();

	const box = await bubble( page ).boundingBox();
	expect( box ).not.toBeNull();
	expect( box!.x ).toBeGreaterThanOrEqual( 0 );
	expect( box!.x + box!.width ).toBeLessThanOrEqual( 600 );
} );
