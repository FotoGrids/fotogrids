import { expect } from './test';
import type { Locator, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { wpCli } from './roles';
import { getOption, setOption } from './site';

/**
 * Screenshots that do not drift.
 *
 * A gallery renders the same markup every time; its pixels do not, because the
 * shot can land before the images have decoded or while a transition is still
 * running. Three consecutive runs differed in up to 78% of their pixels before
 * `settle` existed and are byte-identical after it.
 *
 * `pinSite` covers the state a screenshot inherits from the install rather than
 * from the gallery - the theme's CSS and whether fonts are fetched over the
 * network. It is site-wide, so only a serial spec may call it, and it returns
 * what it changed for an afterAll to put back.
 */

/** The theme every baseline is taken against. */
export const THEME = 'twentytwentyfour';

const FONTS_OPTION = 'fotogrids_allow_google_fonts';

/** Transitions, animations and the caret, all of which can be mid-flight. */
const STILL = `*, *::before, *::after {
	animation: none !important;
	transition: none !important;
	caret-color: transparent !important;
}`;

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

export type SiteState = { theme: string; fonts: string | null };

/** Pin the theme and stop font fetches. Site-wide: serial specs only. */
export function pinSite(): SiteState {
	const before: SiteState = {
		theme: wp( [ 'theme', 'list', '--status=active', '--field=name' ] ),
		fonts: getOption( FONTS_OPTION ),
	};

	if ( THEME !== before.theme ) {
		wp( [ 'theme', 'activate', THEME ] );
	}

	// A Google font that fails or succeeds depending on the network would
	// change text metrics between runs.
	setOption( FONTS_OPTION, '' );

	return before;
}

export function restoreSite( before: SiteState ): void {
	if ( THEME !== before.theme ) {
		wp( [ 'theme', 'activate', before.theme ] );
	}

	setOption( FONTS_OPTION, before.fonts );
}

/**
 * Hold until nothing in `target` can still change.
 *
 * `complete` alone is not enough: an image that failed still reports it, so the
 * natural width is what says the bytes arrived and decoded.
 */
export async function settle( page: Page, target: Locator ): Promise< void > {
	await page.addStyleTag( { content: STILL } );

	await target.evaluate( async ( element ) => {
		const images = Array.from( element.querySelectorAll( 'img' ) );

		await Promise.all(
			images.map( ( image ) =>
				image.complete && image.naturalWidth > 0
					? Promise.resolve()
					: new Promise< void >( ( resolve ) => {
							image.addEventListener( 'load', () => resolve(), { once: true } );
							image.addEventListener( 'error', () => resolve(), { once: true } );
					  } )
			)
		);
	} );

	const broken = await target.evaluate( ( element ) =>
		Array.from( element.querySelectorAll( 'img' ) )
			.filter( ( image ) => 0 === image.naturalWidth )
			.map( ( image ) => image.currentSrc || image.src )
	);
	expect( broken, 'an image never decoded, so the baseline would be of a gap' ).toEqual( [] );

	await page.evaluate( () => document.fonts.ready );

	// Two frames: the first commits any style the waits above triggered, the
	// second is the one that paints it.
	await page.evaluate(
		() =>
			new Promise< void >( ( resolve ) =>
				requestAnimationFrame( () => requestAnimationFrame( () => resolve() ) )
			)
	);
}

/**
 * No rendered text in `target`.
 *
 * Baselines are compared on a runner whose fonts are not this machine's, so a
 * shot containing text is a shot of the host's font stack. A row that needs
 * text needs a bundled font first.
 */
export async function expectNoText( target: Locator ): Promise< void > {
	const text = await target.evaluate( ( element ) => {
		const walker = document.createTreeWalker( element, NodeFilter.SHOW_TEXT );
		const found: string[] = [];

		while ( walker.nextNode() ) {
			const node = walker.currentNode as Text;
			const parent = node.parentElement;
			if ( ! parent ) {
				continue;
			}

			const style = getComputedStyle( parent );
			if ( 'none' === style.display || 'hidden' === style.visibility || '0' === style.opacity ) {
				continue;
			}

			const value = ( node.textContent ?? '' ).trim();
			if ( value ) {
				found.push( value );
			}
		}

		return found;
	} );

	expect( text, 'the baseline would carry text, which does not survive a change of host' ).toEqual(
		[]
	);
}

/** Settle, then compare against the committed baseline. */
export async function expectStable(
	page: Page,
	target: Locator,
	name: string
): Promise< void > {
	await settle( page, target );
	await expect( target ).toHaveScreenshot( `${ name }.png` );
}
