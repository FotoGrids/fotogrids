import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { storageStateFor, wpEval } from './support/roles';

/**
 * How views reach the statistics tables: the visitor's ping, and the per-day
 * row it lands in.
 *
 * Scoped: every count read or written belongs to a gallery the spec created.
 */

const VIEW = '/fotogrids/v1/stats/view';

function isViewPing(url: string): boolean {
	return decodeURIComponent(url).includes(VIEW);
}

function views(galleryId: number): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT views FROM {$wpdb->prefix}fotogrids_statistics WHERE object_type = 'gallery' AND object_id = %d", ${galleryId} ) );`
		)
	);
}

test.describe('STAT-05', () => {
	test.use({ storageState: storageStateFor('subscriber') });

	/**
	 * STAT-05. The nonce baked into the markup belongs to whoever rendered it
	 * first. The view ping sends neither it nor cookies, so a signed-in visitor
	 * served markup with someone else's nonce is still counted.
	 */
	test(
		'STAT-05: a stale nonce in the markup does not stop a signed-in view being counted',
		{ tag: '@cache' },
		async ({ page }) => {
			const { id, url } = galleryPage({ layout: 'grid' });
			const gallery = new GalleryRender(page, id);

			// The markup as an anonymous first visitor left it, with that visitor's nonce.
			await page.route(url, async (route) => {
				const response = await route.fetch();
				const html = (await response.text()).replace(
					/(&quot;nonce&quot;:&quot;)[0-9a-f]+/g,
					'$1deadbeef00'
				);
				await route.fulfill({ response, body: html });
			});

			const ping = page.waitForRequest((request) =>
				isViewPing(request.url())
			);
			await page.goto(url);
			await gallery.waitFor();
			expect(
				JSON.parse((await gallery.attr('stats')) ?? '{}').nonce
			).toBe('deadbeef00');

			const request = await ping;
			const headers = await request.allHeaders();
			expect(headers['x-wp-nonce']).toBeUndefined();
			expect(headers.cookie).toBeUndefined();
			expect((await request.response())?.status()).toBe(200);
			await expect.poll(() => views(id)).toBe(1);
		}
	);
});

/**
 * STAT-09. Each site-local day gets its own daily row: two views either side
 * of a date change land in two rows, a third view on the same day adds to its
 * row, and the totals row counts all three.
 */
test(
	'STAT-09: views either side of a date change land in separate daily rows',
	{ tag: '@api' },
	() => {
		const { id } = galleryPage();

		// The site's UTC offset is swapped for this process only: +14h and -12h are always a date apart.
		const rows = JSON.parse(
			wpEval(`
			$dates = array();
			foreach ( array( 14, -12, -12 ) as $offset ) {
				$tz = function () { return ''; };
				$gmt = function () use ( $offset ) { return $offset; };
				add_filter( 'pre_option_timezone_string', $tz );
				add_filter( 'pre_option_gmt_offset', $gmt );
				\\FotoGrids\\Statistics::increment( 'gallery', ${id}, 'views' );
				$dates[] = current_time( 'Y-m-d' );
				remove_filter( 'pre_option_timezone_string', $tz );
				remove_filter( 'pre_option_gmt_offset', $gmt );
			}
			global $wpdb;
			echo wp_json_encode( array(
				'dates' => $dates,
				'daily' => $wpdb->get_results( $wpdb->prepare( "SELECT viewed_date AS date, CAST( views AS UNSIGNED ) AS views FROM {$wpdb->prefix}fotogrids_statistics_daily WHERE object_type = 'gallery' AND object_id = %d ORDER BY viewed_date", ${id} ), ARRAY_A ),
			) );
		`)
		) as { dates: string[]; daily: Array<{ date: string; views: string }> };

		const [ahead, behind] = rows.dates;
		expect(ahead).not.toBe(behind);
		expect(rows.daily.map((row) => [row.date, Number(row.views)])).toEqual(
			[
				[behind, 2],
				[ahead, 1],
			].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
		);
		expect(views(id)).toBe(3);
	}
);

/**
 * STAT-12. A performance plugin that holds scripts back until the visitor
 * interacts runs the statistics script after the page has initialised; the
 * runtime replays the collections it already announced, so the view is still
 * sent, once.
 */
test(
	'STAT-12: a statistics script run after page load still sends the view once',
	{ tag: '@layout' },
	async ({ page }) => {
		const { id, url } = galleryPage({ layout: 'grid' });
		const gallery = new GalleryRender(page, id);
		const pings: string[] = [];
		let script = '';

		page.on('request', (request) => {
			if (isViewPing(request.url())) {
				pings.push(request.postData() ?? '');
			}
		});

		// Take the tag out of the page, the way a delay-until-interaction optimiser does.
		await page.route(url, async (route) => {
			const response = await route.fetch();
			const html = (await response.text()).replace(
				/<script id="fotogrids-stats-js" src="([^"]+)"[^>]*><\/script>/,
				(_tag, src: string) => {
					script = src.replace(/&#038;|&amp;/g, '&');
					return '';
				}
			);
			await route.fulfill({ response, body: html });
		});

		await page.goto(url, { waitUntil: 'load' });
		await gallery.waitFor();
		expect(script).toContain('stats.js');
		await page.waitForTimeout(500);
		expect(pings).toHaveLength(0);

		await page.addScriptTag({ url: script });
		await expect.poll(() => pings.length).toBe(1);
		expect(JSON.parse(pings[0])).toEqual({
			object_type: 'gallery',
			object_id: id,
		});
		await expect.poll(() => views(id)).toBe(1);
		await page.waitForTimeout(500);
		expect(pings).toHaveLength(1);
	}
);
