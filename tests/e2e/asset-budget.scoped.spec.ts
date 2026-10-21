import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, multiGalleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { apiAnonymous, wpCli, wpEval } from './support/roles';

/**
 * What a gallery page loads: the assets a plain grid asks for, two galleries
 * sharing a page, requests on first paint, and the asset version in debug and
 * production.
 *
 * Scoped: every gallery and page here is the spec's own.
 */

/** A grid with every per-gallery extra switched off. */
const PLAIN = {
	layout: 'grid',
	item_click_behavior: 'nothing',
	enable_statistics: false,
	lazy_load: false,
	loaded_effect: 'none',
};

type Assets = { css: string[]; js: string[] };

/** FotoGrids stylesheet and script handles a page links, in document order. */
function assets(markup: string): Assets {
	const handles = (pattern: RegExp) =>
		[...markup.matchAll(pattern)].map((match) => match[1]);

	return {
		css: handles(/<link[^>]+id=['"](fotogrids-[\w-]+)-css['"]/g),
		js: handles(/<script[^>]+id=['"](fotogrids-[\w-]+)-js['"][^>]*\ssrc=/g),
	};
}

async function fetchPage(
	request: APIRequestContext,
	url: string
): Promise<string> {
	const response = await request.get(url);
	expect(response.status()).toBe(200);
	return response.text();
}

test.describe('asset budget', () => {
	/** A plain grid brings the runtime and the grid styles and nothing from a feature it does not use. */
	test(
		'PERF-02: a plain grid loads no asset of a feature it has switched off',
		{ tag: ['@layout', '@critical'] },
		async ({ playwright }) => {
			const guest = await apiAnonymous(playwright);
			const { url } = galleryPage(PLAIN);
			const { css, js } = assets(await fetchPage(guest, url));

			expect(css).toEqual(
				expect.arrayContaining([
					'fotogrids-render-base',
					'fotogrids-layout-grid',
				])
			);
			expect(js).toContain('fotogrids-runtime');

			const unused =
				/^fotogrids-(lightbox|fg-tooltip|sharing|stats|lazy-load|filter-ui|pagination|random-sort|watermark)|^fotogrids-layout-(?!grid$)|^fotogrids-loaded-effect-(?!base$)/;
			expect(
				[...css, ...js].filter((handle) => unused.test(handle))
			).toEqual([]);

			await guest.dispose();
		}
	);

	/** Two galleries on one page link each stylesheet and script once, and publish one loading-icon map. */
	test(
		'PERF-05: two galleries on a page share every asset rather than repeating it',
		{ tag: '@layout' },
		async ({ playwright }) => {
			const guest = await apiAnonymous(playwright);
			const first = galleryPage({ layout: 'grid' });
			const second = galleryPage({
				layout: 'grid',
				caption_alignment: 'center',
			});
			const markup = await fetchPage(
				guest,
				multiGalleryPage([first.id, second.id]).url
			);

			expect(markup).toContain(`data-fg-gallery-id="${first.id}"`);
			expect(markup).toContain(`data-fg-gallery-id="${second.id}"`);

			const sources = [
				...markup.matchAll(
					/<(?:link|script)[^>]+(?:href|src)=['"]([^'"]*\/plugins\/fotogrids\/[^'"]+)['"]/g
				),
			].map((match) => match[1]);
			expect(sources.length).toBeGreaterThan(0);
			expect(
				sources.filter((src, i) => sources.indexOf(src) !== i)
			).toEqual([]);

			const { css, js } = assets(markup);
			expect(css.filter((h, i) => css.indexOf(h) !== i)).toEqual([]);
			expect(js.filter((h, i) => js.indexOf(h) !== i)).toEqual([]);
			expect(
				markup.match(/window\.fotogridsLoadingIcons=/g) ?? []
			).toHaveLength(1);

			await guest.dispose();
		}
	);
});

test.describe('requests', () => {
	/** A static grid asks the REST API for nothing until the visitor acts. */
	test(
		'PERF-06: a static grid makes no REST request on load',
		{ tag: ['@layout', '@api'] },
		async ({ page }) => {
			const { id, url } = galleryPage(PLAIN);
			const rest: string[] = [];
			page.on('request', (request) => {
				if (
					request.url().includes('/wp-json/') ||
					request.url().includes('rest_route=')
				) {
					rest.push(request.url());
				}
			});

			await page.goto(url);
			await new GalleryRender(page, id).waitFor();
			await page.waitForLoadState('networkidle');
			await page.mouse.wheel(0, 400);
			await page.waitForTimeout(500);

			expect(rest).toEqual([]);
		}
	);
});

test.describe('versions', () => {
	/** Debug builds version assets by file time; with WP_DEBUG off the plugin version is used. */
	test(
		'PERF-07: the file-time asset version is a debug-only behaviour',
		{ tag: '@layout' },
		async () => {
			const { id } = galleryPage({ layout: 'grid', enable_cache: false });
			const php = `do_shortcode( '[fotogrids_gallery id="${id}"]' ); echo wp_json_encode( array( 'debug' => WP_DEBUG, 'runtime' => wp_scripts()->registered['fotogrids-runtime']->ver, 'grid' => wp_styles()->registered['fotogrids-layout-grid']->ver, 'version' => FOTOGRIDS_VERSION, 'mtime' => (string) filemtime( FOTOGRIDS_PLUGIN_DIR . 'assets/js/layout-masonry.js' ) ) );`;

			const debug = JSON.parse(wpEval(php));
			expect(debug.debug).toBe(true);
			expect(debug.runtime).toBe(debug.mtime);
			expect(debug.grid).toBe(debug.mtime);

			const dir = mkdtempSync(path.join(tmpdir(), 'fg-nodebug-'));
			const file = path.join(dir, 'nodebug.php');
			writeFileSync(file, "<?php define( 'WP_DEBUG', false );\n");
			try {
				// wp-config's own define then warns on stderr; WordPress keeps the first.
				const production = JSON.parse(
					execFileSync(wpCli(), [`--require=${file}`, 'eval', php], {
						encoding: 'utf8',
						stdio: ['ignore', 'pipe', 'ignore'],
					})
				);
				expect(production.debug).toBe(false);
				expect(production.runtime).toBe(production.version);
				expect(production.grid).toBe(production.version);
				expect(production.runtime).not.toBe(production.mtime);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	);
});
