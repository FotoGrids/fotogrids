import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, setSettings } from './support/collections';
import { fixture } from './support/fixtures';
import { apiAs, wpCli, wpEval } from './support/roles';

/**
 * View pages: what the standalone shell owns, the permalink base and its
 * redirects, plain permalinks, and the integrated and standalone options.
 *
 * Serial: changes the view page settings, the permalink structure and adds a
 * must-use probe plugin; all three are put back afterwards.
 */

test.describe.configure({ mode: 'serial' });
test.use({ storageState: { cookies: [], origins: [] } });

const OPTION = 'fotogrids_view_settings';
const SUFFIX = `${process.pid}${Date.now() % 100000}`;

/** Marks where wp_head, wp_body_open and wp_footer printed, on requests asking for it. */
const PROBE = `<?php
if ( isset( $_GET['fg_probe'] ) ) {
	add_action( 'wp_head', static function () { echo '<meta name="fg-probe-head">'; } );
	add_action( 'wp_body_open', static function () { echo '<i id="fg-probe-body-open"></i>'; } );
	add_action( 'wp_footer', static function () { echo '<i id="fg-probe-footer"></i>'; } );
}
`;

let savedView: string | null = null;
let savedPermalinks = '';
let probeFile = '';

let gallery: { id: number; slug: string };
let draft: { id: number; slug: string };

function wp(args: string[]): string {
	return execFileSync(wpCli(), args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	}).trim();
}

function readOption(): string | null {
	try {
		return execFileSync(
			wpCli(),
			['option', 'get', OPTION, '--format=json'],
			{
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			}
		);
	} catch {
		return null;
	}
}

/** Merge values into the view settings option, as a direct write with no rewrite flush. */
function setView(values: Record<string, unknown>): void {
	const encoded = Buffer.from(JSON.stringify(values)).toString('base64');
	wpEval(
		`$s = get_option( '${OPTION}', array() ); if ( ! is_array( $s ) ) { $s = array(); } update_option( '${OPTION}', array_merge( $s, json_decode( base64_decode( '${encoded}' ), true ) ) );`
	);
}

function resetView(): void {
	wpEval(`delete_option( '${OPTION}' );`);
}

function permalink(id: number): string {
	return wpEval(`echo get_permalink( ${id} );`).trim();
}

function probed(url: string): string {
	return `${url}${url.includes('?') ? '&' : '?'}fg_probe=1`;
}

async function html(request: APIRequestContext, url: string): Promise<string> {
	const response = await request.get(url);
	expect(response.status(), url).toBe(200);
	return response.text();
}

const SITE_BLOCKS = /<div class="wp-site-blocks"/;
const TEMPLATE_PART = /<(header|footer)[^>]*class="[^"]*wp-block-template-part/;

function rendersGallery(markup: string, id: number): boolean {
	return markup.includes(`data-fg-gallery-id="${id}"`);
}

test.beforeAll(() => {
	savedView = readOption();
	savedPermalinks = wp(['option', 'get', 'permalink_structure']);

	const dir = path.join(
		process.env.WP_PATH ?? '',
		'wp-content',
		'mu-plugins'
	);
	mkdirSync(dir, { recursive: true });
	probeFile = path.join(dir, `fg-view-probe-${SUFFIX}.php`);
	writeFileSync(probeFile, PROBE);

	const items = fixture<number[]>('F-small', 'items').slice(0, 3);
	const made = galleryPage(
		{ layout: 'grid' },
		items,
		`View routing ${SUFFIX}`
	);
	gallery = {
		id: made.id,
		slug: wpEval(`echo get_post_field( 'post_name', ${made.id} );`).trim(),
	};
	const hidden = galleryPage(
		{},
		items,
		`View routing draft ${SUFFIX}`,
		undefined,
		'draft'
	);
	draft = {
		id: hidden.id,
		slug: wpEval(
			`echo get_post_field( 'post_name', ${hidden.id} );`
		).trim(),
	};
});

