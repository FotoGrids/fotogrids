import type { Browser, BrowserContext } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';

/**
 * GATE-10. A gated render is never shared between visitors.
 *
 * The render cache stores a gallery's HTML after its gates have run, so a
 * gated gallery must stay out of it: otherwise the first visitor's outcome
 * is replayed to everyone after them.
 *
 * Scoped: every gallery here is created by the spec.
 */

const PASSWORD = 'gate-10-secret';

/** Render cache rows held for a gallery. */
function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

/** A password-protected gallery and the page that renders it. */
function passwordGallery(): { id: number; url: string } {
	const created = galleryPage( {
		enable_cache: true,
		password_protect: true,
		password_remember: true,
	} );

	wpEval(
		`update_post_meta( ${ created.id }, 'fotogrids_password', \\FotoGrids\\Password_Crypto::encrypt( '${ PASSWORD }' ) );`
	);

	return created;
}

/** Load a page in a context and report what the visitor was shown. */
async function visit(
	context: BrowserContext,
	url: string,
	galleryId: number
): Promise< { gated: boolean; items: number } > {
	const page = await context.newPage();
	await page.goto( url );

	const gallery = new GalleryRender( page, galleryId );
	const shown = {
		gated: ( await page.locator( '.fotogrids-gate' ).count() ) > 0,
		items: await gallery.items().count(),
	};

	await page.close();
	return shown;
}

/** Load a page in a context and return its Cache-Control header. */
async function cacheControl( context: BrowserContext, url: string ): Promise< string > {
	const page = await context.newPage();
	const response = await page.goto( url );
	const header = ( await response?.headerValue( 'cache-control' ) ) ?? '';
	await page.close();
	return header;
}

async function anonymous( browser: Browser ): Promise< BrowserContext > {
	return browser.newContext();
}

async function subscriber( browser: Browser ): Promise< BrowserContext > {
	return browser.newContext( { storageState: storageStateFor( 'subscriber' ) } );
}

async function unlock( context: BrowserContext, galleryId: number ): Promise< void > {
	const response = await context.request.post(
		`/?rest_route=${ encodeURIComponent( `/fotogrids/v1/gallery/${ galleryId }/unlock` ) }`,
		{ data: { password: PASSWORD } }
	);
	expect( response.status() ).toBe( 200 );
}

test( 'an ungated gallery is cached, so the cache is on for the rows below', { tag: [ '@critical', '@cache', '@gate' ] }, async ( {
	browser,
} ) => {
	const { id, url } = galleryPage( { enable_cache: true } );
	const guest = await anonymous( browser );

	expect( ( await visit( guest, url, id ) ).items ).toBeGreaterThan( 0 );
	expect( cachedRows( id ) ).toBeGreaterThan( 0 );

	await guest.close();
} );

test.describe( 'a registered-users gallery', () => {
	test( "GATE-10: a subscriber's render does not reach a guest", { tag: [ '@critical', '@cache', '@gate' ] }, async ( { browser } ) => {
		const { id, url } = galleryPage( {
			enable_cache: true,
			who_can_view: 'registered_users',
		} );
		const member = await subscriber( browser );
		const guest = await anonymous( browser );

		const seenByMember = await visit( member, url, id );
		expect( seenByMember.gated ).toBe( false );
		expect( seenByMember.items ).toBeGreaterThan( 0 );

		const seenByGuest = await visit( guest, url, id );
		expect( seenByGuest.gated, 'the guest was served the subscriber render' ).toBe( true );
		expect( seenByGuest.items ).toBe( 0 );

		expect( cachedRows( id ) ).toBe( 0 );

		await member.close();
		await guest.close();
	} );

	test( "GATE-10: a guest's login screen does not reach a subscriber", { tag: [ '@critical', '@cache', '@gate' ] }, async ( { browser } ) => {
		const { id, url } = galleryPage( {
			enable_cache: true,
			who_can_view: 'registered_users',
		} );
		const member = await subscriber( browser );
		const guest = await anonymous( browser );

		expect( ( await visit( guest, url, id ) ).gated ).toBe( true );

		const seenByMember = await visit( member, url, id );
		expect( seenByMember.gated, 'the subscriber was served the login screen' ).toBe( false );
		expect( seenByMember.items ).toBeGreaterThan( 0 );

		await member.close();
		await guest.close();
	} );
} );

test.describe( 'a password-protected gallery', () => {
	test( 'GATE-10: an unlocked render does not reach a visitor without the cookie', { tag: [ '@critical', '@cache', '@gate' ] }, async ( {
		browser,
	} ) => {
		const { id, url } = passwordGallery();
		const unlocked = await anonymous( browser );
		const stranger = await anonymous( browser );

		await unlock( unlocked, id );
		const seenUnlocked = await visit( unlocked, url, id );
		expect( seenUnlocked.gated ).toBe( false );
		expect( seenUnlocked.items ).toBeGreaterThan( 0 );

		const seenByStranger = await visit( stranger, url, id );
		expect( seenByStranger.gated, 'the password was bypassed' ).toBe( true );
		expect( seenByStranger.items ).toBe( 0 );

		expect( cachedRows( id ) ).toBe( 0 );

		await unlocked.close();
		await stranger.close();
	} );

	test( 'GATE-10: a cached lock screen does not outlive an unlock', { tag: [ '@critical', '@cache', '@gate' ] }, async ( { browser } ) => {
		const { id, url } = passwordGallery();
		const visitor = await anonymous( browser );

		expect( ( await visit( visitor, url, id ) ).gated ).toBe( true );

		await unlock( visitor, id );
		const afterUnlock = await visit( visitor, url, id );
		expect( afterUnlock.gated, 'the lock screen was replayed after unlocking' ).toBe( false );
		expect( afterUnlock.items ).toBeGreaterThan( 0 );

		await visitor.close();
	} );
} );

test.describe( 'page caches in front of the site', () => {
	test( 'a password gallery page asks page caches not to store it, locked or unlocked', { tag: [ '@critical', '@cache', '@gate' ] }, async ( {
		browser,
	} ) => {
		const { id, url } = passwordGallery();
		const visitor = await anonymous( browser );

		expect( await cacheControl( visitor, url ), 'locked visitor' ).toContain( 'no-store' );

		await unlock( visitor, id );
		expect( await cacheControl( visitor, url ), 'unlocked visitor' ).toContain( 'no-store' );

		await visitor.close();
	} );

	test( 'an ungated gallery page stays cacheable', { tag: [ '@critical', '@cache', '@gate' ] }, async ( { browser } ) => {
		const { url } = galleryPage( { enable_cache: true } );
		const guest = await anonymous( browser );

		expect( await cacheControl( guest, url ) ).not.toContain( 'no-store' );

		await guest.close();
	} );
} );
