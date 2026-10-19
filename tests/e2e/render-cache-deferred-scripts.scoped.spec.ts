import type { Browser, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage, passwordGalleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';

/**
 * Galleries served from the render cache on a site that defers JavaScript.
 *
 * Performance plugins add `defer` to script tags, so every module runs after
 * parsing, in document order. A cache hit has to print the scripts in
 * dependency order, as the miss does, or a layout runs before the runtime.
 *
 * Galleries an unlock or an album click renders into a deferred page inject
 * their scripts from the REST response, so they are covered here too.
 *
 * Scoped: every gallery and album here is created by the spec.
 */

const MASONRY = {
	layout: 'masonry',
	enable_cache: true,
	enable_statistics: false,
};
const PASSWORD = 'deferred-secret';

/** Render cache rows held for a gallery. */
function cachedRows(galleryId: number): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${galleryId} ) );`
		).trim()
	);
}

/** Adds `defer` to every external FotoGrids script tag in the page HTML. */
async function deferPluginScripts(page: Page): Promise<void> {
	await page.route('**/*', async (route) => {
		if ('document' !== route.request().resourceType()) {
			await route.continue();
			return;
		}

		const response = await route.fetch();
		const body = (await response.text()).replace(
			/<script(?![^>]*\bdefer\b)([^>]*\bsrc=(["'])[^"']*\/plugins\/fotogrids\/[^"']*\2)/g,
			'<script defer$1'
		);
		await route.fulfill({ response, body });
	});
}

type Visit = { scripts: string[]; errors: string[] };

/** A logged-out page with deferred FotoGrids scripts, and the errors it throws. */
async function deferredPage(
	browser: Browser,
	url: string
): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
	const guest = await browser.newContext({
		storageState: { cookies: [], origins: [] },
	});
	const page = await guest.newPage();
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await deferPluginScripts(page);
	await page.goto(url);
	await page.waitForLoadState('load');

	return { page, errors, close: () => guest.close() };
}

/**
 * One logged-out page view with deferred scripts, after which the masonry
 * layout must have positioned the gallery.
 */
async function deferredVisit(
	browser: Browser,
	url: string,
	galleryId: number,
	label: string
): Promise<Visit> {
	const guest = await browser.newContext({
		storageState: { cookies: [], origins: [] },
	});
	const page = await guest.newPage();
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await deferPluginScripts(page);

	await page.goto(url);
	const gallery = new GalleryRender(page, galleryId);
	await expect(gallery.root).toBeAttached();
	await expect
		.poll(() => gallery.attr('masonry-positioned'), {
			message: `masonry positioned on the ${label}`,
		})
		.toBe('1');

	const visit: Visit = {
		scripts: await page
			.locator('script[src*="/plugins/fotogrids/"]')
			.evaluateAll((nodes) =>
				nodes.map((node) => (node as HTMLScriptElement).id)
			),
		errors,
	};

	await guest.close();
	return visit;
}

test(
	'a cached masonry gallery is laid out when scripts are deferred',
	{ tag: ['@cache', '@layout'] },
	async ({ browser }) => {
		const gallery = galleryPage(MASONRY);

		const miss = await deferredVisit(
			browser,
			gallery.url,
			gallery.id,
			'miss'
		);
		expect(
			cachedRows(gallery.id),
			'the first visit did not cache the gallery'
		).toBe(1);
		const hit = await deferredVisit(
			browser,
			gallery.url,
			gallery.id,
			'hit'
		);

		expect(miss.errors, 'the miss threw').toEqual([]);
		expect(hit.errors, 'the hit threw').toEqual([]);

		const runtime = hit.scripts.indexOf('fotogrids-runtime-js');
		const masonry = hit.scripts.indexOf('fotogrids-layout-masonry-js');
		expect(
			runtime,
			'the runtime script is on the hit page'
		).toBeGreaterThanOrEqual(0);
		expect(
			masonry,
			'the masonry script is on the hit page'
		).toBeGreaterThan(runtime);
		expect(
			hit.scripts,
			'the hit prints the same scripts in the same order as the miss'
		).toEqual(miss.scripts);
	}
);

test(
	'a masonry gallery unlocked on a deferred page is laid out',
	{ tag: ['@gate', '@layout'] },
	async ({ browser }) => {
		const gallery = passwordGalleryPage(PASSWORD, {
			...MASONRY,
			password_remember: false,
		});
		const { page, errors, close } = await deferredPage(
			browser,
			gallery.url
		);

		const form = page.locator('.fg-lock-form');
		await form.locator('.fg-lock-input').fill(PASSWORD);
		await form.locator('.fg-lock-submit').click();

		const unlocked = new GalleryRender(page, gallery.id);
		await expect(unlocked.items().first()).toBeVisible({ timeout: 15000 });
		await expect
			.poll(() => unlocked.attr('masonry-positioned'), {
				message: 'masonry positioned after the unlock',
			})
			.toBe('1');
		expect(errors, 'the page threw').toEqual([]);

		await close();
	}
);

test(
	'a masonry gallery opened from an album on a deferred page is laid out',
	{ tag: ['@layout'] },
	async ({ browser }) => {
		const gallery = galleryPage({
			layout: 'masonry',
			enable_statistics: false,
		});
		const { id: albumId, url } = album([gallery.id], {
			use_ajax_from_album: true,
		});
		const { page, errors, close } = await deferredPage(browser, url);

		await page
			.locator(
				`.fotogrids-album[data-fg-album-id="${albumId}"] [data-fg-album-ajax-trigger][data-fg-gallery-id="${gallery.id}"]`
			)
			.click();

		const opened = page.locator(
			`.fotogrids-album .fotogrids-gallery[data-fg-gallery-id="${gallery.id}"]`
		);
		await expect(opened.locator('.fg-item').first()).toBeVisible({
			timeout: 15000,
		});
		await expect
			.poll(() => opened.getAttribute('data-fg-masonry-positioned'), {
				message: 'masonry positioned after the album click',
			})
			.toBe('1');
		expect(errors, 'the page threw').toEqual([]);

		await close();
	}
);
