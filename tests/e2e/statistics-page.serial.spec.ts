import type { Page, Request } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { storageStateFor, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The Statistics screen against a known history: the period switch, the
 * requests behind it, the trend arithmetic and the charts.
 *
 * Serial: the cards and charts are site-wide sums, so both statistics tables
 * are replaced for the run and put back afterwards.
 */

test.describe.configure({ mode: 'serial' });

const SCREEN = '/wp-admin/admin.php?page=fotogrids-stats';
const TABLES = "array( 'fotogrids_statistics', 'fotogrids_statistics_daily' )";
const READS = [
	'overview',
	'views',
	'popular-galleries',
	'recent-activity',
	'top-content',
];

/** Daily views by age in days: three in the 7-day window, three in the one before, one older still. */
const DAILY: Record<number, number> = {
	0: 5,
	3: 4,
	6: 3,
	7: 2,
	10: 1,
	13: 3,
	14: 50,
};

let galleryId = 0;

test.beforeAll(() => {
	wpEval(`global $wpdb;
	foreach ( ${TABLES} as $t ) {
		$src = $wpdb->prefix . $t;
		$wpdb->query( "DROP TABLE IF EXISTS {$src}_e2e_page_bak" );
		$wpdb->query( "CREATE TABLE {$src}_e2e_page_bak LIKE {$src}" );
		$wpdb->query( "INSERT INTO {$src}_e2e_page_bak SELECT * FROM {$src}" );
	}`);

	galleryId = galleryPage({}, undefined, `Stats screen ${process.pid}`).id;

	wpEval(`global $wpdb;
	$s = $wpdb->prefix . 'fotogrids_statistics';
	$d = $wpdb->prefix . 'fotogrids_statistics_daily';
	$wpdb->query( "TRUNCATE {$s}" );
	$wpdb->query( "TRUNCATE {$d}" );
	$wpdb->insert( $s, array( 'object_type' => 'gallery', 'object_id' => ${galleryId}, 'views' => 999, 'shares' => 3, 'last_viewed' => current_time( 'mysql', true ) ) );
	foreach ( ${JSON.stringify(DAILY).replace(/"/g, '').replace(/:/g, ' => ').replace(/^\{/, 'array( ').replace(/\}$/, ' )')} as $age => $views ) {
		$wpdb->insert( $d, array( 'object_type' => 'gallery', 'object_id' => ${galleryId}, 'viewed_date' => wp_date( 'Y-m-d', time() - $age * DAY_IN_SECONDS ), 'views' => $views, 'shares' => 0 ) );
	}
	$wpdb->insert( $d, array( 'object_type' => 'gallery', 'object_id' => ${galleryId}, 'viewed_date' => wp_date( 'Y-m-d', time() - DAY_IN_SECONDS ), 'views' => 0, 'shares' => 3 ) );`);
});

test.afterAll(() => {
	wpEval(`global $wpdb;
	foreach ( ${TABLES} as $t ) {
		$src = $wpdb->prefix . $t;
		$wpdb->query( "TRUNCATE {$src}" );
		$wpdb->query( "INSERT INTO {$src} SELECT * FROM {$src}_e2e_page_bak" );
		$wpdb->query( "DROP TABLE {$src}_e2e_page_bak" );
	}
	wp_delete_post( ${galleryId}, true );`);
});

function statsRead(request: Request): string | null {
	const url = decodeURIComponent(request.url());
	const match = url.match(
		/\/fotogrids\/v1\/admin\/stats\/([a-z-]+)\?days=(\d+)/
	);
	return match ? `${match[1]}:${match[2]}` : null;
}

/** The reads a period selection sends, in any order. */
function collectReads(page: Page): string[] {
	const reads: string[] = [];
	page.on('request', (request) => {
		const read = statsRead(request);
		if (read) {
			reads.push(read);
		}
	});
	return reads;
}

/** The views chart's datasets, read off the Chart.js instance on its canvas. */
function viewsChart(page: Page) {
	return page.evaluate(() => {
		const canvas = document.querySelectorAll('.fg-stats-charts canvas')[0];
		// @ts-expect-error Chart.js is a page global.
		const chart = window.Chart?.getChart(canvas);
		return chart
			? {
					labels: chart.data.labels.length,
					sets: chart.data.datasets.map(
						(set: { label: string; data: number[] }) => [
							set.label,
							set.data,
						]
					),
				}
			: null;
	});
}

function card(page: Page, label: string) {
	return page.locator('.fg-stat-card').filter({
		has: page.locator('.fg-stat-card__label', {
			hasText: new RegExp(`^${label}$`),
		}),
	});
}

/** The site-local "M j" date `age` days ago, as the trend reports it. */
function siteDay(age: number): string {
	return wpEval(
		`echo wp_date( 'M j', time() - ${age} * DAY_IN_SECONDS );`
	).trim();
}

/**
 * STAT-06, STAT-07. Over 7 days the Views card shows this week's 12 against
 * last week's 6 as a 100% rise, with the all-time total as a footnote; with
 * no shares in the week before, Interactions shows no trend at all. The views
 * chart plots both weeks day by day, the current one oldest first.
 */
test(
	'STAT-06, STAT-07: the 7-day cards and chart compare this week with the last',
	{ tag: '@admin' },
	async ({ page }) => {
		const reads = collectReads(page);
		const overview = page.waitForResponse((r) =>
			decodeURIComponent(r.url()).includes('/admin/stats/overview?days=7')
		);

		await page.goto(SCREEN);
		const trend = (await (await overview).json()).trend;

		expect(trend).toMatchObject({
			days: 7,
			views: 12,
			views_previous: 6,
			shares: 3,
			shares_previous: 0,
			previous_start: siteDay(13),
			previous_end: siteDay(7),
		});

		await expect(
			card(page, 'Views').locator('.fg-stat-card__value')
		).toHaveText('12');
		await expect(
			card(page, 'Views').locator('.fg-stat-card__delta--up')
		).toHaveText('↑100%');
		await expect(
			card(page, 'Views').locator('.fg-stat-card__footnote')
		).toHaveText('Total 999');
		await expect(
			card(page, 'Interactions').locator('.fg-stat-card__value')
		).toHaveText('3');
		await expect(
			card(page, 'Interactions').locator('.fg-stat-card__delta')
		).toHaveCount(0);
		await expect(
			card(page, 'Interactions').locator('.fg-stat-card__footnote')
		).toHaveCount(0);

		await expect
			.poll(() => viewsChart(page))
			.toEqual({
				labels: 7,
				sets: [
					['Views', [3, 0, 0, 4, 0, 0, 5]],
					['Previous period', [3, 0, 0, 1, 0, 0, 2]],
				],
			});
		expect(reads.sort()).toEqual(READS.map((read) => `${read}:7`).sort());
		await expect(page.locator('.fg-stats-empty')).toHaveCount(0);
	}
);

/**
 * STAT-06. Each period button sends the five reads for its window at once,
 * marks itself pressed, records itself in the URL and redraws the chart with a
 * point per day. Thirty days take in every seeded row and leave nothing before
 * them, so the trend is withheld.
 */
test(
	'STAT-06: the period switch refetches all five reads and redraws for its window',
	{ tag: '@admin' },
	async ({ page }) => {
		await page.goto(SCREEN);
		await expect.poll(() => viewsChart(page)).not.toBeNull();

		for (const days of [30, 90, 7]) {
			const reads = collectReads(page);
			const button = page
				.getByRole('group', { name: 'Time period' })
				.getByRole('button', { name: `${days} Days` });

			await button.click();
			await expect(button).toHaveAttribute('aria-pressed', 'true');
			await expect
				.poll(() => reads.slice().sort())
				.toEqual(READS.map((read) => `${read}:${days}`).sort());
			expect(
				new URL(page.url()).searchParams.get('fg_stats_period')
			).toBe(String(days));
			await expect
				.poll(async () => (await viewsChart(page))?.labels)
				.toBe(days);
		}

		await page.getByRole('button', { name: '30 Days' }).click();
		await expect(
			card(page, 'Views').locator('.fg-stat-card__value')
		).toHaveText('68');
		await expect(
			card(page, 'Views').locator('.fg-stat-card__delta')
		).toHaveCount(0);

		await page.reload();
		await expect(
			page.getByRole('button', { name: '30 Days' })
		).toHaveAttribute('aria-pressed', 'true');
	}
);

/**
 * STAT-08. A site with no galleries and no views gets the "No statistics yet"
 * panel in place of empty charts. The reads are answered as a fresh install
 * would answer them; this site has galleries.
 */
test(
	'STAT-08: an empty site shows the No statistics yet panel',
	{ tag: '@admin' },
	async ({ page }) => {
		await page.route(/admin%2Fstats%2F|admin\/stats\//, async (route) => {
			const read = statsRead(route.request())?.split(':')[0];
			const empty: Record<string, unknown> = {
				overview: {
					galleries: 0,
					albums: 0,
					items: 0,
					views: 0,
					shares: 0,
					trend: null,
				},
				views: { labels: [], data: [], previous: [] },
				'popular-galleries': { labels: [], data: [], total: 0 },
			};
			await route.fulfill({ json: empty[read ?? ''] ?? [] });
		});

		await page.goto(SCREEN);

		const panel = page.locator('.fg-stats-empty');
		await expect(
			panel.getByRole('heading', { name: 'No statistics yet' })
		).toBeVisible();
		await expect(panel).toContainText(
			'Your gallery stats will appear here once visitors start viewing your galleries.'
		);
		await expect(page.locator('.fg-chart-empty')).toHaveText(
			'No gallery views in this period.'
		);
	}
);
