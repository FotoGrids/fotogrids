import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'fs';
import path from 'path';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { apiAs, storageStateFor, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The Templates page, the Templates metabox and the template routes, against
 * the templates bundled with the plugin.
 *
 * The remote catalog is pointed at a closed port for the run, so the page
 * shows the built-in set whatever the network allows.
 *
 * Serial: an mu-plugin, the catalog cache and user meta are changed, and all
 * of them put back.
 */

test.describe.configure({ mode: 'serial' });

const SCREEN = '/wp-admin/admin.php?page=fotogrids-templates';
const MU_PLUGIN = path.join(
	process.env.WP_PATH ?? '',
	'wp-content',
	'mu-plugins',
	'fg-e2e-templates-offline.php'
);
const TITLE = `Template target ${process.pid}`;

type Bundled = {
	id: string;
	name: string;
	order: number;
	settings: Record<string, unknown>;
};

/** The bundled set, in the order the page lists it: by `order`, then name. */
function bundled(category: 'gallery' | 'album'): Bundled[] {
	const dir = path.resolve('src/includes/rest/templates/templates', category);
	return readdirSync(dir)
		.filter((file) => file.endsWith('.json'))
		.map(
			(file) =>
				JSON.parse(
					readFileSync(path.join(dir, file), 'utf8')
				) as Bundled
		)
		.sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : 1));
}

function template(id: string): Bundled {
	const found = bundled('gallery').find((t) => t.id === id);
	if (!found) {
		throw new Error(`No bundled gallery template ${id}`);
	}
	return found;
}

function route(p: string): string {
	return `/index.php?rest_route=${encodeURIComponent(p)}`;
}

function storedLayout(id: number): string {
	return wpEval(
		`echo get_post_meta( ${id}, 'fotogrids_layout', true );`
	).trim();
}

test.beforeAll(() => {
	mkdirSync(path.dirname(MU_PLUGIN), { recursive: true });
	writeFileSync(
		MU_PLUGIN,
		`<?php
add_filter( 'fotogrids/templates/catalog_url', function () { return 'http://127.0.0.1:9/catalog'; } );
add_filter( 'pre_option_fotogrids_remote_catalog_meta', function () { return array(); } );
`
	);
	wpEval(`delete_transient( 'fotogrids_remote_catalog' );`);
});

test.afterAll(() => {
	rmSync(MU_PLUGIN, { force: true });
	wpEval(`delete_transient( 'fotogrids_remote_catalog' );`);
});

function cards(page: Page) {
	return page.locator('.fotogrids-template-card');
}

function card(page: Page, name: string) {
	return cards(page).filter({
		has: page.locator('h3', { hasText: new RegExp(`^${name}$`) }),
	});
}

async function openPage(page: Page, query = ''): Promise<void> {
	await page.goto(SCREEN + query);
	await expect(cards(page).first()).toBeVisible({ timeout: 20000 });
}

/**
 * TPL-01. Offline, the page lists every bundled gallery template in catalog
 * order, says it is showing the built-in set and marks none of them Pro. Your
 * Templates is a Pro feature and stays unavailable, so FotoGrids Templates,
 * the only list left, cannot be switched off.
 */
test(
	'TPL-01: the Templates page lists the bundled gallery templates and keeps one list on',
	{ tag: '@admin' },
	async ({ page }) => {
		await openPage(page);

		await expect(
			page.locator('.fotogrids-templates-page__library-bar__updated')
		).toHaveText('Showing built-in templates');
		expect(await cards(page).locator('h3').allInnerTexts()).toEqual(
			bundled('gallery').map((t) => t.name)
		);
		await expect(cards(page).locator('.fotogrids-pro-badge')).toHaveCount(
			0
		);
		await expect(
			cards(page).getByRole('button', { name: 'Apply' })
		).toHaveCount(bundled('gallery').length);

		const types = page.locator('.fotogrids-templates-page__types');
		await expect(
			types.getByRole('checkbox', { name: 'Your Templates' })
		).toBeDisabled();
		// The last list shown cannot be switched off.
		const fotogrids = types.getByRole('checkbox', {
			name: 'FotoGrids Templates',
		});
		await fotogrids.click();
		await expect(fotogrids).toBeChecked();
		await expect(cards(page)).toHaveCount(bundled('gallery').length);
	}
);

/**
 * TPL-05. The local preview is a document of its own: the template's title,
 * the gallery in the template's layout styled by that layout's stylesheet and
 * started by its scripts, and nothing from the theme's head or footer.
 */