test.afterAll(() => {
	if (probeFile) {
		rmSync(probeFile, { force: true });
	}

	if (null === savedView) {
		resetView();
	} else {
		execFileSync(wpCli(), ['option', 'update', OPTION, '--format=json'], {
			encoding: 'utf8',
			input: savedView,
		});
	}

	wp(['rewrite', 'structure', savedPermalinks]);
	wp(['rewrite', 'flush']);
});

test.afterEach(() => {
	resetView();
});

test.describe('standalone shell', () => {
	/** The plugin prints the whole document: its own doctype and body, with wp_head and wp_footer run inside it. */
	test(
		'VIEW-02: standalone mode owns the document and still runs wp_head and wp_footer',
		{ tag: '@layout' },
		async ({ request }) => {
			setView({ layout_mode: 'standalone' });
			const markup = await html(request, probed(permalink(gallery.id)));

			expect(markup.trimStart().slice(0, 15).toLowerCase()).toBe(
				'<!doctype html>'
			);
			expect(markup).toMatch(
				/<body id="fotogrids-view" class="[^"]*fotogrids-view--gallery/
			);
			expect(markup).toContain('<meta name="fg-probe-head">');
			expect(markup.indexOf('<meta name="fg-probe-head">')).toBeLessThan(
				markup.indexOf('</head>')
			);

			const footer = markup.indexOf('<i id="fg-probe-footer"></i>');
			expect(footer).toBeGreaterThan(
				markup.indexOf('<main class="fotogrids-view__body">')
			);
			expect(footer).toBeLessThan(markup.indexOf('</body>'));
			expect(rendersGallery(markup, gallery.id)).toBe(true);
		}
	);

	/** Nothing a theme or plugin hangs on wp_body_open or a block template part reaches the standalone page. */
	test(
		'VIEW-03: standalone mode never runs wp_body_open or the theme template parts',
		{ tag: '@layout' },
		async ({ request }) => {
			const url = probed(permalink(gallery.id));

			const integrated = await html(request, url);
			expect(integrated).toContain('<i id="fg-probe-body-open"></i>');
			expect(integrated).toMatch(SITE_BLOCKS);
			expect(integrated).toMatch(TEMPLATE_PART);

			setView({ layout_mode: 'standalone' });
			const standalone = await html(request, url);

			expect(standalone).not.toContain('fg-probe-body-open');
			expect(standalone).not.toMatch(SITE_BLOCKS);
			expect(standalone).not.toMatch(TEMPLATE_PART);
			expect(rendersGallery(standalone, gallery.id)).toBe(true);
		}
	);

	/** Each standalone appearance setting changes the page it describes. */
	test(
		'VIEW-09: accent colour, dark theme, header and footer reach the standalone page',
		{ tag: '@layout' },
		async ({ page }) => {
			const url = permalink(gallery.id);
			setView({ layout_mode: 'standalone' });
			await page.goto(url);
			const body = page.locator('body#fotogrids-view');
			await expect(body).toHaveClass(/fotogrids-view--theme-light/);
			await expect(
				page.locator('header.fotogrids-view__header')
			).toHaveCount(1);
			await expect(
				page.locator('footer.fotogrids-view__footer')
			).toHaveCount(1);

			setView({
				layout_mode: 'standalone',
				accent_color: '#a1b2c3',
				theme: 'dark',
				show_header: false,
				show_footer: false,
			});
			await page.goto(url);

			await expect(body).toHaveClass(/fotogrids-view--theme-dark/);
			await expect(body).not.toHaveClass(/fotogrids-view--theme-light/);
			expect(
				await body.evaluate((el) =>
					getComputedStyle(el)
						.getPropertyValue('--fg-view-accent')
						.trim()
				)
			).toBe('#a1b2c3');
			await expect(
				page.locator('header.fotogrids-view__header')
			).toHaveCount(0);
			await expect(
				page.locator('footer.fotogrids-view__footer')
			).toHaveCount(0);
			await expect(
				page.locator(`[data-fg-gallery-id="${gallery.id}"]`)
			).toBeVisible();
		}
	);

	/** A collection's own view page width caps the standalone content area. */
	test(
		'VIEW-10: a per-collection max width reaches the standalone page',
		{ tag: '@layout' },
		async ({ page }) => {
			const made = galleryPage({
				view_page_override_defaults: true,
				view_page_max_width: {
					desktop: { value: 640, unit: 'px' },
					tablet: { value: 640, unit: 'px' },
					mobile: { value: 640, unit: 'px' },
				},
			});
			setView({ layout_mode: 'standalone' });
			await page.setViewportSize({ width: 1400, height: 900 });
			await page.goto(permalink(made.id));

			expect(
				await page
					.locator('main.fotogrids-view__body')
					.evaluate((el) => getComputedStyle(el).maxWidth)
			).toBe('640px');

			setSettings(made.id, { view_page_override_defaults: false });
			await page.goto(permalink(made.id));
			expect(
				await page
					.locator('main.fotogrids-view__body')
					.evaluate((el) => getComputedStyle(el).maxWidth)
			).not.toBe('640px');
		}
	);
});

