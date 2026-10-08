import type { Page } from '@playwright/test';
import { expect } from './test';

/**
 * A payload for the places an editor's text reaches a rendered page.
 *
 * It sets `window.__fgXss` if any part runs, and carries a marker. `expectInert`
 * requires both: the sentinel unset and the marker arrived, since a page that
 * dropped the text would pass on the sentinel alone.
 */

export const MARKER = 'fgXssMarker';

/** Script tag, img handler, and a `</script>` to break out of JSON-LD. */
export const PAYLOAD = `${ MARKER }</script><img src=x onerror="window.__fgXss=1"><script>window.__fgXss=1</script>`;

declare global {
	interface Window {
		__fgXss?: number;
		fotogridsSettings?: Record< string, unknown >;
	}
}

/** The marker reached the page, and nothing in the payload ran. */
export async function expectInert( page: Page, where: string ): Promise< void > {
	// Serialized DOM, so a marker inside a script tag counts.
	expect(
		await page.content(),
		`${ where }: the payload never reached the page, so nothing was proven`
	).toContain( MARKER );

	expect(
		await page.evaluate( () => window.__fgXss ),
		`${ where }: the payload executed`
	).toBeUndefined();
}
