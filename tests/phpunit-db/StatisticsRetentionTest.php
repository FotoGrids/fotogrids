<?php
/**
 * The scheduled statistics cleanup and the retention period.
 *
 * @package FotoGrids
 */

use FotoGrids\Hooks\Actions_Cron;
use FotoGrids\Hooks\Filters_Settings;
use FotoGrids\Statistics;

class StatisticsRetentionTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}fotogrids_statistics" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}fotogrids_statistics_daily" );
	}

	private function collection( string $post_type = 'fotogrids_gallery' ): int {
		return self::factory()->post->create(
			array(
				'post_type'   => $post_type,
				'post_status' => 'publish',
			)
		);
	}

	/** A totals row last viewed `$idle_days` ago. */
	private function totals( string $type, int $id, int $views, int $idle_days ): void {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'fotogrids_statistics',
			array(
				'object_type' => $type,
				'object_id'   => $id,
				'views'       => $views,
				'shares'      => 1,
				'last_viewed' => gmdate( 'Y-m-d H:i:s', time() - $idle_days * DAY_IN_SECONDS ),
			)
		);
	}

	/** One daily row per age in days, dated in the site timezone. */
	private function daily( string $type, int $id, array $ages ): void {
		global $wpdb;
		foreach ( $ages as $age ) {
			$wpdb->insert(
				$wpdb->prefix . 'fotogrids_statistics_daily',
				array(
					'object_type' => $type,
					'object_id'   => $id,
					'viewed_date' => wp_date( 'Y-m-d', time() - $age * DAY_IN_SECONDS ),
					'views'       => 1,
					'shares'      => 0,
				)
			);
		}
	}

	/** @return string[] */
	private function daily_dates( string $type, int $id ): array {
		global $wpdb;
		return $wpdb->get_col(
			$wpdb->prepare(
				"SELECT viewed_date FROM {$wpdb->prefix}fotogrids_statistics_daily WHERE object_type = %s AND object_id = %d ORDER BY viewed_date",
				$type,
				$id
			)
		);
	}

	/** @return string[] */
	private function dates( array $ages ): array {
		rsort( $ages );
		return array_map(
			static function ( $age ) {
				return wp_date( 'Y-m-d', time() - $age * DAY_IN_SECONDS );
			},
			$ages
		);
	}

	private function run_cleanup(): void {
		do_action( Actions_Cron::STATS_CLEANUP );
	}

	public function test_a_collection_unviewed_past_the_retention_period_keeps_its_totals(): void {
		$active = $this->collection();
		$idle   = $this->collection();
		$album  = $this->collection( 'fotogrids_album' );
		$this->totals( 'gallery', $active, 500, 2 );
		$this->totals( 'gallery', $idle, 40, 400 );
		$this->totals( 'album', $album, 7, 400 );
		$this->totals( 'item', 9001, 3, 400 );

		$this->run_cleanup();

		$this->assertSame( 40, Statistics::get( 'gallery', $idle )['views'] );
		$this->assertSame( 7, Statistics::get( 'album', $album )['views'] );
		$this->assertSame( 3, Statistics::get( 'item', 9001 )['views'] );
		$this->assertSame( 550, Statistics::get_totals()['total_views'] );
		$this->assertSame( 4, Statistics::get_totals()['total_shares'] );
	}

	public function test_daily_history_older_than_the_retention_period_is_deleted(): void {
		$gallery = $this->collection();
		$this->totals( 'gallery', $gallery, 10, 0 );
		$this->daily( 'gallery', $gallery, array( 400, 366, 365, 30, 0 ) );

		$this->run_cleanup();

		$this->assertSame( $this->dates( array( 365, 30, 0 ) ), $this->daily_dates( 'gallery', $gallery ) );
	}

	public function test_a_retention_period_of_zero_deletes_nothing(): void {
		add_filter( Filters_Settings::STATS_RETENTION_DAYS, '__return_zero' );

		$gallery = $this->collection();
		$this->totals( 'gallery', $gallery, 10, 400 );
		$this->daily( 'gallery', $gallery, array( 400, 30, 0 ) );

		$this->run_cleanup();

		$this->assertSame( 10, Statistics::get( 'gallery', $gallery )['views'] );
		$this->assertSame( $this->dates( array( 400, 30, 0 ) ), $this->daily_dates( 'gallery', $gallery ) );
	}
}