test.describe('permalink base', () => {
	/** The default base serves the gallery, and a new base resolves on its first request, with no Permalinks visit. */
	test(
		'VIEW-04: a changed base resolves without flushing the rewrite rules by hand',
		{ tag: '@layout' },
		async ({ request }) => {
			const original = permalink(gallery.id);
			expect(new URL(original).pathname).toBe(
				`/fotogrids/gallery/${gallery.slug}/`
			);
			expect(
				rendersGallery(await html(request, original), gallery.id)
			).toBe(true);

			const prefix = `fg-routing-${SUFFIX}`;
			setView({ base_prefix: prefix, base_gallery_segment: 'shots' });
			const moved = permalink(gallery.id);
			expect(new URL(moved).pathname).toBe(
				`/${prefix}/shots/${gallery.slug}/`
			);
			expect(rendersGallery(await html(request, moved), gallery.id)).toBe(
				true
			);

			resetView();
			expect(
				rendersGallery(await html(request, original), gallery.id)
			).toBe(true);
		}
	);

	/** A link made under the default base still reaches the gallery after the base moves. */
	test(
		'VIEW-07: the default base redirects to the new address, by slug and by ID',
		{ tag: '@layout' },
		async ({ request }) => {
			const prefix = `fg-moved-${SUFFIX}`;
			setView({ base_prefix: prefix });
			const target = permalink(gallery.id);
			// Prime the rewrite flush before reading redirects.
			await html(request, target);

			for (const old of [
				`/fotogrids/gallery/${gallery.slug}/`,
				`/fotogrids/gallery/${gallery.id}/`,
			]) {
				const response = await request.get(old, { maxRedirects: 0 });
				expect(response.status(), old).toBe(301);
				expect(response.headers().location, old).toBe(target);
			}

			const hidden = await request.get(
				`/fotogrids/gallery/${draft.slug}/`,
				{ maxRedirects: 0 }
			);
			expect(hidden.status()).toBe(404);
		}
	);

	/** A base that starts at a root WordPress or existing content owns is refused, and nothing is saved. */
	test(
		'VIEW-05: a base colliding with a reserved root or existing content is a 400',
		{ tag: ['@api', '@settings'] },
		async ({ playwright }) => {
			const { context, nonce } = await apiAs(playwright, 'administrator');
			const before = readOption();
			const post = wpEval(
				`echo get_post_field( 'post_name', wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'View base clash ${SUFFIX}', 'meta_input' => array( '_fg_scoped' => 1 ) ) ) );`
			).trim();

			const save = (data: Record<string, string>) =>
				context.post('/wp-json/fotogrids/v1/admin/view-settings', {
					headers: { 'X-WP-Nonce': nonce },
					data,
				});

			for (const data of [
				{ base_prefix: 'wp-json' },
				{ base_prefix: 'feed' },
				{ base_prefix: '', base_gallery_segment: 'author' },
				{ base_prefix: 'wp-admin', base_album_segment: 'sets' },
				{ base_prefix: post, base_gallery_segment: '' },
			]) {
				const response = await save(data);
				expect(response.status(), JSON.stringify(data)).toBe(400);
				expect((await response.json()).code).toBe(
					'fotogrids_base_conflict'
				);
			}
			expect(readOption()).toBe(before);

			const free = await save({ base_prefix: `fg-free-${SUFFIX}` });
			expect(free.status()).toBe(200);
			expect((await free.json()).settings.base_prefix).toBe(
				`fg-free-${SUFFIX}`
			);

			await context.dispose();
		}
	);
});

