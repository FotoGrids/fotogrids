import { execFileSync } from 'child_process';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { SettingsPage } from './support/settings-page';
import { storageStateFor, wpCli, wpEval } from './support/roles';

/**
 * The plugin settings screens: what their controls store, what the SaveBar
 * reports, and where the stored values show up.
 *
 * Serial: every test writes site-wide options. Each one is put back.
 */

test.describe.configure({ mode: 'serial' });
test.use({ storageState: storageStateFor('administrator') });

const OPTIONS = [
	'fotogrids_seo_settings',
	'fotogrids_media_settings',
	'fotogrids_view_settings',
	'fotogrids_allow_news_updates',
	'permalink_structure',
] as const;

let saved: Record<string, string | null> = {};

function wp(args: string[], input?: string): string {
	return execFileSync(wpCli(), args, {
		encoding: 'utf8',
		input,
		stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
	}).trim();
}

/** An option as JSON, or null when the row does not exist. */
function snapshot(name: string): string | null {
	try {
		return wp(['option', 'get', name, '--format=json']);
	} catch {
		return null;
	}
}

function restore(name: string, json: string | null): void {
	if (null === json) {
		if (null !== snapshot(name)) {
			wp(['option', 'delete', name]);
		}
		return;
	}
	wp(['option', 'update', name, '--format=json'], json);
}

/** One key of an array option, as stored. */
function stored(name: string, key: string): unknown {
	return JSON.parse(
		wpEval(
			`$v = get_option( '${name}', array() ); echo wp_json_encode( is_array( $v ) && array_key_exists( '${key}', $v ) ? $v['${key}'] : null );`
		)
	);
}

function setSeo(values: Record<string, unknown>): void {
	wpEval(
		`\\FotoGrids\\Settings\\SEO_Settings_Store::save( array_merge( \\FotoGrids\\Settings\\SEO_Settings_Store::get(), json_decode( '${JSON.stringify(values)}', true ) ) );`
	);
}

test.beforeAll(() => {
	saved = Object.fromEntries(OPTIONS.map((name) => [name, snapshot(name)]));
});

test.afterAll(() => {
	for (const name of OPTIONS) {
		restore(name, saved[name]);
	}
	wp(['rewrite', 'flush']);
});

/** Open a tab and wait for its stored values to arrive over REST. */
async function openTab(
	page: Page,
	tab: Parameters<SettingsPage['open']>[0],
	rest: string
): Promise<SettingsPage> {
	const settings = new SettingsPage(page);
	const read = settings.read(rest);
	await settings.open(tab);
	await read;
	return settings;
}

/** Wait for a tab's write, whether autosave sent it or Save did. */
async function commit(
	page: Page,
	settings: SettingsPage,
	rest: string
): Promise<void> {
	const write = settings.write(rest);
	const save = settings.saveButton();
	if (await save.isEnabled()) {
		await save.click();
	}
	expect((await write).ok()).toBe(true);
	await expect(settings.saveMessage()).toHaveText(/All changes saved/);
}

function rowSwitch(page: Page, title: string) {
	return page
		.locator('.fotogrids-sidebar-layout__panel__row')
		.filter({ hasText: title })
		.getByRole('switch')
		.first();
}

/** The head of a view page, and where each tag sits in it. */
async function head(request: APIRequestContext, url: string): Promise<string> {
	const response = await request.get(url);
	expect(response.ok()).toBe(true);
	return (await response.text()).split('</head>')[0];
}

function viewUrl(id: number): string {
	return wpEval(`echo get_permalink( ${id} );`).trim();
}

const SEO_REST = '/fotogrids/v1/admin/seo-settings';

