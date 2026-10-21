import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpCli, wpEval } from './support/roles';

/**
 * Deep linking and the embedded share target are site-wide Sharing settings
 * that no gallery can override.
 *
 * Serial: rewrites the site's sharing settings and puts them back.
 */

test.describe.configure({ mode: 'serial' });
test.use({ storageState: { cookies: [], origins: [] } });

const OPTION = 'fotogrids_sharing_settings';
let saved: string | null = null;

function wp(args: string[], input?: string): string {
	return execFileSync(wpCli(), args, {
		encoding: 'utf8',
		input,
		stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
	}).trim();
}

function setSharing(values: Record<string, unknown>): void {
	wpEval(
		`\\FotoGrids\\Settings\\Sharing_Settings_Store::save( array_merge( \\FotoGrids\\Settings\\Sharing_Settings_Store::get(), json_decode( '${JSON.stringify(values)}', true ) ) ); \\FotoGrids\\FotoGrids_Cache::flush_all();`
	);
}

test.beforeAll(() => {
	try {
		saved = wp(['option', 'get', OPTION, '--format=json']);
	} catch {
		saved = null;
	}
});

test.afterAll(() => {
	if (null === saved) {
		try {
			wp(['option', 'delete', OPTION]);
		} catch {
			// Already absent.
		}
	} else {
		wp(['option', 'update', OPTION, '--format=json'], saved);
	}
	wpEval('\\FotoGrids\\FotoGrids_Cache::flush_all();');
});

type Runtime = {
	deep_linking_enabled?: unknown;
	embedded_share_target?: string;
};

async function openAt(
	page: Page,
	url: string,
	id: number,
	item: number
): Promise<Runtime> {
	// A fresh document, since a hash-only change would not reload the page.
	await page.goto('about:blank');
	await page.goto(`${url}#fg-${id}-${item}`);
	await new GalleryRender(page, id).waitFor();
	return page.evaluate(
		() => (window as unknown as { fotogrids: Runtime }).fotogrids
	);
}

/** A gallery's own values for the two keys are never read: the site setting alone decides. */
test(
	'PSET-16: deep linking and the embedded share target ignore per-gallery values',
	{ tag: ['@settings', '@lightbox'] },
	async ({ page }) => {
		const item = fixture<number[]>('F-small', 'items')[1];
		const { id, url } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'lightbox',
			lightbox_variant: 'full',
		});
		wp([
			'post',
			'meta',
			'update',
			String(id),
			'fotogrids_deep_linking_enabled',
			'1',
		]);
		wp([
			'post',
			'meta',
			'update',
			String(id),
			'fotogrids_embedded_share_target',
			'image',
		]);

		setSharing({
			deep_linking_enabled: false,
			embedded_share_target: 'page',
		});

		const resolved = JSON.parse(
			wpEval(
				`echo wp_json_encode( \\FotoGrids\\Settings\\Sharing_Settings_Store::resolve( ${id} ) );`
			)
		) as Record<string, unknown>;
		expect(resolved).not.toHaveProperty('deep_linking_enabled');
		expect(resolved).not.toHaveProperty('embedded_share_target');

		const off = await openAt(page, url, id, item);
		// wp_localize_script sends false as ''.
		expect(Boolean(off.deep_linking_enabled)).toBe(false);
		expect(off.embedded_share_target).toBe('page');
		await page.waitForTimeout(1500);
		await expect(page.locator('dialog.fg-lightbox')).toHaveCount(0);

		setSharing({
			deep_linking_enabled: true,
			embedded_share_target: 'image',
		});

		const on = await openAt(page, url, id, item);
		expect(Boolean(on.deep_linking_enabled)).toBe(true);
		expect(on.embedded_share_target).toBe('image');
		await expect(page.locator('dialog.fg-lightbox')).toBeVisible({
			timeout: 15000,
		});
	}
);