test(
	'TPL-05: a template preview renders the template on its own page',
	{ tag: '@admin' },
	async ({ page }) => {
		const masonry = template('clean-masonry');
		await openPage(page);

		const preview = page.waitForResponse((r) =>
			decodeURIComponent(r.url()).includes('/templates/preview')
		);
		await card(page, masonry.name)
			.getByRole('button', { name: 'Preview' })
			.click();
		const response = await preview;
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/html');

		const html = await response.text();
		expect(html).toContain(`<title>${masonry.name} - Preview</title>`);
		expect(html).not.toMatch(
			/wp-emoji|admin-bar|wp-block-library|id="wpadminbar"/
		);

		const frame = page.frameLocator('iframe').first();
		const collection = frame.locator('.fotogrids-collection');
		await expect(collection).toHaveAttribute('data-fg-layout', 'masonry');
		await expect(collection.locator('.fg-item')).toHaveCount(6);
		expect(
			await frame
				.locator('link[rel="stylesheet"][href*="masonry"]')
				.count()
		).toBeGreaterThan(0);
		await expect
			.poll(() =>
				collection.evaluate(
					(el) =>
						getComputedStyle(el)
							.getPropertyValue('--fg-columns')
							.trim() || el.getAttribute('data-fg-ready')
				)
			)
			.not.toBe('');
	}
);

/**
 * TPL-02. Applying from the page asks which gallery, warns that its settings
 * will be replaced, and asks again before writing. Cancelling changes nothing;
 * confirming writes the template's settings, and visitors see the new layout.
 */
test(
	'TPL-02: applying a template overrides a gallery only after confirming',
	{ tag: ['@admin', '@cache'] },
	async ({ page, browser }) => {
		const masonry = template('clean-masonry');
		const { id, url } = galleryPage({ layout: 'grid' }, undefined, TITLE);

		// A visitor's view first, so the render is cached before the template lands.
		const visitor = await browser.newContext({
			storageState: { cookies: [], origins: [] },
		});
		const anon = await visitor.newPage();
		await anon.goto(url);
		await expect(
			anon.locator(`[data-fg-gallery-id="${id}"]`)
		).toHaveAttribute('data-fg-layout', 'grid');

		await openPage(page);
		await card(page, masonry.name)
			.getByRole('button', { name: 'Apply' })
			.click();
		const dialog = page
			.getByRole('dialog')
			.filter({ hasText: 'Select a gallery to apply this template to:' });
		await dialog.locator('#apply-target-id').selectOption({ label: TITLE });
		await expect(
			dialog.locator('.fotogrids-notice--warning')
		).toContainText(
			`Warning: Applying this template will overwrite all existing settings for ${TITLE}.`
		);

		await dialog.getByRole('button', { name: 'Apply Template' }).click();
		const confirm = page
			.getByRole('dialog')
			.filter({ hasText: 'Override existing settings?' });
		await expect(confirm).toContainText(
			`will override all existing settings for ${TITLE}`
		);
		await confirm.getByRole('button', { name: 'Cancel' }).click();
		expect(storedLayout(id)).toBe('grid');

		const applied = page.waitForResponse((r) =>
			decodeURIComponent(r.url()).includes(
				`/templates/${masonry.id}/apply`
			)
		);
		await dialog.getByRole('button', { name: 'Apply Template' }).click();
		await confirm.getByRole('button', { name: 'Apply Template' }).click();
		expect((await applied).status()).toBe(200);
		await expect(
			page.getByText('Template applied successfully.')
		).toBeVisible();

		expect(storedLayout(id)).toBe('masonry');
		expect(
			wpEval(
				`echo wp_json_encode( get_post_meta( ${id}, 'fotogrids_item_spacing', true ) );`
			).trim()
		).toBe(JSON.stringify(masonry.settings.item_spacing));

		await anon.goto(url);
		await expect(
			anon.locator(`[data-fg-gallery-id="${id}"]`)
		).toHaveAttribute('data-fg-layout', 'masonry');
		await visitor.close();
	}
);

/**
 * TPL-03. Choosing a template from the setup wizard's link creates a draft
 * gallery named after it, with its settings, and opens it in the editor.
 */
test(
	'TPL-03: Use this template creates a draft gallery with the template applied',
	{ tag: '@admin' },
	async ({ page }) => {
		const justified = template('clean-justified');
		await openPage(page, '&fg_choose=1');
		await expect(
			page.locator('.fotogrids-templates-page__choose-bar')
		).toBeVisible();

		const created = page.waitForResponse((r) =>
			decodeURIComponent(r.url()).includes(
				`/templates/${justified.id}/create-collection`
			)
		);
		await card(page, justified.name)
			.getByRole('button', { name: 'Use this template' })
			.click();
		expect((await created).status()).toBe(200);

		await page.waitForURL(/post\.php\?action=edit&post=\d+/);
		const postId = Number(new URL(page.url()).searchParams.get('post'));
		adopt(postId);
		await expect(page.locator('#title')).toHaveValue(justified.name);

		expect(
			wpEval(
				`echo get_post_status( ${postId} ) . ' ' . get_post_type( ${postId} );`
			).trim()
		).toBe('draft fotogrids_gallery');
		expect(storedLayout(postId)).toBe('justified');
	}
);

