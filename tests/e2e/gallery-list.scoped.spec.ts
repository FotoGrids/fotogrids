import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';
import { fixture } from './support/fixtures';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The Galleries list screen (bulk album assignment, its notices, the shortcode
 * column) and what trashing or deleting a gallery leaves behind.
 *
 * Scoped: every gallery and album here is created by the test that uses it.
 */

test.describe.configure({ timeout: 90_000 });

const LIST = '/wp-admin/edit.php?post_type=fotogrids_gallery';

function albumsOf(galleryId: number): number[] {
	return JSON.parse(
		wpEval(`
			global $wpdb;
			echo wp_json_encode( array_map( 'intval', $wpdb->get_col( $wpdb->prepare( "SELECT album_id FROM {$wpdb->prefix}fotogrids_gallery_albums WHERE gallery_id = %d ORDER BY album_id", ${galleryId} ) ) ) );
		`)
	);
}

function unique(label: string): string {
	return `${label} ${Date.now()}-${process.pid}`;
}

async function openList(page: Page): Promise<void> {
	await page.goto(LIST);
	await expect(page.locator('#the-list')).toBeVisible({ timeout: 15000 });
}

/**
 * Assign to Album writes the relation rows. The album picker shows only for
 * that action, and the top and bottom pickers stay in step.
 */
test(
	'GAL-19: Assign to Album assigns the checked galleries, with both pickers in step',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const target = album([galleryPage().id], {}, unique('Bulk target'));
		const first = galleryPage({}, undefined, unique('Bulk one')).id;
		const second = galleryPage({}, undefined, unique('Bulk two')).id;
		const top = page.locator('#fotogrids-album-select-top');
		const bottom = page.locator('#fotogrids-album-select-bottom');

		await openList(page);
		await page.locator(`#cb-select-${first}`).check();
		await page.locator(`#cb-select-${second}`).check();

		await expect(top).toBeHidden();
		await page
			.locator('#bulk-action-selector-top')
			.selectOption('assign_to_album');
		await expect(top).toBeVisible();
		await expect(bottom).toBeHidden();
		await top.selectOption(String(target.id));
		await expect(bottom).toHaveValue(String(target.id));
		await page
			.locator('#bulk-action-selector-bottom')
			.selectOption('assign_to_album');
		await expect(bottom).toBeVisible();
		await bottom.selectOption('');
		await expect(top).toHaveValue('');
		await bottom.selectOption(String(target.id));
		await expect(top).toHaveValue(String(target.id));

		await Promise.all([
			page.waitForURL(/bulk_assigned=2/),
			page.locator('#doaction').click(),
		]);

		expect(albumsOf(first)).toEqual([target.id]);
		expect(albumsOf(second)).toEqual([target.id]);
	}
);

/** Applying Assign to Album with no album picked stops with an alert and sends nothing. */
test(
	'GAL-20: Assign to Album with no album picked is stopped with an alert',
	{ tag: ['@admin'] },
	async ({ page }) => {
		album([galleryPage().id], {}, unique('Bulk unused'));
		const gallery = galleryPage({}, undefined, unique('Bulk none')).id;
		const url = `${process.env.WP_BASE_URL}${LIST}`;
		const alerts: string[] = [];
		page.on('dialog', async (dialog) => {
			alerts.push(`${dialog.type()}: ${dialog.message()}`);
			await dialog.accept();
		});

		await openList(page);
		await page.locator(`#cb-select-${gallery}`).check();
		await page
			.locator('#bulk-action-selector-bottom')
			.selectOption('assign_to_album');
		await expect(
			page.locator('#fotogrids-album-select-bottom')
		).toBeVisible();
		await page.locator('#doaction2').click();

		await expect
			.poll(() => alerts)
			.toEqual(['alert: Please select an album to assign galleries to.']);
		expect(page.url()).toBe(url);
		expect(albumsOf(gallery)).toEqual([]);
	}
);

/**
 * The list prints the result notice only with the nonce the bulk handler adds
 * to its redirect, so a hand-made URL prints nothing. Read from the server's
 * HTML, before any script runs.
 */
test(
	'GAL-19, GAL-21: the bulk-action notice names the album, and cannot be forged by URL',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const title = unique('Notice album');
		const target = album([galleryPage().id], {}, title);
		const gallery = galleryPage({}, undefined, unique('Notice gallery')).id;
		const notice = '1 gallery assigned to &quot;' + title + '&quot;.';
		const html = async (url: string) =>
			(await page.request.get(url)).text();

		await openList(page);
		await page.locator(`#cb-select-${gallery}`).check();
		await page
			.locator('#bulk-action-selector-top')
			.selectOption('assign_to_album');
		await page
			.locator('#fotogrids-album-select-top')
			.selectOption(String(target.id));
		await Promise.all([
			page.waitForURL(/_fg_bulk_notice=/),
			page.locator('#doaction').click(),
		]);

		const genuine = new URL(page.url());
		expect(await html(genuine.href)).toContain(
			`<div class="notice notice-success is-dismissible"><p>${notice}</p></div>`
		);

		const stripped = new URL(genuine.href);
		stripped.searchParams.delete('_fg_bulk_notice');
		const tampered = new URL(genuine.href);
		tampered.searchParams.set('_fg_bulk_notice', '0123456789');
		const forged = [
			stripped.href,
			tampered.href,
			`${LIST}&bulk_removed=4&bulk_errors=2`,
			`${LIST}&bulk_error=invalid_album`,
		];
		for (const url of forged) {
			const body = await html(url);
			expect(body).toContain('id="the-list"');
			expect(body).not.toMatch(
				/class="notice notice-(success|error) is-dismissible"><p>[^<]*(galler|album)/i
			);
		}
	}
);