test.describe('refused saves', () => {
	test.use({
		allowConsoleErrors: 'the browser logs the refused save response',
	});

	/** A failed save says so and stays said, with no retry, until the next edit. */
	test(
		'PSET-01: a failed save keeps reporting the failure and does not retry',
		{ tag: ['@settings', '@admin'] },
		async ({ page }) => {
			const settings = await openTab(page, 'seo', SEO_REST);
			const handle = page.locator('#fg-seo-twitter-handle');

			let refused = 0;
			await page.route('**/*seo-settings*', async (route) => {
				if ('POST' !== route.request().method()) {
					return route.continue();
				}
				refused++;
				return route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({
						code: 'e2e_refused',
						message: 'Refused by the test',
					}),
				});
			});

			await handle.fill('@fgfail');
			await settings.saveButton().click();
			await expect(settings.saveMessage()).toHaveText('Save failed');

			// Past the 3s a successful save clears in, and past an autosave debounce.
			await page.waitForTimeout(4500);
			await expect(settings.saveMessage()).toHaveText('Save failed');
			expect(refused, 'the failed save was retried on its own').toBe(1);

			await page.unroute('**/*seo-settings*');
			await handle.fill('@fgsaved');
			await expect(settings.saveMessage()).toHaveText('Unsaved changes');
			await commit(page, settings, SEO_REST);
			expect(stored('fotogrids_seo_settings', 'twitter_handle')).toBe(
				'@fgsaved'
			);
		}
	);
});

/** A gallery editor leaves out the SEO tab while the site defers to an SEO plugin. */
test(
	'SET-09: the collection SEO tab follows Defer to other SEO plugins',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = new CollectionSettings(page);
		const labels = async () => {
			await page.goto(`/wp-admin/post.php?post=${id}&action=edit`);
			await expect(
				page.locator('.fotogrids-settings-tab__label').first()
			).toBeVisible({ timeout: 20000 });
			return panel.tabLabels();
		};

		setSeo({ defer_to_seo_plugins: true });
		const deferring = await labels();
		expect(deferring).toContain('Sharing');
		expect(deferring).not.toContain('SEO');

		setSeo({ defer_to_seo_plugins: false });
		expect(await labels()).toContain('SEO');
	}
);

