import type { Browser, BrowserContext } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';

/**
 * A failed render is never shared between visitors.
 *
 * A render that fails inside the pipeline shows its error text to users who
 * can edit posts and a hidden placeholder to everyone else. It stays out of
 * the render cache, so a contributor's error box is never replayed to a guest.
 *
 * Scoped: every gallery here is created by the spec.
 */

/** A layout id no Free module supports, so the pipeline fails to render. */
const UNSUPPORTED_LAYOUT = 'carousel';

/** Render cache rows held for a gallery. */
function cachedRows(galleryId: number): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${galleryId} ) );`
		).trim()
	);
}

/** Load a page in a context and return the error block it was shown. */
async function errorShown(
	context: BrowserContext,
	url: string
): Promise<{ count: number; hidden: boolean; text: string }> {
	const page = await context.newPage();
	await page.goto(url);

	const error = page.locator('.fotogrids-error');
	const count = await error.count();
	const shown = {
		count,
		hidden: count > 0 ? await error.first().isHidden() : false,
		text:
			count > 0 ? ((await error.first().textContent()) ?? '').trim() : '',
	};

	await page.close();
	return shown;
}

async function contributor(browser: Browser): Promise<BrowserContext> {
	return browser.newContext({ storageState: storageStateFor('contributor') });
}

test(
	"a contributor's error render does not reach a guest",
	{ tag: ['@critical', '@cache'] },
	async ({ browser }) => {
		const { id, url } = galleryPage({
			enable_cache: true,
			layout: UNSUPPORTED_LAYOUT,
		});
		const editor = await contributor(browser);
		const guest = await browser.newContext();

		const seenByContributor = await errorShown(editor, url);
		expect(seenByContributor.hidden).toBe(false);
		expect(seenByContributor.text).toContain(UNSUPPORTED_LAYOUT);

		expect(cachedRows(id)).toBe(0);

		const seenByGuest = await errorShown(guest, url);
		expect(seenByGuest.count).toBe(1);
		expect(
			seenByGuest.hidden,
			'the guest was served the contributor error text'
		).toBe(true);
		expect(seenByGuest.text).toBe('');

		expect(cachedRows(id)).toBe(0);

		await editor.close();
		await guest.close();
	}
);
