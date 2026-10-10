import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { fixture } from './support/fixtures';
import { storageStateFor, wpEval } from './support/roles';
import { getOption, setOption } from './support/site';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The scheduled statistics cleanup applies the retention period to the
 * per-day history and keeps every totals row.
 *
 * Daily rows carry the site-local date, so the boundary day is checked in
 * timezones on both sides of UTC. The cleanup is fired through wp-cron.php,
 * the way WordPress runs it, not by calling the method.
 *
 * Serial: these rewrite both statistics tables, the site timezone and an
 * mu-plugin, and put all three back.
 */

test.describe.configure( { mode: 'serial' } );

const HOOK = 'fotogrids/cron/stats_cleanup';
const TABLES = [ 'fotogrids_statistics', 'fotogrids_statistics_daily' ];
const MU_PLUGIN = path.join(
	process.env.WP_PATH ?? '',
	'wp-content',
	'mu-plugins',
	'fg-e2e-stats-retention.php'
);

type Row = { date: string; views: number };

/** Copy both tables aside, so the suite's other specs see them unchanged. */
function backUp(): void {
	wpEval( `global $wpdb;
	foreach ( ${ JSON.stringify( TABLES ).replace( /"/g, "'" ) } as $t ) {
		$src = $wpdb->prefix . $t;
		$wpdb->query( "DROP TABLE IF EXISTS {$src}_e2e_bak" );
		$wpdb->query( "CREATE TABLE {$src}_e2e_bak LIKE {$src}" );
		$wpdb->query( "INSERT INTO {$src}_e2e_bak SELECT * FROM {$src}" );
	}` );
}

function restore(): void {
	wpEval( `global $wpdb;
	foreach ( ${ JSON.stringify( TABLES ).replace( /"/g, "'" ) } as $t ) {
		$src = $wpdb->prefix . $t;
		$wpdb->query( "TRUNCATE {$src}" );
		$wpdb->query( "INSERT INTO {$src} SELECT * FROM {$src}_e2e_bak" );
		$wpdb->query( "DROP TABLE {$src}_e2e_bak" );
	}` );
}

/**
 * Replace both tables' rows: one daily row per age in days, dated in the site
 * timezone, and one totals row viewed `idleDays` ago.
 */
function seed( galleryId: number, ages: number[], idleDays = 1 ): void {
	wpEval( `global $wpdb;
	$s = $wpdb->prefix . 'fotogrids_statistics';
	$d = $wpdb->prefix . 'fotogrids_statistics_daily';
	$wpdb->query( "TRUNCATE {$s}" );
	$wpdb->query( "TRUNCATE {$d}" );
	$wpdb->insert( $s, array( 'object_type' => 'gallery', 'object_id' => ${ galleryId }, 'views' => 500, 'shares' => 0, 'last_viewed' => gmdate( 'Y-m-d H:i:s', time() - ${ idleDays } * DAY_IN_SECONDS ) ) );
	foreach ( ${ JSON.stringify( ages ) } as $age ) {
		$wpdb->insert( $d, array( 'object_type' => 'gallery', 'object_id' => ${ galleryId }, 'viewed_date' => wp_date( 'Y-m-d', time() - $age * DAY_IN_SECONDS ), 'views' => $age + 1, 'shares' => 0 ) );
	}` );
}

/** The site-local date `age` days ago, as the seeder wrote it. */
function siteDate( age: number ): string {
	return wpEval( `echo wp_date( 'Y-m-d', time() - ${ age } * DAY_IN_SECONDS );` ).trim();
}

function dailyRows(): Row[] {
	return JSON.parse(
		wpEval( `global $wpdb; echo wp_json_encode( $wpdb->get_results( "SELECT viewed_date AS date, CAST( views AS UNSIGNED ) AS views FROM {$wpdb->prefix}fotogrids_statistics_daily ORDER BY viewed_date", ARRAY_A ) );` )
	).map( ( r: { date: string; views: string } ) => ( { date: r.date, views: Number( r.views ) } ) );
}

function totalsRows(): number {
	return Number(
		wpEval( `global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_statistics" );` ).trim()
	);
}

/**
 * Queue the cleanup as a one-off due event and hit wp-cron.php with the lock it
 * expects, then confirm that event was consumed rather than trusting the
 * response code. The recurring event the plugin registers on init is ignored.
 */
async function runCleanup( request: APIRequestContext ): Promise< void > {
	const lock = wpEval( `
		wp_clear_scheduled_hook( '${ HOOK }' );
		wp_schedule_single_event( time() - 120, '${ HOOK }' );
		$lock = sprintf( '%.22F', microtime( true ) );
		set_transient( 'doing_cron', $lock );
		echo $lock;
	` ).trim();

	const response = await request.get( `/wp-cron.php?doing_wp_cron=${ lock }` );
	expect( response.status() ).toBe( 200 );

	const due = Number(
		wpEval( `
			$due = 0;
			foreach ( (array) _get_cron_array() as $hooks ) {
				foreach ( $hooks['${ HOOK }'] ?? array() as $event ) {
					$due += false === $event['schedule'] ? 1 : 0;
				}
			}
			echo $due;
		` ).trim()
	);
	expect( due, 'the queued cleanup ran' ).toBe( 0 );
}

