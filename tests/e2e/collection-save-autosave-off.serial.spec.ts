import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor, PAST_DEBOUNCE } from './support/gallery-editor';
import { storageStateFor } from './support/roles';
import { SettingsPage } from './support/settings-page';
import { getOption, setOption } from './support/site';
import {
	nextAjaxSave,
	recordSaves,
	recordToasts,
	storedSetting,
	toasts,
} from './support/save-pipeline';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The collection editor's explicit save paths, with autosave turned off so
 * nothing but the path under test can write.
 *
 * Serial: turns the site-wide Autosave option off, and puts it back.
 */

test.describe.configure({ mode: 'serial', timeout: 90_000 });

const OPTION = 'fotogrids_autosave';
const KEY = 'border_enabled';
let original: string | null;

test.beforeAll(() => {
	original = getOption(OPTION);
});

test.beforeEach(() => {
	setOption(OPTION, '0');
});

test.afterAll(() => {
	setOption(OPTION, original);
});

async function openStyling(page, id: number): Promise<CollectionSettings> {
	const panel = new CollectionSettings(page);
	await page.goto(`/wp-admin/post.php?post=${id}&action=edit`);
	await panel.openTab('Styling');
	await expect(panel.switchIn(KEY)).toBeVisible({ timeout: 15000 });
	return panel;
}

/** With autosave off a change only raises the badge; Update is what stores it. */
test(
	'SAVE-07: with autosave off a change shows the badge and stores nothing until saved',
	{ tag: ['@critical', '@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = await openStyling(page, id);
		const editor = new GalleryEditor(page);
		const saves = recordSaves(page);
		const before = storedSetting(id, KEY);

		await expect(editor.unsavedBanner()).toBeHidden();
		await panel.switchIn(KEY).click();
		await expect(editor.unsavedBanner()).toBeVisible();
		await expect(editor.unsavedBanner()).toContainText(
			'You have unsaved changes'
		);
		expect(await editor.hasChanges()).toBe(true);

		await page.waitForTimeout(PAST_DEBOUNCE);
		expect(saves.ajax).toHaveLength(0);
		expect(storedSetting(id, KEY)).toBe(before);

		await Promise.all([
			page.waitForURL(/[?&]message=\d+/),
			editor.publishButton().click(),
		]);
		expect(storedSetting(id, KEY)).toBe('"1"');
		await expect(editor.unsavedBanner()).toBeHidden();
	}
);

/**
 * Save Draft on a saved draft, clicked or reached by pressing Enter (which
 * submits through the hidden name="save" button), saves over AJAX in place.
 */
test(
	'SAVE-03: Save Draft on a saved draft saves over AJAX without leaving the page',
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
		const url = page.url();
		await recordToasts(page);

		await panel.switchIn(KEY).click();
		let saved = nextAjaxSave(page);
		await editor.updateButton().click();
		const body = await (await saved).json();

		expect(body.success).toBe(true);
		expect(body.data.message).toBe('Gallery saved successfully');
		expect(await toasts(page)).toContain(
			'success: Gallery saved successfully'
		);
		expect(storedSetting(id, KEY)).toBe('"1"');
		await expect(editor.unsavedBanner()).toBeHidden();

		await panel.switchIn(KEY).click();
		await expect(editor.unsavedBanner()).toBeVisible();
		saved = nextAjaxSave(page);
		await editor.title().focus();
		await page.keyboard.press('Enter');
		await saved;

		expect(storedSetting(id, KEY)).toBe('"0"');
		expect(saves.ajax).toHaveLength(2);
		expect(saves.native).toHaveLength(0);
		expect(page.url()).toBe(url);
	}
);

/** Ctrl+S and Cmd+S save over AJAX, also while a settings field has focus. */
test(
	'SAVE-05: Ctrl+S and Cmd+S save from a settings field and from the page',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = new CollectionSettings(page);
		const editor = new GalleryEditor(page);
		await editor.open(id);
		await panel.openTab('SEO');
		const saves = recordSaves(page);

		const field = panel.inputIn('fotogrids_og_title');
		const title = `Shortcut ${Date.now()}`;
		await field.fill(title);
		await expect(field).toBeFocused();
		let saved = nextAjaxSave(page);
		await page.keyboard.press('Control+s');
		await saved;
		expect(storedSetting(id, 'fotogrids_og_title')).toBe(
			JSON.stringify(title)
		);
		await expect(editor.unsavedBanner()).toBeHidden();

		await panel.openTab('Styling');
		await panel.switchIn(KEY).click();
		await page.locator('#wpbody').click({ position: { x: 5, y: 5 } });
		saved = nextAjaxSave(page);
		await page.keyboard.press('Meta+s');
		await saved;
		expect(storedSetting(id, KEY)).toBe('"1"');

		expect(saves.ajax).toHaveLength(2);
		expect(saves.native).toHaveLength(0);
	}
);