test.describe('plain permalinks', () => {
	test.beforeAll(() => {
		wp(['rewrite', 'structure', '']);
	});

	test.afterAll(() => {
		wp(['rewrite', 'structure', savedPermalinks]);
		wp(['rewrite', 'flush']);
	});

	/** With plain permalinks the view page is a query-string URL, and both modes serve the gallery there and at ?p=. */
	test(
		'VIEW-06: plain permalinks serve the view page in both modes',
		{ tag: '@layout' },
		async ({ request }) => {
			const url = permalink(gallery.id);
			expect(url).toContain(`?fotogrids_gallery=${gallery.slug}`);

			for (const mode of ['integrated', 'standalone']) {
				setView({ layout_mode: mode });
				const markup = await html(request, url);
				expect(rendersGallery(markup, gallery.id), mode).toBe(true);
				expect(markup.includes('id="fotogrids-view"'), mode).toBe(
					'standalone' === mode
				);

				const byId = await html(request, `/?p=${gallery.id}`);
				expect(rendersGallery(byId, gallery.id), `${mode} ?p=`).toBe(
					true
				);
			}
		}
	);
});

test.describe('integrated options', () => {
	/** The title block toggle adds or removes the plugin's own title strip above the gallery. */
	test(
		'VIEW-08: the title block toggle shows the title strip',
		{ tag: '@layout' },
		async ({ request }) => {
			const url = permalink(gallery.id);
			expect(await html(request, url)).not.toContain(
				'fotogrids-view__title-block'
			);

			setView({ integrated_show_title_block: true });
			const shown = await html(request, url);
			expect(shown).toMatch(/class="fotogrids-view__title-block[^"]*"/);
			expect(rendersGallery(shown, gallery.id)).toBe(true);
		}
	);

	/** A featured image the theme would print is held back unless the setting lets it through. */
	test(
		'VIEW-08: the featured image is hidden by default and shown when allowed',
		{ tag: '@layout' },
		async ({ request }) => {
			const made = galleryPage();
			const image = fixture<number[]>('F-small', 'items')[0];
			wpEval(`set_post_thumbnail( ${made.id}, ${image} );`);
			const url = permalink(made.id);

			expect(await html(request, url)).not.toContain('wp-post-image');
			setView({ integrated_hide_featured_image: false });
			expect(await html(request, url)).toContain('wp-post-image');
		}
	);

	/** Comments stay closed on view pages until the setting opens them. */
	test(
		'VIEW-08: the comments toggle opens the comment form',
		{ tag: '@layout' },
		async ({ request }) => {
			const made = galleryPage();
			wpEval(
				`wp_update_post( array( 'ID' => ${made.id}, 'comment_status' => 'open' ) );`
			);
			const url = permalink(made.id);

			expect(await html(request, url)).not.toContain('id="respond"');
			setView({ integrated_allow_comments: true });
			expect(await html(request, url)).toContain('id="respond"');
		}
	);

	/** Previous/next links are suppressed by default and, when on, lead only to other galleries. */
	test(
		'VIEW-08: post navigation is off by default and stays within galleries when on',
		{ tag: '@layout' },
		async ({ request }) => {
			const first = galleryPage({}, undefined, `Nav first ${SUFFIX}`);
			const second = galleryPage({}, undefined, `Nav second ${SUFFIX}`);
			const url = permalink(second.id);
			const links = (markup: string) =>
				[
					...markup.matchAll(
						/<div class="[^"]*wp-block-post-navigation-link[^"]*">[\s\S]*?<\/div>/g
					),
				]
					.map((block) => (block[0].match(/href="([^"]+)"/) ?? [])[1])
					.filter(Boolean);

			expect(links(await html(request, url))).toEqual([]);

			setView({ integrated_post_navigation: true });
			const shown = links(await html(request, url));
			expect(shown).toContain(permalink(first.id));
			for (const href of shown) {
				expect(href).toMatch(/\/fotogrids\/gallery\//);
			}
		}
	);
});
