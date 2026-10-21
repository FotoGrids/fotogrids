import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor, PAST_DEBOUNCE } from './support/gallery-editor';
import { storageStateFor, wpEval } from './support/roles';
import {
	badgeWasShown,
	nextAjaxSave,
	recordSaves,
	recordToasts,
	storedSetting,
	toasts,
	watchBadge,
} from './support/save-pipeline';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The gallery editor's save paths with autosave on, the site default.
 *
 * Scoped: each test saves a gallery it created.
 */

test.describe.configure({ timeout: 90_000 });

const TOGGLES = ['background_enabled', 'border_enabled', 'shadow_enabled'];

async function openStyling(page, id: number): Promise<CollectionSettings> {
	const panel = new CollectionSettings(page);
	await new GalleryEditor(page).open(id);
	await panel.openTab('Styling');
	await expect(panel.switchIn('border_enabled')).toBeVisible({
		timeout: 15000,
	});
	return panel;
}

/** On a never-saved gallery Save Draft is a native submit; once saved, it is an AJAX save. */
test(
	'SAVE-04: Save Draft submits natively on Add New and saves over AJAX afterwards',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const editor = new GalleryEditor(page);
		const panel = new CollectionSettings(page);
		const saves = recordSaves(page);

		await editor.openNew();
		await editor.title().fill(`Save draft ${Date.now()}-${process.pid}`);
		await panel.openTab('Styling');
		await panel.switchIn('border_enabled').click();
		await expect(panel.switchIn('border_enabled')).toHaveAttribute(
			'aria-checked',
			'true'
		);

		await Promise.all([
			page.waitForURL(/post\.php\?post=\d+&action=edit/),
			editor.updateButton().click(),
		]);
		const id = Number(new URL(page.url()).searchParams.get('post'));
		adopt(id);

		expect(saves.native).toHaveLength(1);
		expect(saves.ajax).toHaveLength(0);
		expect(wpEval(`echo get_post_status( ${id} );`)).toBe('draft');
		expect(storedSetting(id, 'border_enabled')).toBe('"1"');

		await expect(page.locator('#original_post_status')).toHaveValue(
			'draft'
		);
		const url = page.url();
		const save = nextAjaxSave(page);
		await editor.updateButton().click();
		expect((await save).ok()).toBe(true);
		expect(saves.native).toHaveLength(1);
		expect(page.url()).toBe(url);
	}
);

/**
 * Rapid changes with autosave on reach the server as one save, and the
 * unsaved-changes badge never shows.
 */
test(
	'SAVE-08: autosave batches rapid changes into one save and never shows the badge',
	{ tag: ['@critical', '@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = await openStyling(page, id);
		const editor = new GalleryEditor(page);
		for (const key of TOGGLES) {
			expect(await panel.switchState(key)).toBe('false');
		}

		await watchBadge(page);
		const saves = recordSaves(page);
		const saved = nextAjaxSave(page);
		for (const key of TOGGLES) {
			await panel.switchIn(key).click();
		}
		expect((await saved).ok()).toBe(true);
		await page.waitForTimeout(PAST_DEBOUNCE);

		expect(saves.ajax).toHaveLength(1);
		expect(saves.native).toHaveLength(0);
		expect(await badgeWasShown(page)).toBe(false);
		await expect(editor.unsavedBanner()).toBeHidden();
		for (const key of TOGGLES) {
			expect(storedSetting(id, key)).toBe('"1"');
		}
	}
);

/** The JS reads stored booleans with `=== '1'`, so off must be stored as '0', not ''. */
test(
	'SAVE-17: a toggle is stored as the string 1 when on and 0 when off',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = await openStyling(page, id);

		let saved = nextAjaxSave(page);
		await panel.switchIn('border_enabled').click();
		await saved;
		expect(storedSetting(id, 'border_enabled')).toBe('"1"');

		saved = nextAjaxSave(page);
		await panel.switchIn('border_enabled').click();
		await saved;
		expect(storedSetting(id, 'border_enabled')).toBe('"0"');
	}
);

/**
 * A setting key the catalog does not know is dropped: nothing is stored under
 * it, and Edit_Gate names it as not in the catalog.
 */
