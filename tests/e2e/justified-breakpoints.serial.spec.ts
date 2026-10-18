import { test, expect } from './support/test';
import { wpEval } from './support/roles';
import {
	expectCoverage,
	expectFullRows,
	justified,
	open,
	shapes,
	shownIds,
	walk,
} from './support/justified';

/**
 * Justified pagination under the site-wide breakpoint settings: custom
 * breakpoints and device detection decide geometry, page targets and requests
 * the same way. Serial: it changes the general settings.
 */

test.describe.configure({ timeout: 120000 });

const OPTION = 'fotogrids_general_settings';
let saved = '';

test.beforeAll(() => {
	saved = wpEval(
		`echo wp_json_encode( get_option( '${OPTION}', array() ) );`
	).trim();
});

test.afterAll(() => {
	wpEval(
		`update_option( '${OPTION}', json_decode( '${saved.replace(/'/g, "\\'")}', true ) );`
	);
});

function setGeneral(values: Record<string, unknown>): void {
	wpEval(
		`$o = get_option( '${OPTION}', array() ); if ( ! is_array( $o ) ) { $o = array(); } update_option( '${OPTION}', array_merge( $o, json_decode( '${JSON.stringify(values)}', true ) ) );`
	);
}

test(
	'ENT-08: a custom mobile breakpoint decides the page target and geometry',
	{ tag: '@layout' },
	async ({ page }) => {
		setGeneral({
			mobile_breakpoint: 900,
			tablet_breakpoint: 1100,
			detect_responsive_by_browser: false,
		});
		await page.setViewportSize({ width: 880, height: 900 });
		const items = shapes(40);
		const { id, url } = justified(
			{ items_per_page: { desktop: 12, tablet: 8, mobile: 4 } },
			items
		);
		const gallery = await open(page, url, id);

		const first = await shownIds(gallery);
		expect(first.length).toBeLessThanOrEqual(5);
		await expectFullRows(gallery, 0);
		expectCoverage(
			await walk('load_more', page, gallery, { rowsFull: true }),
			items
		);
	}
);

test(
	'ENT-08: device detection decides the breakpoint the same way for every request',
	{ tag: '@layout' },
	async ({ browser }) => {
		setGeneral({ detect_responsive_by_browser: true });
		const context = await browser.newContext({
			viewport: { width: 1024, height: 1366 },
			isMobile: true,
			hasTouch: true,
			deviceScaleFactor: 2,
		});
		const page = await context.newPage();
		const items = shapes(40);
		const { id, url } = justified(
			{ items_per_page: { desktop: 12, tablet: 8, mobile: 4 } },
			items
		);
		const gallery = await open(page, url, id);

		await expectFullRows(gallery, 0);
		expectCoverage(
			await walk('load_more', page, gallery, { rowsFull: true }),
			items
		);
		await context.close();
	}
);