/** The shortcode column's copy button puts the gallery shortcode on the clipboard. */
test(
	'GAL-22: the shortcode column copies the shortcode',
	{ tag: ['@admin'] },
	async ({ page, context }) => {
		const { id } = galleryPage({}, undefined, unique('Copy me'));
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);

		await openList(page);
		await page.evaluate(() => navigator.clipboard.writeText(''));
		const button = page.locator(
			`#post-${id} .fotogrids-shortcode-copy-btn`
		);
		await expect(button).toHaveAttribute(
			'data-shortcode',
			`[fotogrids_gallery id="${id}"]`
		);
		await button.click();

		await expect(page.locator('.fotogrids-toast-container')).toContainText(
			'Shortcode copied to clipboard'
		);
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
			`[fotogrids_gallery id="${id}"]`
		);
	}
);

/** Trash and Restore from the list keep the gallery's items, settings and album membership. */
test(
	'GAL-17: a trashed and restored gallery keeps its items, settings and album',
	{ tag: ['@admin', '@lifecycle'] },
	async ({ page }) => {
		const items = fixture<number[]>('F-small', 'items');
		const gallery = galleryPage(
			{ border_enabled: true, shadow_enabled: true },
			items,
			unique('Trash me')
		).id;
		const target = album([gallery]).id;
		const snapshot = () =>
			wpEval(`
			echo wp_json_encode( array(
				'items'   => \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( ${gallery} ),
				'border'  => get_post_meta( ${gallery}, 'fotogrids_border_enabled', true ),
				'shadow'  => get_post_meta( ${gallery}, 'fotogrids_shadow_enabled', true ),
			) );
		`);
		const before = snapshot();
		expect(JSON.parse(before).items).toEqual(items);

		await openList(page);
		await page.locator(`#post-${gallery}`).hover();
		await Promise.all([
			page.waitForURL(/trashed=1/),
			page.locator(`#post-${gallery} .submitdelete`).click(),
		]);
		expect(wpEval(`echo get_post_status( ${gallery} );`)).toBe('trash');
		expect(albumsOf(gallery)).toEqual([target]);

		await page.goto(`${LIST}&post_status=trash`);
		await page.locator(`#post-${gallery}`).hover();
		await Promise.all([
			page.waitForURL(/untrashed=1/),
			page.locator(`#post-${gallery} .untrash a`).click(),
		]);

		expect(wpEval(`echo get_post_status( ${gallery} );`)).not.toBe('trash');
		expect(snapshot()).toBe(before);
		expect(albumsOf(gallery)).toEqual([target]);
	}
);

/**
 * Deleting a gallery for good removes its album rows and its custom image size
 * registration, and leaves its attachments and their item data alone.
 */
test(
	'GAL-18: deleting a gallery permanently cleans its rows and keeps the attachments',
	{ tag: ['@lifecycle'] },
	async () => {
		const items = fixture<number[]>('F-small', 'items');
		const width = 300 + ((Date.now() + process.pid) % 600);
		const gallery = galleryPage(
			{
				thumbnail_size: 'custom',
				thumbnail_custom_size_width: width,
				thumbnail_custom_size_height: 211,
			},
			items
		).id;
		const sibling = galleryPage().id;
		const target = album([gallery, sibling]).id;
		const state = () =>
			JSON.parse(
				wpEval(`
				global $wpdb;
				$sizes = array();
				foreach ( (array) get_option( 'fotogrids_custom_sizes', array() ) as $slug => $size ) {
					if ( in_array( ${gallery}, $size['gallery_ids'] ?? array(), true ) ) {
						$sizes[] = $slug;
					}
				}
				$attachments = array();
				foreach ( array( ${items.join(',')} ) as $id ) {
					$attachments[ $id ] = array(
						'type' => get_post_type( $id ),
						'file' => file_exists( get_attached_file( $id ) ),
						'meta' => wp_get_attachment_metadata( $id ),
						'item' => \\FotoGrids\\Galleries\\Item_Meta::get( $id ),
					);
				}
				echo wp_json_encode( array(
					'sizes'       => $sizes,
					'relations'   => (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_gallery_albums WHERE gallery_id = %d", ${gallery} ) ),
					'album'       => \\FotoGrids\\Gallery_Album_Relations::get_gallery_ids_for_album( ${target} ),
					'attachments' => $attachments,
				) );
			`)
			);

		const before = state();
		expect(before.sizes).toHaveLength(1);
		expect(before.relations).toBe(1);

		wpEval(`wp_delete_post( ${gallery}, true );`);

		const after = state();
		expect(wpEval(`echo wp_json_encode( get_post( ${gallery} ) );`)).toBe(
			'null'
		);
		expect(after.sizes).toEqual([]);
		expect(after.relations).toBe(0);
		expect(after.album).toEqual([sibling]);
		expect(after.attachments).toEqual(before.attachments);
	}
);