test(
	'SAVE-15: an unknown setting key in a save is dropped',
	{ tag: ['@api', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const bogus = `not_a_setting_${process.pid}`;
		await new GalleryEditor(page).open(id);
		const nonce = await page
			.locator('#fotogrids_meta_box_nonce')
			.first()
			.inputValue();

		const response = await page.request.post('/wp-admin/admin-ajax.php', {
			form: {
				action: 'fotogrids_save_collection',
				nonce,
				post_id: String(id),
				post_type: 'fotogrids_gallery',
				[`fotogrids_${bogus}`]: '1',
				fotogrids_border_enabled: '1',
			},
		});
		const body = await response.json();

		expect(body.success).toBe(true);
		expect(storedSetting(id, bogus)).toBe('""');
		expect(storedSetting(id, 'border_enabled')).toBe('"1"');

		const gate = JSON.parse(
			wpEval(
				`echo wp_json_encode( \\FotoGrids\\Settings\\Edit_Gate::filter( array( '${bogus}' => '1', 'border_enabled' => true ), array() ) );`
			)
		);
		expect(gate.gated).toEqual([
			{ field: bogus, reason: 'not_in_catalog' },
		]);
		expect(Object.keys(gate.settings)).toEqual(['border_enabled']);
	}
);

/**
 * While a save is in flight the native form controls are disabled, so a second
 * press cannot send a second save. Publish and the settings panel stay live.
 */
test(
	'SAVE-14: form controls are disabled during a save, except Publish and the settings panel',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage(
			{},
			undefined,
			undefined,
			undefined,
			'draft'
		);
		const panel = await openStyling(page, id);
		const editor = new GalleryEditor(page);
		const saves = recordSaves(page);

		let release: () => void = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route('**/wp-admin/admin-ajax.php', async (route) => {
			if (
				(route.request().postData() ?? '').includes(
					'fotogrids_save_collection'
				)
			) {
				await held;
			}
			await route.continue();
		});

		await editor.updateButton().click();
		await expect(editor.updateButton()).toBeDisabled();
		await expect(editor.title()).toBeDisabled();
		await expect(editor.publishButton()).toBeEnabled();
		await expect(panel.switchIn('border_enabled')).toBeEnabled();

		await editor.updateButton().click({ force: true });
		await page.keyboard.press('Enter');
		expect(saves.ajax).toHaveLength(1);

		const done = nextAjaxSave(page);
		release();
		expect((await done).ok()).toBe(true);
		await expect(editor.updateButton()).toBeEnabled();
		await expect(editor.title()).toBeEnabled();
		expect(saves.ajax).toHaveLength(1);
		expect(saves.native).toHaveLength(0);
	}
);

/**
 * A conflicting pair of settings registers a validation error: Publish is
 * disabled and relabelled, and every save path refuses with a toast.
 */
test(
	'SAVE-12: a validation error disables Publish and blocks saving',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage({
			item_click_behavior: 'lightbox',
			interactions_zoom: true,
			interactions_zoom_style: 'popover',
			interactions_zoom_mode: 'click',
		});
		const editor = new GalleryEditor(page);
		const saves = recordSaves(page);

		await editor.open(id);
		await recordToasts(page);

		await expect(editor.publishButton()).toBeDisabled();
		await expect(editor.publishButton()).toHaveValue('Fix Errors');
		await expect(editor.quickSave()).toBeVisible();

		await editor.quickSave().click();
		await page.locator('#title').focus();
		await page.keyboard.press('Control+s');
		await page.waitForTimeout(500);

		expect(saves.ajax).toHaveLength(0);
		expect(await toasts(page)).toEqual([
			'error: Please fix validation errors before saving.',
			'error: Please fix validation errors before saving.',
		]);
	}
);

/**
 * Two editors open on one gallery: the later save wins for a key both changed,
 * and a key only the earlier one changed is not reverted by the later save.
 */
test(
	'SAVE-16: two tabs saving the same gallery keep the last write and lose nothing else',
	{ tag: ['@admin', '@settings'] },
	async ({ page, context }) => {
		const { id } = galleryPage();
		const items = wpEval(
			`echo wp_json_encode( get_post_meta( ${id}, 'fotogrids_gallery_items', true ) );`
		);
		const first = await openStyling(page, id);
		const other = await context.newPage();
		const second = await openStyling(other, id);

		let saved = nextAjaxSave(page);
		await first.switchIn('border_enabled').click();
		await first.switchIn('background_enabled').click();
		await saved;

		saved = nextAjaxSave(other);
		await second.switchIn('border_enabled').click();
		await second.switchIn('border_enabled').click();
		await second.switchIn('shadow_enabled').click();
		await saved;

		expect(storedSetting(id, 'border_enabled')).toBe('"0"');
		expect(storedSetting(id, 'shadow_enabled')).toBe('"1"');
		expect(storedSetting(id, 'background_enabled')).toBe('"1"');
		expect(
			wpEval(
				`echo wp_json_encode( get_post_meta( ${id}, 'fotogrids_gallery_items', true ) );`
			)
		).toBe(items);
	}
);

/** Once autosave has stored a change, leaving the editor does not warn. */
test(
	'SAVE-11: leaving after an autosave does not warn',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = await openStyling(page, id);
		const dialogs: string[] = [];
		page.on('dialog', async (dialog) => {
			dialogs.push(dialog.type());
			await dialog.accept();
		});

		const saved = nextAjaxSave(page);
		await panel.switchIn('border_enabled').click();
		await saved;
		const closed = page.waitForEvent('close');
		await page.close({ runBeforeUnload: true });
		await closed;
		expect(dialogs).toEqual([]);
	}
);

/** A cleared text setting is sent empty and clears the stored value. */
test(
	'SAVE-13: clearing a text setting clears it in storage',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage({ fotogrids_og_title: 'Old share title' });
		const panel = new CollectionSettings(page);
		await new GalleryEditor(page).open(id);
		await panel.openTab('SEO');
		expect(storedSetting(id, 'fotogrids_og_title')).toBe(
			'"Old share title"'
		);
		await expect(panel.inputIn('fotogrids_og_title')).toHaveValue(
			'Old share title'
		);

		const saved = nextAjaxSave(page);
		await panel.inputIn('fotogrids_og_title').fill('');
		const sent = (await saved).request().postData() ?? '';

		expect(sent).toMatch(/name="fotogrids_fotogrids_og_title"\r\n\r\n\r\n/);
		expect(storedSetting(id, 'fotogrids_og_title')).toBe('""');
		await new GalleryEditor(page).open(id);
		await panel.openTab('SEO');
		await expect(panel.inputIn('fotogrids_og_title')).toHaveValue('');
	}
);