/** The figures on the Statistics screen for a period. */
async function statsScreen( page: Page, days: number ): Promise< string > {
	await page.goto( `/wp-admin/admin.php?page=fotogrids-stats&fg_stats_period=${ days }` );
	const screen = page.locator( '#fotogrids-stats-page' );
	await expect( screen.getByText( 'Top Performing Content' ) ).toBeVisible();
	await page.waitForLoadState( 'networkidle' );
	return ( await screen.innerText() ).replace( /\s+/g, ' ' );
}

test.describe( 'statistics retention', () => {
	let galleryId: number;
	let timezone: string | null;

	test.beforeAll( () => {
		galleryId = fixture( 'F-small', 'gallery' );
		timezone = getOption( 'timezone_string' );
		backUp();
	} );

	test.afterAll( () => {
		restore();
		setOption( 'timezone_string', timezone ?? '' );
		if ( existsSync( MU_PLUGIN ) ) {
			unlinkSync( MU_PLUGIN );
		}
		wpEval( `wp_clear_scheduled_hook( '${ HOOK }' ); \\FotoGrids\\Statistics::init_cleanup_schedule();` );
	} );

	test( 'cleanup deletes daily rows older than the retention period and keeps the rest', { tag: [ '@admin' ] }, async ( {
		request,
	} ) => {
		seed( galleryId, [ 400, 366, 365, 364, 90, 30, 0 ] );

		await runCleanup( request );

		expect( dailyRows().map( ( r ) => r.date ) ).toEqual(
			[ 365, 364, 90, 30, 0 ].map( siteDate )
		);
		expect( totalsRows() ).toBe( 1 );
	} );

	test( 'cleanup leaves the Statistics screen unchanged for every period', { tag: [ '@admin' ] }, async ( {
		page,
		request,
	} ) => {
		seed( galleryId, [ 400, 366, 89, 30, 10, 1, 0 ] );

		const before: Record< number, string > = {};
		for ( const days of [ 7, 30, 90 ] ) {
			before[ days ] = await statsScreen( page, days );
		}

		await runCleanup( request );

		expect( dailyRows() ).toHaveLength( 5 );
		for ( const days of [ 7, 30, 90 ] ) {
			expect( await statsScreen( page, days ), `${ days }-day view` ).toBe( before[ days ] );
		}
	} );

	test( 'a gallery unviewed for longer than the retention period keeps its totals', { tag: [ '@admin' ] }, async ( {
		page,
		request,
	} ) => {
		seed( galleryId, [ 400, 0 ], 400 );

		const before: Record< number, string > = {};
		for ( const days of [ 7, 30, 90 ] ) {
			before[ days ] = await statsScreen( page, days );
		}

		await runCleanup( request );

		expect( totalsRows() ).toBe( 1 );
		for ( const days of [ 7, 30, 90 ] ) {
			expect( await statsScreen( page, days ), `${ days }-day view` ).toBe( before[ days ] );
		}
	} );

	test( 'a filtered retention period applies to the daily history', { tag: [ '@admin' ] }, async ( {
		request,
	} ) => {
		mkdirSync( path.dirname( MU_PLUGIN ), { recursive: true } );
		writeFileSync(
			MU_PLUGIN,
			"<?php\nadd_filter( 'fotogrids/settings/stats/retention_days', static function () {\n\treturn 30;\n} );\n"
		);

		try {
			seed( galleryId, [ 90, 31, 30, 29, 0 ] );

			await runCleanup( request );

			expect( dailyRows().map( ( r ) => r.date ) ).toEqual( [ 30, 29, 0 ].map( siteDate ) );
		} finally {
			unlinkSync( MU_PLUGIN );
		}
	} );

	for ( const zone of [ 'Pacific/Kiritimati', 'Pacific/Pago_Pago' ] ) {
		test( `the boundary day follows the site date in ${ zone }`, { tag: [ '@admin' ] }, async ( {
			request,
		} ) => {
			setOption( 'timezone_string', zone );
			seed( galleryId, [ 367, 366, 365, 364, 0 ] );

			await runCleanup( request );

			expect( dailyRows().map( ( r ) => r.date ) ).toEqual( [ 365, 364, 0 ].map( siteDate ) );
		} );
	}

	test( 'views recorded after a cleanup still reach the daily history', { tag: [ '@admin' ] }, async ( {
		browser,
		request,
	} ) => {
		setOption( 'timezone_string', timezone ?? '' );
		seed( galleryId, [ 400, 0 ] );
		await runCleanup( request );

		const today = siteDate( 0 );
		const viewsToday = () => dailyRows().find( ( r ) => r.date === today )?.views ?? 0;
		const before = viewsToday();

		const url = JSON.parse(
			wpEval( `echo wp_json_encode( array( 'url' => get_permalink( wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Statistics retention', 'post_content' => '[fotogrids_gallery id="${ galleryId }"]' ) ) ) ) );` )
		).url as string;

		const visitor = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
		try {
			const page = await visitor.newPage();
			const ping = page.waitForResponse( ( r ) => /stats(%2F|\/)view/.test( r.url() ) );
			await page.goto( url );
			expect( ( await ping ).status() ).toBe( 200 );
		} finally {
			await visitor.close();
			wpEval( `foreach ( get_posts( array( 'post_type' => 'page', 'title' => 'Statistics retention', 'post_status' => 'any', 'fields' => 'ids' ) ) as $id ) { wp_delete_post( $id, true ); }` );
		}

		expect( viewsToday() ).toBe( before + 1 );
		expect( dailyRows().map( ( r ) => r.date ) ).toEqual( [ today ] );
	} );
} );