/** The SEO tab's switches and handle decide the view page's OG and Twitter tags, printed ahead of the stylesheets. */
test(
	'PSET-17: the SEO tab drives the Open Graph and Twitter tags on a view page',
	{ tag: ['@settings', '@admin'] },
	async ({ page, request }, testInfo) => {
		testInfo.setTimeout(90_000);
		setSeo({
			enable_open_graph: true,
			enable_twitter_card: true,
			defer_to_seo_plugins: false,
			twitter_handle: '',
		});
		const title = `SEO head ${Date.now()}`;
		const { id } = galleryPage({}, undefined, title);
		const url = viewUrl(id);

		const before = await head(request, url);
		expect(before).toContain(
			`<meta property="og:title" content="${title}">`
		);
		expect(before).toContain('<meta property="og:type" content="article">');
		expect(before).toMatch(/<meta property="og:image" content="[^"]+">/);
		expect(before).toContain(
			'<meta name="twitter:card" content="summary_large_image">'
		);
		expect(before).toContain(
			`<meta name="twitter:title" content="${title}">`
		);
		expect(before).not.toContain('twitter:site');

		// Printed early in wp_head, ahead of the stylesheets at priority 8.
		const firstStylesheet = before.search(
			/<link[^>]+rel=['"]stylesheet['"]/
		);
		expect(firstStylesheet).toBeGreaterThan(-1);
		expect(before.indexOf('og:title')).toBeLessThan(firstStylesheet);

		const settings = await openTab(page, 'seo', SEO_REST);
		await page.locator('#fg-seo-twitter-handle').fill('fgsite');
		await page.getByRole('radio', { name: 'Website' }).click();
		await commit(page, settings, SEO_REST);

		const handled = await head(request, url);
		expect(handled).toContain(
			'<meta name="twitter:site" content="@fgsite">'
		);
		expect(handled).toContain(
			'<meta property="og:type" content="website">'
		);

		await rowSwitch(page, 'Enable Twitter / X cards').click();
		await commit(page, settings, SEO_REST);

		const noTwitter = await head(request, url);
		expect(noTwitter).toContain(
			`<meta property="og:title" content="${title}">`
		);
		expect(noTwitter).not.toContain('twitter:');

		await rowSwitch(page, 'Enable Open Graph tags').click();
		await commit(page, settings, SEO_REST);

		const none = await head(request, url);
		expect(none).not.toContain('og:title');
		expect(none).not.toContain('twitter:');
	}
);

const MEDIA_REST = '/fotogrids/v1/admin/media-settings';

/** The Media tab's thumbnail fields survive a reload, and the companion help follows the width. */
test(
	'PSET-07: thumbnail size, crop alignment and the mobile companion hint',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		const settings = await openTab(page, 'media', MEDIA_REST);
		const companion = page
			.locator('.fotogrids-sidebar-layout__panel__row')
			.filter({ hasText: 'Mobile companion:' });

		await page.locator('#fg-full-width').fill('1501');
		await expect(companion).toContainText('Mobile companion: 750 px');
		await page.locator('#fg-full-width').fill('640');
		await expect(companion).toContainText('Mobile companion: 320 px');

		await page.locator('#fg-thumb-width').fill('432');
		await page.locator('#fg-thumb-height').fill('321');
		await page.getByRole('radio', { name: 'Hard crop' }).click();
		await page.locator('#fotogrids-thumbnail-alignment').click();
		await page
			.locator('.fotogrids-select__option')
			.filter({ hasText: /^Bottom Right$/ })
			.click();
		await commit(page, settings, MEDIA_REST);

		expect(stored('fotogrids_media_settings', 'thumbnail_width')).toBe(432);
		expect(stored('fotogrids_media_settings', 'thumbnail_height')).toBe(
			321
		);
		expect(stored('fotogrids_media_settings', 'thumbnail_alignment')).toBe(
			'bottom-right'
		);
		expect(stored('fotogrids_media_settings', 'full_width')).toBe(640);

		await openTab(page, 'media', MEDIA_REST);
		await expect(page.locator('#fg-thumb-width')).toHaveValue('432');
		await expect(page.locator('#fg-thumb-height')).toHaveValue('321');
		await expect(
			page.locator('#fotogrids-thumbnail-alignment')
		).toContainText('Bottom Right');
		await expect(page.locator('#fg-full-width')).toHaveValue('640');
		await expect(companion).toContainText('Mobile companion: 320 px');

		// Soft crop has no alignment to choose.
		await page.getByRole('radio', { name: 'Soft crop' }).click();
		await expect(
			page.locator('#fotogrids-thumbnail-alignment')
		).toHaveCount(0);
	}
);

/** With news turned off, the dashboard widget drops its news and What's New says why. */
test(
	'PSET-11: turning news off empties What’s New and hides the widget news',
	{ tag: ['@settings', '@admin'] },
	async ({ page }, testInfo) => {
		testInfo.setTimeout(90_000);
		const settings = new SettingsPage(page);
		const panel = page.locator('.fg-whats-new');
		const widgetNews = page.locator(
			'#fotogrids_overview .fotogrids-dw-news'
		);

		const whatsNew = async () => {
			await page.goto(
				'/wp-admin/admin.php?page=fotogrids-settings&tab=advanced'
			);
			const news = page.waitForResponse((r) =>
				decodeURIComponent(r.url()).includes('/admin/news')
			);
			await page.locator('.fotogrids-link-whats-new').click();
			await news;
			await expect(panel).toBeVisible();
			await expect(panel.getByText('Loading…')).toHaveCount(0, {
				timeout: 20000,
			});
		};

		const dashboardNews = async () => {
			const news = page.waitForResponse(
				(r) => decodeURIComponent(r.url()).includes('/admin/news'),
				{ timeout: 20000 }
			);
			await page.goto('/wp-admin/index.php');
			await news;
		};

		await settings.openAdvanced();
		await settings.setToggle('allow_news_updates', false);
		expect(
			wpEval(
				"echo wp_json_encode( (bool) get_option( 'fotogrids_allow_news_updates', true ) );"
			)
		).toBe('false');

		await whatsNew();
		await expect(panel).toContainText(
			'News is turned off in FotoGrids Settings > Advanced.'
		);
		await expect(panel.locator('.fg-whats-new__item')).toHaveCount(0);

		await dashboardNews();
		await expect(widgetNews).toBeHidden();

		await settings.openAdvanced();
		await settings.setToggle('allow_news_updates', true);

		await whatsNew();
		await expect(panel).not.toContainText('News is turned off');

		await dashboardNews();
		await expect(widgetNews).toBeVisible();
	}
);

