import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';

/**
 * LAY-32. A layout opts into the shared item box through the capabilities
 * filter alone, with no change to base CSS.
 *
 * Serial: installs an mu-plugin that filters Masonry's capabilities.
 */

test.describe.configure({ mode: 'serial' });

const MU_PLUGIN = path.join(
	process.env.WP_PATH ?? '',
	'wp-content',
	'mu-plugins',
	'fg-e2e-item-box-opt-in.php'
);

const FILTER = `<?php
add_filter(
	'fotogrids/render/layout/capabilities',
	function ( $capabilities, $layout_id ) {
		if ( 'fotogrids/masonry' === $layout_id ) {
			$capabilities['base_item_box'] = 'box';
		}
		return $capabilities;
	},
	10,
	2
);
`;

test.afterEach(() => {
	if (existsSync(MU_PLUGIN)) {
		unlinkSync(MU_PLUGIN);
	}
});

test(
	'LAY-32: masonry opted in through the filter takes the item box',
	{ tag: '@layout' },
	async ({ page }) => {
		mkdirSync(path.dirname(MU_PLUGIN), { recursive: true });
		writeFileSync(MU_PLUGIN, FILTER);

		const { id, url } = galleryPage({
			layout: 'masonry',
			layout_item_aspect_ratio: '16/9',
		});
		const gallery = new GalleryRender(page, id);

		await page.goto(url);
		await gallery.waitFor();

		expect(await gallery.attr('item-box')).toBe('box');

		const ratios = await gallery.root.evaluate((root) =>
			[...root.querySelectorAll('.fg-item-media')].map((media) => {
				const box = media.getBoundingClientRect();
				return box.width / box.height;
			})
		);
		expect(ratios.length).toBeGreaterThan(0);
		for (const ratio of ratios) {
			expect(Math.abs(ratio - 16 / 9) / (16 / 9)).toBeLessThan(0.02);
		}
	}
);
