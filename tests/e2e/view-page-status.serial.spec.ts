import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { storageStateFor, wpCli, wpEval } from './support/roles';

/**
 * How a collection's post status shapes its view page and its view count.
 *
 * Published and private collections render as normal view pages and record one
 * view per visit. Draft, pending and scheduled collections render as a draft
 * preview for their editors and record nothing. Each case runs in both layout
 * modes.
 *
 * Serial: it switches the site-wide view page layout mode.
 */

test.describe.configure( { mode: 'serial' } );

const MODES = [ 'integrated', 'standalone' ] as const;

type Collection = { id: number; kind: 'gallery' | 'album'; view: string; embed: string };

let viewSettings: string | null;
let c: Record< string, Collection >;

function viewUrl( id: number ): string {
	return wpEval( `echo get_permalink( ${ id } );` ).trim();
}

function gallery( status: string, settings: Record< string, unknown > = {} ): Collection {
	const { id, url } = galleryPage( settings, fixture< number[] >( 'F-small', 'items' ).slice( 0, 2 ), `View page ${ status }`, 'admin', status );
	return { id, kind: 'gallery', view: viewUrl( id ), embed: url };
}

function albumOf( status: string, children: number[] ): Collection {
	const made = album( children, {}, `View page album ${ status }`, 'admin', status );
	return { id: made.id, kind: 'album', view: made.view, embed: made.url };
}

function setLayoutMode( mode: string ): void {
	wpEval(
		`$s = get_option( 'fotogrids_view_settings', array() ); if ( ! is_array( $s ) ) { $s = array(); } $s['layout_mode'] = '${ mode }'; update_option( 'fotogrids_view_settings', $s );`
	);
}

/** Views recorded against a collection. */
function views( { id, kind }: Collection ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE( SUM( views ), 0 ) FROM {$wpdb->prefix}fotogrids_statistics WHERE object_type = %s AND object_id = %d", '${ kind }', ${ id } ) );`
		).trim()
	);
}

function resetViews( { id, kind }: Collection ): void {
	wpEval(
		`global $wpdb; $wpdb->delete( $wpdb->prefix . 'fotogrids_statistics', array( 'object_type' => '${ kind }', 'object_id' => ${ id } ) );`
	);
}

function isViewPing( url: string, method: string ): boolean {
	return 'POST' === method && decodeURIComponent( url ).includes( 'stats/view' );
}

/** Open a view page and wait for the view request it sends. */
async function visitCounted( page: Page, target: Collection ): Promise< void > {
	const ping = page.waitForResponse( ( r ) => isViewPing( r.url(), r.request().method() ) );
	await page.goto( target.view );
	expect( ( await ping ).ok() ).toBe( true );
}

/**
 * Open a view page and confirm it carries no stats config, so its script has
 * nothing to send, and that no view request went out while it loaded.
 */
async function visitUncounted( page: Page, target: Collection ): Promise< void > {
	const pings: string[] = [];
	page.on( 'request', ( r ) => {
		if ( isViewPing( r.url(), r.method() ) ) {
			pings.push( r.url() );
		}
	} );
	await page.goto( target.view );
	await expect( rendered( page, target ) ).toBeVisible();
	await expect( page.locator( '[data-fg-stats]' ) ).toHaveCount( 0 );
	expect( pings ).toEqual( [] );
}

function rendered( page: Page, target: Collection ) {
	return page.locator( `[data-fg-${ target.kind }-id="${ target.id }"]` ).first();
}

