<?php
/**
 * Statistics::increment() on the totals table.
 *
 * @package FotoGrids
 */

use FotoGrids\Statistics;

class StatisticsIncrementTest extends WP_UnitTestCase {

	private const GALLERY = 4242;

	public function set_up(): void {
		parent::set_up();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}fotogrids_statistics" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}fotogrids_statistics_daily" );
	}

	/** Has another request create the totals row just before the next write to it. */
	private function race_the_next_write(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';
		$raced = false;

		add_filter(
			'query',
			static function ( $query ) use ( $wpdb, $table, &$raced ) {
				if ( ! $raced && preg_match( '/^\s*INSERT INTO `?' . preg_quote( $table, '/' ) . '`?\s/i', $query ) ) {
					$raced = true;
					$wpdb->insert(
						$table,
						array(
							'object_type' => 'gallery',
							'object_id'   => self::GALLERY,
							'views'       => 1,
						)
					);
				}
				return $query;
			}
		);
	}

	public function test_the_first_view_creates_the_row_and_the_next_adds_to_it(): void {
		$this->assertTrue( Statistics::increment( 'gallery', self::GALLERY, 'views' ) );
		$this->assertTrue( Statistics::increment( 'gallery', self::GALLERY, 'views' ) );

		$this->assertSame( 2, Statistics::get( 'gallery', self::GALLERY )['views'] );
	}

	public function test_the_first_share_creates_the_row_with_no_views(): void {
		$this->assertTrue( Statistics::increment( 'gallery', self::GALLERY, 'shares' ) );

		$stats = Statistics::get( 'gallery', self::GALLERY );
		$this->assertSame( 1, $stats['shares'] );
		$this->assertSame( 0, $stats['views'] );
	}

	public function test_a_view_racing_another_first_view_still_counts(): void {
		$this->race_the_next_write();

		$this->assertTrue( Statistics::increment( 'gallery', self::GALLERY, 'views' ) );
		$this->assertSame( 2, Statistics::get( 'gallery', self::GALLERY )['views'] );
	}
}