test.describe('TPL-06', () => {
	/**
	 * TPL-06. Without Pro, Save as Template is shown but disabled, with the
	 * note that saving templates is a Pro feature.
	 */
	test(
		'TPL-06: Save as Template is a disabled Pro control on Free',
		{ tag: '@admin' },
		async ({ page }) => {
			const { id } = galleryPage(
				{},
				undefined,
				`Admin metabox ${process.pid}`
			);

			await page.goto(`/wp-admin/post.php?post=${id}&action=edit`);
			const box = page.locator('#fotogrids-templates-metabox');
			await expect(box.locator('.fotogrids-readonly-notice')).toHaveCount(
				0
			);
			await expect(
				box.locator('.fotogrids-templates-metabox__actions button')
			).toBeDisabled();
			await expect(
				box.locator(
					'.fotogrids-templates-metabox__notice--pro .fotogrids-pro-badge'
				)
			).toHaveText('PRO');
		}
	);
});

/**
 * TPL-07. Reading templates needs edit_posts, creating from one needs the
 * gallery create and settings capabilities, and a saved template can be
 * deleted only by the user who saved it.
 */
test(
	'TPL-07: template routes check read, create and ownership rights',
	{ tag: ['@api', '@permissions'] },
	async ({ playwright }) => {
		const as = async (
			role: 'administrator' | 'editor' | 'contributor' | 'subscriber'
		) => apiAs(playwright, role);
		const get = async (api: {
			context: APIRequestContext;
			nonce: string;
		}) =>
			(
				await api.context.get(route('/fotogrids/v1/templates'), {
					headers: { 'X-WP-Nonce': api.nonce },
				})
			).status();

		const subscriber = await as('subscriber');
		const contributor = await as('contributor');
		const editor = await as('editor');
		const admin = await as('administrator');

		expect(await get(subscriber)).toBe(403);
		expect(await get(contributor)).toBe(200);

		const createAs = async (api: {
			context: APIRequestContext;
			nonce: string;
		}) =>
			api.context.post(
				route('/fotogrids/v1/templates/clean-grid/create-collection'),
				{
					headers: { 'X-WP-Nonce': api.nonce },
					data: {
						post_type: 'gallery',
						title: `Route check ${process.pid}`,
					},
				}
			);
		// Creating needs the gallery create capability, and seeding settings the settings one, which only administrators hold by default.
		expect((await createAs(subscriber)).status()).toBe(403);
		expect((await (await createAs(contributor)).json()).code).toBe(
			'rest_forbidden'
		);
		expect((await (await createAs(editor)).json()).code).toBe(
			'fotogrids_forbidden_settings'
		);
		const made = await createAs(admin);
		expect(made.status()).toBe(200);
		adopt((await made.json()).post_id);

		const owned = `e2e-user-template-${process.pid}`;
		const adminId = wpEval(
			`echo get_user_by( 'login', '${process.env.WP_ADMIN_USER ?? 'admin'}' )->ID;`
		).trim();
		const previous = wpEval(
			`echo (string) get_user_meta( ${adminId}, 'fotogrids_user_templates', true );`
		);
		wpEval(
			`update_user_meta( ${adminId}, 'fotogrids_user_templates', wp_json_encode( array( array( 'id' => '${owned}', 'name' => 'Mine', 'category' => 'gallery', 'isUserTemplate' => true, 'settings' => array( 'layout' => 'grid' ) ) ) ) );`
		);

		try {
			const remove = (api: {
				context: APIRequestContext;
				nonce: string;
			}) =>
				api.context.delete(route(`/fotogrids/v1/templates/${owned}`), {
					headers: { 'X-WP-Nonce': api.nonce },
				});

			expect((await remove(editor)).status()).toBe(403);
			expect(
				wpEval(
					`echo get_user_meta( ${adminId}, 'fotogrids_user_templates', true );`
				)
			).toContain(owned);

			expect((await remove(admin)).status()).toBe(200);
			expect(
				wpEval(
					`echo get_user_meta( ${adminId}, 'fotogrids_user_templates', true );`
				)
			).not.toContain(owned);
		} finally {
			if (previous.trim()) {
				wpEval(
					`update_user_meta( ${adminId}, 'fotogrids_user_templates', wp_unslash( '${previous.trim().replace(/'/g, "\\'")}' ) );`
				);
			} else {
				wpEval(
					`delete_user_meta( ${adminId}, 'fotogrids_user_templates' );`
				);
			}
			for (const api of [subscriber, contributor, editor, admin]) {
				await api.context.dispose();
			}
		}
	}
);