test.beforeAll( () => {
	try {
		viewSettings = execFileSync( wpCli(), [ 'option', 'get', 'fotogrids_view_settings', '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} );
	} catch {
		viewSettings = null;
	}

	const published = gallery( 'publish' );
	const priv = gallery( 'private' );

	c = {
		published,
		private: priv,
		privateNoStats: gallery( 'private', { enable_statistics: false } ),
		privateLocked: gallery( 'private', { password_protect: true, password_remember: false } ),
		draft: gallery( 'draft' ),
		future: gallery( 'draft' ),
		privateAlbum: albumOf( 'private', [ published.id, priv.id ] ),
		pendingAlbum: albumOf( 'pending', [ published.id ] ),
	};

	wpEval(
		`update_post_meta( ${ c.privateLocked.id }, 'fotogrids_password', \\FotoGrids\\Password_Crypto::encrypt( 'open-sesame' ) );`
	);
	wpEval(
		`wp_update_post( array( 'ID' => ${ c.future.id }, 'post_status' => 'future', 'edit_date' => true, 'post_date' => gmdate( 'Y-m-d H:i:s', time() + WEEK_IN_SECONDS ), 'post_date_gmt' => gmdate( 'Y-m-d H:i:s', time() + WEEK_IN_SECONDS ) ) );`
	);
	c.future.view = viewUrl( c.future.id );
} );

test.afterAll( () => {
	if ( null === viewSettings ) {
		wpEval( `delete_option( 'fotogrids_view_settings' );` );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', 'fotogrids_view_settings', '--format=json' ], {
		encoding: 'utf8',
		input: viewSettings,
	} );
} );

for ( const mode of MODES ) {
	test.describe( `${ mode } layout`, () => {
		test.beforeAll( () => setLayoutMode( mode ) );

		test.describe( 'an administrator', () => {
			test.use( { storageState: storageStateFor( 'administrator' ) } );

			for ( const key of [ 'private', 'privateAlbum' ] ) {
				test( `sees a ${ key } view page as a normal page and records one view`, { tag: [ '@permissions', '@layout' ] }, async ( {
					page,
				} ) => {
					const target = c[ key ];
					resetViews( target );

					await visitCounted( page, target );

					await expect( rendered( page, target ) ).toBeVisible();
					await expect( page.locator( '.fotogrids-view__notice' ) ).toHaveCount( 0 );
					await expect.poll( () => views( target ) ).toBe( 1 );
				} );
			}

			test( 'records nothing for a private gallery with statistics switched off', { tag: [ '@permissions', '@layout' ] }, async ( {
				page,
			} ) => {
				resetViews( c.privateNoStats );

				await visitUncounted( page, c.privateNoStats );

				await expect( rendered( page, c.privateNoStats ) ).toBeVisible();
				await expect( page.locator( '.fotogrids-view__notice' ) ).toHaveCount( 0 );
				expect( views( c.privateNoStats ) ).toBe( 0 );
			} );

			test( 'unlocks a password-protected private gallery and records one view', { tag: [ '@permissions', '@gate' ] }, async ( {
				page,
			} ) => {
				const target = c.privateLocked;
				resetViews( target );

				await page.goto( target.view );
				await expect( page.locator( '.fotogrids-view__notice' ) ).toHaveCount( 0 );

				const ping = page.waitForResponse( ( r ) => isViewPing( r.url(), r.request().method() ) );
				const form = page.locator( `.fg-lock-form[data-gallery-id="${ target.id }"]` );
				await form.locator( '.fg-lock-input' ).fill( 'open-sesame' );
				await form.locator( '.fg-lock-submit' ).click();

				await expect( rendered( page, target ).locator( '.fg-item' ) ).toHaveCount( 2, { timeout: 15000 } );
				expect( ( await ping ).ok() ).toBe( true );
				await expect.poll( () => views( target ) ).toBe( 1 );
			} );

			for ( const key of [ 'draft', 'future', 'pendingAlbum' ] ) {
				test( `previews a ${ key } with the draft notice, noindex and no view`, { tag: [ '@permissions', '@layout' ] }, async ( {
					page,
				} ) => {
					const target = c[ key ];
					resetViews( target );

					await visitUncounted( page, target );

					await expect( rendered( page, target ) ).toBeVisible();
					await expect( page.locator( '.fotogrids-view__notice' ) ).toHaveCount( 1 );
					await expect( page.locator( 'meta[name="robots"][content*="noindex"]' ) ).toHaveCount( 1 );
					expect( views( target ) ).toBe( 0 );
				} );
			}
		} );

		test.describe( 'an editor', () => {
			test.use( { storageState: storageStateFor( 'editor' ) } );

			test( "sees another user's private gallery as a normal page and records one view", { tag: [ '@permissions', '@layout' ] }, async ( {
				page,
			} ) => {
				resetViews( c.private );

				await visitCounted( page, c.private );

				await expect( rendered( page, c.private ) ).toBeVisible();
				await expect( page.locator( '.fotogrids-view__notice' ) ).toHaveCount( 0 );
				await expect.poll( () => views( c.private ) ).toBe( 1 );
			} );
		} );

		test.describe( 'a subscriber', () => {
			test.use( { storageState: storageStateFor( 'subscriber' ) } );

			test( 'records a view on a published gallery a visitor rendered first', { tag: [ '@critical', '@cache' ] }, async ( {
				page,
				browser,
			} ) => {
				const visitor = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
				await ( await visitor.newPage() ).goto( c.published.view );
				await visitor.close();
				resetViews( c.published );

				await visitCounted( page, c.published );
				await expect.poll( () => views( c.published ) ).toBe( 1 );
			} );
		} );

		test.describe( 'a logged-out visitor', () => {
			test.use( { storageState: { cookies: [], origins: [] } } );

			test( 'records one view per visit to a published gallery', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
				resetViews( c.published );

				await visitCounted( page, c.published );
				await expect.poll( () => views( c.published ) ).toBe( 1 );

				await visitCounted( page, c.published );
				await expect.poll( () => views( c.published ) ).toBe( 2 );
			} );

			test( 'gets no view page and records nothing for private collections', { tag: [ '@permissions' ] }, async ( { page } ) => {
				for ( const key of [ 'private', 'privateAlbum' ] ) {
					resetViews( c[ key ] );

					expect( ( await page.request.get( c[ key ].view ) ).status(), key ).toBe( 404 );
					expect( views( c[ key ] ), key ).toBe( 0 );
				}
			} );
		} );
	} );
}

test.describe( 'a private gallery embedded in a page', () => {
	test( 'renders for an administrator', { tag: [ '@permissions', '@layout' ] }, async ( { browser } ) => {
		const context = await browser.newContext( { storageState: storageStateFor( 'administrator' ) } );
		const page = await context.newPage();

		await page.goto( c.private.embed );

		await expect( rendered( page, c.private ) ).toBeVisible();
		await context.close();
	} );

	test( 'leaves a draft gallery unrendered for an administrator', { tag: [ '@permissions' ] }, async ( { browser } ) => {
		const context = await browser.newContext( { storageState: storageStateFor( 'administrator' ) } );
		const page = await context.newPage();

		await page.goto( c.draft.embed );

		await expect( rendered( page, c.draft ) ).toHaveCount( 0 );
		await expect( page.locator( '.fotogrids-error' ) ).toContainText( 'is not published' );
		await context.close();
	} );

	test( 'stays hidden from a visitor after a reader has rendered it', { tag: [ '@permissions', '@cache' ] }, async ( { browser } ) => {
		const context = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
		const page = await context.newPage();

		await page.goto( c.private.embed );

		await expect( rendered( page, c.private ) ).toHaveCount( 0 );
		await expect( page.locator( '.fotogrids-error' ) ).toContainText( 'is not published' );
		await context.close();
	} );
} );