/** The admin bar's Quick Save item saves the collection over AJAX. */
test(
	'SAVE-06: Quick Save in the admin bar saves the gallery',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = await openStyling(page, id);
		const editor = new GalleryEditor(page);
		const saves = recordSaves(page);

		await expect(
			page.locator('#wp-admin-bar-fotogrids-quick-save')
		).toContainText('Quick Save');
		await panel.switchIn(KEY).click();
		await expect(editor.unsavedBanner()).toBeVisible();

		const saved = nextAjaxSave(page);
		await editor.quickSave().click();
		expect((await saved).ok()).toBe(true);

		expect(storedSetting(id, KEY)).toBe('"1"');
		await expect(editor.unsavedBanner()).toBeHidden();
		expect(saves.native).toHaveLength(0);
	}
);

/** Leaving with unsaved changes asks first; leaving after a save does not. */
test(
	'SAVE-11: leaving the editor warns only while there are unsaved changes',
	{ tag: ['@admin', '@settings'] },
	async ({ page, context }) => {
		const { id } = galleryPage();
		const dialogs: string[] = [];
		const watch = (target, name: string) =>
			target.on('dialog', async (dialog) => {
				dialogs.push(`${name}: ${dialog.type()}`);
				await dialog.accept();
			});

		const dirty = page;
		watch(dirty, 'dirty');
		const panel = await openStyling(dirty, id);
		await panel.switchIn(KEY).click();
		await dirty.close({ runBeforeUnload: true });
		await expect.poll(() => dialogs).toEqual(['dirty: beforeunload']);

		const saved = await context.newPage();
		watch(saved, 'saved');
		const savedPanel = await openStyling(saved, id);
		await savedPanel.switchIn(KEY).click();
		await expect(new GalleryEditor(saved).unsavedBanner()).toBeVisible();
		const save = nextAjaxSave(saved);
		await saved.keyboard.press('Control+s');
		await save;
		await expect(new GalleryEditor(saved).unsavedBanner()).toBeHidden();
		const closed = saved.waitForEvent('close');
		await saved.close({ runBeforeUnload: true });
		await closed;
		expect(dialogs).toEqual(['dirty: beforeunload']);
	}
);

/** The album editor honours autosave off the same way the gallery editor does. */
test(
	'SAVE-10: with autosave off the album editor waits for an explicit save',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = album([galleryPage().id]);
		const panel = await openStyling(page, id);
		const editor = new GalleryEditor(page);
		const saves = recordSaves(page);
		const before = storedSetting(id, KEY);

		await panel.switchIn(KEY).click();
		await expect(editor.unsavedBanner()).toBeVisible();
		await page.waitForTimeout(PAST_DEBOUNCE);
		expect(saves.ajax).toHaveLength(0);
		expect(storedSetting(id, KEY)).toBe(before);

		const saved = nextAjaxSave(page);
		await page.keyboard.press('Control+s');
		expect((await saved.then((r) => r.json())).data.message).toBe(
			'Album saved successfully'
		);
		expect(storedSetting(id, KEY)).toBe('"1"');
		await expect(editor.unsavedBanner()).toBeHidden();
	}
);

/**
 * The editor's own Autosave switch writes the same option the Advanced tab
 * shows, and takes effect in the editor at once.
 */
test(
	'SAVE-09: the editor Autosave switch and the Advanced tab agree',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const { id } = galleryPage();
		const panel = await openStyling(page, id);
		const editor = new GalleryEditor(page);
		const settings = new SettingsPage(page);
		const toggle = async (on: boolean) => {
			const written = page.waitForResponse((response) =>
				(response.request().postData() ?? '').includes(
					'fotogrids_update_plugin_setting'
				)
			);
			await panel.autosaveToggle().click();
			expect((await written).ok()).toBe(true);
			await expect(panel.autosaveToggle()).toHaveAttribute(
				'aria-checked',
				String(on)
			);
		};

		await expect(panel.autosaveToggle()).toHaveAttribute(
			'aria-checked',
			'false'
		);
		await toggle(true);
		const saved = nextAjaxSave(page, PAST_DEBOUNCE * 2);
		await panel.switchIn(KEY).click();
		await saved;
		await expect(editor.unsavedBanner()).toBeHidden();
		expect(storedSetting(id, KEY)).toBe('"1"');

		await settings.openAdvanced();
		expect(await settings.toggleState('autosave')).toBe('true');

		await openStyling(page, id);
		await toggle(false);
		await panel.switchIn(KEY).click();
		await expect(editor.unsavedBanner()).toBeVisible();

		page.on('dialog', (dialog) => dialog.accept());
		await settings.openAdvanced();
		expect(await settings.toggleState('autosave')).toBe('false');
		expect(storedSetting(id, KEY)).toBe('"1"');
	}
);