const VIEW_REST = '/fotogrids/v1/admin/view-settings';

test.describe('View Pages address', () => {
	test.use({
		allowConsoleErrors: 'the browser logs the refused save response',
	});

	/** The address fields preview the URL as typed, warn about shared and top-level bases, and refuse a taken one. */
	test(
		'PSET-19: View Pages previews, warns about and validates the address',
		{ tag: ['@settings', '@admin'] },
		async ({ page }) => {
			const settings = await openTab(page, 'view_pages', VIEW_REST);
			const home = wpEval('echo untrailingslashit( home_url() );').trim();
			const prefix = page.locator('#fg-view-base-prefix');
			const gallery = page.locator('#fg-view-base-gallery');
			const album = page.locator('#fg-view-base-album');
			const preview = (field: typeof gallery) =>
				page
					.locator('.fotogrids-sidebar-layout__panel__row')
					.filter({ has: field })
					.locator('.fotogrids-field-help');
			const shared = page.getByText(
				'Galleries and albums share one address'
			);
			const topLevel = page.getByText(
				'These pages sit at the top level of your site'
			);

			await prefix.fill('photos');
			await gallery.fill('sets');
			await expect(preview(gallery)).toHaveText(
				`${home}/photos/sets/gallery-name/`
			);
			await expect(preview(album)).toHaveText(
				`${home}/photos/album/album-name/`
			);
			await expect(shared).toHaveCount(0);
			await expect(topLevel).toHaveCount(0);

			await album.fill('sets');
			await expect(shared).toBeVisible();

			await album.fill('albums');
			await prefix.fill('');
			await gallery.fill('');
			await expect(preview(gallery)).toHaveText(`${home}/gallery-name/`);
			await expect(topLevel).toBeVisible();

			// A base WordPress already owns is refused, and nothing is stored.
			await prefix.fill('wp-json');
			await gallery.fill('gallery');
			await album.fill('album');
			const write = settings.write(VIEW_REST);
			const save = settings.saveButton();
			if (await save.isEnabled()) {
				await save.click();
			}
			expect((await write).status()).toBe(400);
			await expect(
				page
					.getByRole('alert')
					.filter({ hasText: 'That address could not be saved' })
			).toContainText(
				'/wp-json/gallery/ is already used by WordPress itself'
			);
			expect(stored('fotogrids_view_settings', 'base_prefix')).not.toBe(
				'wp-json'
			);
		}
	);
});

/** With plain permalinks, the preview shows the query address and the base fields are flagged as inert. */
test(
	'PSET-19: plain permalinks switch the preview to a query address',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		wp(['option', 'update', 'permalink_structure', '']);
		await openTab(page, 'view_pages', VIEW_REST);
		const home = wpEval('echo untrailingslashit( home_url() );').trim();
		const gallery = page.locator('#fg-view-base-gallery');

		await expect(page.getByText('Plain permalinks are on')).toBeVisible();
		await expect(
			page
				.locator('.fotogrids-sidebar-layout__panel__row')
				.filter({ has: gallery })
				.locator('.fotogrids-field-help')
		).toHaveText(`${home}/?fotogrids_gallery=gallery-name`);

		// Clearing the bases warns about nothing, since they are not used.
		await page.locator('#fg-view-base-prefix').fill('');
		await gallery.fill('');
		await expect(
			page.getByText('These pages sit at the top level of your site')
		).toHaveCount(0);
	}
);
