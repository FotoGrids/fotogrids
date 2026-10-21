import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryRender } from './support/gallery-render';
import { SettingsPage } from './support/settings-page';
import { getOption, setOption } from './support/site';
import { storageStateFor, wpCli, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Saving Gallery Defaults leaves galleries that already exist as they were.
 *
 * Serial: rewrites the site's collection defaults and Autosave, and puts both
 * back.
 */

test.describe.configure({ mode: 'serial' });

const OPTION = 'fotogrids_collection_defaults';

let savedDefaults: string | null;
let savedAutosave: string | null;

function wp(args: string[], input?: string): string {
	return execFileSync(wpCli(), args, { encoding: 'utf8', input }).trim();
}

/** Every FotoGrids meta row the gallery has, as stored. */
function allMeta(id: number): Record<string, unknown> {
	return JSON.parse(
		wpEval(
			`$out = array(); foreach ( get_post_meta( ${id} ) as $k => $v ) { if ( 0 === strpos( $k, 'fotogrids_' ) ) { $out[ $k ] = $v; } } ksort( $out ); echo wp_json_encode( $out );`
		)
	);
}

test.beforeAll(() => {
	savedDefaults =
		null === getOption(OPTION)
			? null
			: wp(['option', 'get', OPTION, '--format=json']);
	savedAutosave = getOption('fotogrids_autosave');
	wp(
		['option', 'update', OPTION, '--format=json'],
		JSON.stringify({
			gallery: { layout: 'grid' },
			album: { layout: 'grid' },
		})
	);
	setOption('fotogrids_autosave', '1');
});

test.afterAll(() => {
	if (null === savedDefaults) {
		setOption(OPTION, null);
	} else {
		wp(['option', 'update', OPTION, '--format=json'], savedDefaults);
	}
	setOption('fotogrids_autosave', savedAutosave);
});

/** An existing gallery keeps its stored settings, its render and its editor after a defaults save. */
test(
	'SET-19: a Gallery Defaults save does not reach an existing gallery',
	{ tag: ['@settings', '@admin'] },
	async ({ page }) => {
		const { id, url } = galleryPage({
			layout: 'masonry',
			border_enabled: true,
		});
		const before = allMeta(id);
		expect(Object.keys(before)).toContain('fotogrids_layout');

		const settings = new SettingsPage(page);
		const panel = new CollectionSettings(page);
		await page.goto(
			'/wp-admin/admin.php?page=fotogrids-settings&tab=defaults&subtab=gallery'
		);
		await expect(panel.activeLayout()).toHaveText('Grid', {
			timeout: 20000,
		});

		await panel.layoutOption('Justified').click();
		await panel.openTab('Styling');
		await panel.switchIn('border_enabled').click();
		await expect(settings.saveMessage()).toContainText(
			/all changes saved/i,
			{ timeout: 20000 }
		);

		expect(
			JSON.parse(
				wpEval(
					'echo wp_json_encode( \\FotoGrids\\Settings\\Collection_Defaults_Store::all() );'
				)
			)
		).toMatchObject({ gallery: { layout: 'justified' } });

		expect(allMeta(id)).toEqual(before);

		await page.goto(url);
		const gallery = new GalleryRender(page, id);
		await gallery.waitFor();
		expect(await gallery.layout()).toBe('masonry');

		await page.goto(`/wp-admin/post.php?post=${id}&action=edit`);
		await expect(panel.activeLayout()).toHaveText('Masonry', {
			timeout: 20000,
		});
		await panel.openTab('Styling');
		expect(await panel.switchState('border_enabled')).toBe('true');
	}
);
