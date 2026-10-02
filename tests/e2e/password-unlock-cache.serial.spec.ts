import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { wpCli } from './support/roles';

/**
 * Unlocking a password gallery whose lock screen came from the render cache.
 *
 * The lock screen enqueues only the gate's own script, which depends on the
 * runtime. The unlock response then hands the page every module the gallery
 * needs, and the page injects them. A module that runs before the runtime
 * never subscribes to the gallery, so the unlocked gallery has to behave the
 * same whether its lock screen was a cache hit or a miss.
 *
 * Serial: sharing is switched on site-wide for the duration.
 */

const PASSWORD = 'cache-hit-unlock';
const SHARING_OPTION = 'fotogrids_sharing_settings';

test.describe.configure( { mode: 'serial' } );

function wp( args: string[], input?: string ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8', input } ).trim();
}

function readOption( name: string ): string | null {
	try {
		return execFileSync( wpCli(), [ 'option', 'get', name, '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}
}

function writeOption( name: string, json: string | null ): void {
	if ( null === json ) {
		try {
			wp( [ 'option', 'delete', name ] );
		} catch {
			// Already absent.
		}
		return;
	}
	wp( [ 'option', 'update', name, '--format=json' ], json );
}

/** A password-protected gallery with thumbnail share bars, on its own page. */
function lockedGallery(): { id: number; url: string } {
	const gallery = galleryPage( {
		password_protect: true,
		password_remember: true,
		enable_cache: true,
	} );

	wp( [
		'eval',
		`update_post_meta( ${ gallery.id }, 'fotogrids_password', \\FotoGrids\\Password_Crypto::encrypt( '${ PASSWORD }' ) );` +
			` \\FotoGrids\\FotoGrids_Cache::flush_for_gallery( ${ gallery.id } );`,
	] );

	return gallery;
}

async function unlockAndCountBars( page: Page, url: string ): Promise< number > {
	await page.goto( url );
	await page.locator( '.fg-lock-input' ).fill( PASSWORD );
	await page.locator( '.fg-lock-submit' ).click();

	await expect( page.locator( '.fotogrids-gate' ) ).toHaveCount( 0 );
	await expect( page.locator( '[data-fg-sharing]' ) ).toHaveCount( 1 );

	const bars = page.locator( '.fotogrids-share-bar--thumbnail' );
	await expect( bars.first() ).toBeAttached();
	return bars.count();
}

test.describe( 'password unlock and the render cache', () => {
	let sharingBefore: string | null = null;

	test.beforeAll( () => {
		sharingBefore = readOption( SHARING_OPTION );
		writeOption(
			SHARING_OPTION,
			JSON.stringify( {
				enable_social_sharing: true,
				placements: [ 'thumbnail' ],
			} )
		);
	} );

	test.afterAll( () => {
		writeOption( SHARING_OPTION, sharingBefore );
	} );

	test( 'a cached lock screen unlocks to the same share bars as an uncached one', async ( {
		browser,
	} ) => {
		const { id, url } = lockedGallery();

		// First visit: the lock screen is rendered and written to the cache.
		const miss = await browser.newContext();
		const missBars = await unlockAndCountBars( await miss.newPage(), url );
		await miss.close();

		expect(
			wp( [ 'eval', `echo null === \\FotoGrids\\FotoGrids_Cache::get_meta( ${ id } ) ? 'empty' : 'cached';` ] ),
			'the first visit did not write the lock screen to the cache'
		).toBe( 'cached' );

		// A new visitor: no unlock cookie, so the lock screen is a cache hit.
		const hit = await browser.newContext();
		const hitPage = await hit.newPage();
		const hitBars = await unlockAndCountBars( hitPage, url );

		expect( missBars ).toBeGreaterThan( 0 );
		expect( hitBars ).toBe( missBars );
		await hit.close();
	} );
} );
