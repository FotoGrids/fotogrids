import { execFileSync } from 'child_process';
import type { Browser, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { storageStateFor, wpCli, wpEval } from './support/roles';
import { SettingsPage } from './support/settings-page';

/**
 * A change saved on Settings → Sharing reaches a gallery already in the
 * render cache.
 *
 * Changes go through the Sharing tab as an administrator; the gallery is
 * viewed by a logged-out visitor, the only visitor the cache serves.
 *
 * Serial: sharing is a site-wide option, restored after each test.
 */

test.describe.configure( { mode: 'serial' } );
test.use( { storageState: storageStateFor( 'administrator' ) } );

const OPTION = 'fotogrids_sharing_settings';
const REST = '/fotogrids/v1/admin/sharing-settings';

const BASELINE = {
	enable_social_sharing: true,
	networks: {
		facebook: true,
		x: true,
		pinterest: true,
		linkedin: false,
		whatsapp: false,
		telegram: false,
		reddit: false,
		email: true,
		copy_link: true,
	},
	button_style: 'icons_only',
	button_size: 'medium',
	placements: [ 'view_page', 'lightbox', 'thumbnail' ],
	custom_text: '',
	track_clicks: true,
	deep_linking_enabled: true,
	embedded_share_target: 'image',
};

type Visit = {
	thumbnailBars: number;
	networks: string[];
	barClass: string | null;
	lightboxShare: number;
};

let saved: string | null;

function readOption(): string | null {
	try {
		return execFileSync( wpCli(), [ 'option', 'get', OPTION, '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}
}

function writeOption( value: string | null ): void {
	if ( null === value ) {
		execFileSync( wpCli(), [ 'option', 'delete', OPTION ], { encoding: 'utf8' } );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', OPTION, '--format=json' ], {
		encoding: 'utf8',
		input: value,
	} );
}

function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

/** What a logged-out visitor gets from one page view. */
async function visit( browser: Browser, url: string, galleryId: number, lightbox = false ): Promise< Visit > {
	// Explicitly empty: contexts inherit the administrator session from test.use.
	const guest = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
	const page = await guest.newPage();
	const errors: string[] = [];
	page.on( 'pageerror', ( error ) => errors.push( error.message ) );

	await page.goto( url );
	const gallery = new GalleryRender( page, galleryId );
	await gallery.waitFor();
	await expect( gallery.items().first() ).toBeVisible();

	const bars = page.locator( `[data-fg-gallery-id="${ galleryId }"] .fotogrids-share-bar--thumbnail` );
	const result: Visit = {
		thumbnailBars: await bars.count(),
		networks: await bars
			.first()
			.locator( '.fotogrids-share-bar__btn' )
			.evaluateAll( ( buttons ) => buttons.map( ( button ) => ( button as HTMLElement ).dataset.network ?? '' ) ),
		barClass: ( await bars.count() ) > 0 ? await bars.first().getAttribute( 'class' ) : null,
		lightboxShare: 0,
	};

	if ( lightbox ) {
		// A thumbnail share bar can sit over the trigger, so the click is dispatched.
		await gallery.triggers().first().dispatchEvent( 'click' );
		await expect( page.locator( 'dialog.fg-lightbox .fg-lb-img' ) ).toBeVisible( { timeout: 15000 } );
		result.lightboxShare = await page.locator( 'dialog.fg-lightbox .fg-lb-share' ).count();
	}

	await guest.close();
	expect( errors, 'the visitor page threw' ).toEqual( [] );
	return result;
}

/** A gallery a visitor has already been served from the cache. */
async function cachedGallery( browser: Browser ): Promise< { id: number; url: string; before: Visit } > {
	const gallery = galleryPage( { enable_cache: true } );

	await visit( browser, gallery.url, gallery.id );
	const before = await visit( browser, gallery.url, gallery.id, true );
	expect( cachedRows( gallery.id ), 'the gallery was not cached' ).toBe( 1 );

	return { ...gallery, before };
}

/** Make changes on the Sharing tab and wait until the stored option has them. */
async function changeSharing(
	page: Page,
	change: ( tab: Page ) => Promise< void >,
	stored: ( settings: Record< string, unknown > ) => boolean
): Promise< void > {
	const settings = new SettingsPage( page );
	const read = settings.read( REST );
	await settings.open( 'sharing' );
	await read;

	await change( page );

	await expect.poll( () => stored( JSON.parse( readOption() ?? '{}' ) ), { timeout: 15000 } ).toBe( true );
	await expect( page.locator( '.fotogrids-save-bar__dot--clean' ) ).toBeVisible( { timeout: 15000 } );
}

function rowSwitch( page: Page, title: string ) {
	return page
		.locator( '.fotogrids-sidebar-layout__panel__row', {
			has: page.locator( '.fotogrids-sidebar-layout__panel__row__title', { hasText: new RegExp( `^${ title }$` ) } ),
		} )
		.getByRole( 'switch' );
}

function networkSwitch( page: Page, label: string ) {
	return page
		.locator( '.fotogrids-toggle-control', { has: page.locator( 'label', { hasText: new RegExp( `^${ label }$` ) } ) } )
		.getByRole( 'switch' );
}

test.beforeEach( () => {
	saved = readOption();
	writeOption( JSON.stringify( BASELINE ) );
	wpEval( '\\FotoGrids\\FotoGrids_Cache::flush_all();' );
} );

test.afterEach( () => {
	writeOption( saved );
} );

test( 'turning sharing off removes the share buttons from a cached gallery', { tag: [ '@cache', '@settings' ] }, async ( {
	page,
	browser,
} ) => {
	const gallery = await cachedGallery( browser );
	expect( gallery.before.thumbnailBars, 'thumbnail bars before' ).toBe( 5 );
	expect( gallery.before.lightboxShare, 'Lightbox share before' ).toBe( 1 );

	await changeSharing(
		page,
		( tab ) => rowSwitch( tab, 'Enable sharing' ).click(),
		( stored ) => false === stored.enable_social_sharing
	);

	const after = await visit( browser, gallery.url, gallery.id, true );
	expect( after.thumbnailBars, 'thumbnail bars after' ).toBe( 0 );
	expect( after.lightboxShare, 'Lightbox share after' ).toBe( 0 );
} );

test( 'turning sharing on reaches a gallery cached while it was off', { tag: [ '@cache', '@settings' ] }, async ( {
	page,
	browser,
} ) => {
	writeOption( JSON.stringify( { ...BASELINE, enable_social_sharing: false } ) );
	const gallery = await cachedGallery( browser );
	expect( gallery.before.thumbnailBars, 'thumbnail bars before' ).toBe( 0 );

	await changeSharing(
		page,
		( tab ) => rowSwitch( tab, 'Enable sharing' ).click(),
		( stored ) => true === stored.enable_social_sharing
	);

	const after = await visit( browser, gallery.url, gallery.id, true );
	expect( after.thumbnailBars, 'thumbnail bars after' ).toBe( 5 );
	expect( after.lightboxShare, 'Lightbox share after' ).toBe( 1 );
} );

test( 'networks, placements and button style reach a cached gallery', { tag: [ '@cache', '@settings' ] }, async ( {
	page,
	browser,
} ) => {
	const gallery = await cachedGallery( browser );
	expect( gallery.before.networks ).toEqual( [ 'facebook', 'x', 'pinterest', 'email', 'copy_link' ] );
	expect( gallery.before.barClass ).toContain( 'fotogrids-share-bar--icons_only' );

	await changeSharing(
		page,
		async ( tab ) => {
			await networkSwitch( tab, 'LinkedIn' ).click();
			await networkSwitch( tab, 'Facebook' ).click();
			await rowSwitch( tab, 'Lightbox' ).click();
			await tab.getByRole( 'radiogroup', { name: 'Button style' } ).getByRole( 'radio', { name: 'Labels only' } ).click();
			await tab.getByRole( 'radiogroup', { name: 'Button size' } ).getByRole( 'radio', { name: 'Large' } ).click();
		},
		( stored ) => {
			const networks = stored.networks as Record< string, boolean >;
			return (
				networks.linkedin &&
				! networks.facebook &&
				! ( stored.placements as string[] ).includes( 'lightbox' ) &&
				'labels_only' === stored.button_style &&
				'large' === stored.button_size
			);
		}
	);

	const after = await visit( browser, gallery.url, gallery.id, true );
	expect( after.networks ).toEqual( [ 'x', 'pinterest', 'linkedin', 'email', 'copy_link' ] );
	expect( after.barClass ).toContain( 'fotogrids-share-bar--labels_only' );
	expect( after.barClass ).toContain( 'fotogrids-share-bar--large' );
	expect( after.lightboxShare, 'Lightbox share after the placement was removed' ).toBe( 0 );
} );

test( 'saving unchanged sharing settings keeps the cached gallery', { tag: [ '@cache', '@settings' ] }, async ( {
	page,
	browser,
} ) => {
	const gallery = await cachedGallery( browser );

	const settings = new SettingsPage( page );
	await settings.open( 'sharing' );
	const ok = await page.evaluate(
		async ( { path, data } ) => {
			const { wp } = window as unknown as {
				wp: { apiFetch: ( options: object ) => Promise< { settings?: unknown } > };
			};
			const response = await wp.apiFetch( { path, method: 'POST', data } );
			return !! response.settings;
		},
		{ path: REST, data: JSON.parse( readOption() ?? '{}' ) }
	);

	expect( ok ).toBe( true );
	expect( cachedRows( gallery.id ), 'an unchanged save emptied the cache' ).toBe( 1 );
} );
