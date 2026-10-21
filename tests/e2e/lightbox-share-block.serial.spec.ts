import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { wpCli } from './support/roles';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * The info panel's Share block draws the site's share bar for the item on
 * screen.
 *
 * serial: sharing is a site-wide option; the spec restores it afterwards.
 */

test.describe.configure({ mode: 'serial' });

const OPTION = 'fotogrids_sharing_settings';

let before: string | null = null;

function readOption(): string | null {
	try {
		return execFileSync(
			wpCli(),
			['option', 'get', OPTION, '--format=json'],
			{
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			}
		).trim();
	} catch {
		return null;
	}
}

function writeOption(value: string | null): void {
	if (null === value) {
		execFileSync(wpCli(), ['option', 'delete', OPTION], {
			encoding: 'utf8',
		});
		return;
	}
	execFileSync(
		wpCli(),
		['option', 'update', OPTION, '--format=json', value],
		{
			encoding: 'utf8',
		}
	);
}

function sharing(enabled: boolean): string {
	return JSON.stringify({
		enable_social_sharing: enabled,
		networks: {
			facebook: true,
			x: false,
			pinterest: true,
			linkedin: false,
			whatsapp: false,
			telegram: false,
			reddit: false,
			email: true,
			copy_link: false,
		},
		placements: ['lightbox'],
		track_clicks: false,
	});
}

test.beforeAll(() => {
	before = readOption();
});

test.afterAll(() => {
	writeOption(before);
});

const PANEL = {
	layout: 'grid',
	lightbox_variant: 'full',
	lightbox_auto_progress: false,
	lightbox_info_panel_enabled: true,
	lightbox_info_panel_default_state: 'open',
	lightbox_info_blocks: ['caption', 'share'],
};

/**
 * LB-05: with sharing on, the Share block lists the enabled networks; with
 * sharing off, the block is not drawn.
 */
test(
	'LB-05: the Share block shows the enabled networks, and is absent with sharing off',
	{ tag: '@lightbox' },
	async ({ page }) => {
		const lightbox = new Lightbox(page);
		const share = lightbox.dialog().locator('[data-fg-lb-block="share"]');

		writeOption(sharing(true));
		const { id, url } = galleryPage(PANEL);
		const gallery = new GalleryRender(page, id);
		await page.goto(url);
		await gallery.waitFor();
		await lightbox.openFrom(gallery);

		await expect(
			share.locator('.fotogrids-share-bar--lightbox')
		).toBeVisible();
		expect(
			await share
				.locator('[data-network]')
				.evaluateAll((buttons) =>
					buttons.map((b) => b.getAttribute('data-network'))
				)
		).toEqual(['facebook', 'pinterest', 'email']);

		writeOption(sharing(false));
		const off = galleryPage(PANEL);
		const plain = new GalleryRender(page, off.id);
		await page.goto(off.url);
		await plain.waitFor();
		await lightbox.openFrom(plain);

		await expect(
			lightbox.dialog().locator('[data-fg-lb-block="text"]')
		).toBeVisible();
		await expect(share).toHaveCount(0);
	}
);
