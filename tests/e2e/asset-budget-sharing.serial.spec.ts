import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { getOption, setOption } from './support/site';
import { apiAnonymous, wpEval } from './support/roles';

/**
 * What switching social sharing on adds to a gallery page.
 *
 * Serial: turns site-wide sharing on, and puts the setting back.
 */

const OPTION = 'fotogrids_sharing_settings';

let saved: string | null = null;

test.beforeAll(() => {
	saved =
		getOption(OPTION) === null
			? null
			: wpEval(
					`echo wp_json_encode( get_option( '${OPTION}' ) );`
				).trim();
});

test.afterAll(() => {
	if (null === saved) {
		setOption(OPTION, null);
		return;
	}
	const encoded = Buffer.from(saved).toString('base64');
	wpEval(
		`update_option( '${OPTION}', json_decode( base64_decode( '${encoded}' ), true ) );`
	);
});

function sharing(on: boolean): void {
	wpEval(
		`\\FotoGrids\\Settings\\Sharing_Settings_Store::save( array_merge( \\FotoGrids\\Settings\\Sharing_Settings_Store::get(), array( 'enable_social_sharing' => ${on ? 'true' : 'false'} ) ) );`
	);
}

/** FotoGrids stylesheet and script handles a page links. */
function handles(markup: string): string[] {
	return [
		...[
			...markup.matchAll(/<link[^>]+id=['"](fotogrids-[\w-]+-css)['"]/g),
		].map((m) => m[1]),
		...[
			...markup.matchAll(
				/<script[^>]+id=['"](fotogrids-[\w-]+-js)['"][^>]*\ssrc=/g
			),
		].map((m) => m[1]),
	].sort();
}

/** Sharing brings its own script and styles and the tooltip they use, and nothing else. */
test(
	'PERF-03: enabling sharing adds exactly the sharing and tooltip assets',
	{ tag: ['@layout', '@settings'] },
	async ({ playwright }) => {
		const guest = await apiAnonymous(playwright);
		const { url } = galleryPage({
			layout: 'grid',
			item_click_behavior: 'nothing',
			enable_statistics: false,
			enable_cache: false,
		});
		const load = async () => {
			const response = await guest.get(url);
			expect(response.status()).toBe(200);
			return handles(await response.text());
		};

		sharing(false);
		const off = await load();
		sharing(true);
		const on = await load();

		expect(off.filter((handle) => !on.includes(handle))).toEqual([]);
		expect(on.filter((handle) => !off.includes(handle))).toEqual([
			'fotogrids-fg-tooltip-css',
			'fotogrids-fg-tooltip-js',
			'fotogrids-sharing-css',
			'fotogrids-sharing-js',
		]);

		await guest.dispose();
	}
);
