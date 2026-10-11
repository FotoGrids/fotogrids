<?php
namespace FotoGrids;

use FotoGrids\Albums\Album_Repository;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_Cron;
use FotoGrids\Hooks\Filters_Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Statistics Class
 *
 * Handles statistics tracking and management for FotoGrids
 */
class Statistics {

	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom-table data layer; no core API or object cache applies.

	/**
	 * Increment a statistic counter
	 *
	 * @param string $object_type Type of object (gallery, album, item)
	 * @param int $object_id ID of the object
	 * @param string $field Field to increment (views, shares)
	 * @param int $amount Amount to increment by
	 * @return bool Success status
	 */
	public static function increment( $object_type, $object_id, $field = 'views', $amount = 1 ) {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';

		if ( ! in_array( $object_type, array( 'gallery', 'album', 'item' ), true ) ) {
			return false;
		}

		if ( ! in_array( $field, array( 'views', 'shares' ), true ) ) {
			return false;
		}

		$object_id = (int) $object_id;
		$amount    = (int) $amount;

		if ( $object_id <= 0 || $amount <= 0 ) {
			return false;
		}

		$now = current_time( 'mysql', true );

		$updated = $wpdb->query(
			$wpdb->prepare(
				'UPDATE %i
             SET %i = %i + %d,
                 last_viewed = %s,
                 updated_at = %s
             WHERE object_type = %s AND object_id = %d',
				$table,
				$field,
				$field,
				$amount,
				$now,
				$now,
				$object_type,
				$object_id
			)
		);

		if ( false === $updated ) {
			return false;
		}

		if ( 0 === $updated ) {
			$data = array(
				'object_type' => $object_type,
				'object_id'   => $object_id,
				'views'       => ( 'views' === $field ) ? $amount : 0,
				'shares'      => ( 'shares' === $field ) ? $amount : 0,
				'last_viewed' => $now,
				'created_at'  => $now,
				'updated_at'  => $now,
			);

			$inserted = $wpdb->insert(
				$table,
				$data,
				array( '%s', '%d', '%d', '%d', '%s', '%s', '%s' )
			);

			if ( false === $inserted ) {
				return false;
			}
		}

		// Also record in the per-day table so time-series charts are accurate.
		self::increment_daily( $object_type, $object_id, $field, $amount );

		return true;
	}

	/**
	 * Increment the per-day statistics counter.
	 *
	 * Uses INSERT … ON DUPLICATE KEY UPDATE so a single row per
	 * (object_type, object_id, viewed_date) is maintained automatically.
	 *
	 * @param string $object_type gallery|album|item
	 * @param int    $object_id
	 * @param string $field       views|shares
	 * @param int    $amount
	 */
	private static function increment_daily( $object_type, $object_id, $field, $amount ) {
		global $wpdb;

		$daily_table = $wpdb->prefix . 'fotogrids_statistics_daily';
		$today       = current_time( 'Y-m-d' );

		if ( 'views' === $field ) {
			$wpdb->query(
				$wpdb->prepare(
					'INSERT INTO %i (object_type, object_id, viewed_date, views, shares)
                 VALUES (%s, %d, %s, %d, 0)
                 ON DUPLICATE KEY UPDATE views = views + %d',
					$daily_table,
					$object_type,
					$object_id,
					$today,
					$amount,
					$amount
				)
			);
		} else {
			$wpdb->query(
				$wpdb->prepare(
					'INSERT INTO %i (object_type, object_id, viewed_date, views, shares)
                 VALUES (%s, %d, %s, 0, %d)
                 ON DUPLICATE KEY UPDATE shares = shares + %d',
					$daily_table,
					$object_type,
					$object_id,
					$today,
					$amount,
					$amount
				)
			);
		}
	}

	/**
	 * Get statistics for a specific object
	 *
	 * @param string $object_type Type of object
	 * @param int $object_id ID of the object
	 * @return array|null Statistics data or null if not found
	 */
	public static function get( $object_type, $object_id ) {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';

		$result = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE object_type = %s AND object_id = %d',
				$table,
				$object_type,
				$object_id
			),
			ARRAY_A
		);

		if ( $result ) {
			return array(
				'views'       => (int) $result['views'],
				'shares'      => (int) $result['shares'],
				'last_viewed' => $result['last_viewed'],
				'created_at'  => $result['created_at'],
				'updated_at'  => $result['updated_at'],
			);
		}

		return null;
	}

	/**
	 * Get total statistics
	 *
	 * @return array Total views and shares across all objects
	 */
	public static function get_totals() {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';

		$result = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT
                SUM(views) as total_views,
                SUM(shares) as total_shares,
                COUNT(DISTINCT object_id) as total_objects
             FROM %i',
				$table
			),
			ARRAY_A
		);

		return array(
			'total_views'   => (int) $result['total_views'],
			'total_shares'  => (int) $result['total_shares'],
			'total_objects' => (int) $result['total_objects'],
		);
	}

	/**
	 * Clean up old statistics data
	 *
	 * Deletes daily rows dated before the retention period. Totals rows are
	 * kept, so lifetime figures do not drop. A period of zero or less deletes
	 * nothing.
	 *
	 * @param int $days Number of days of daily history to keep.
	 * @return int Number of rows deleted
	 */
	public static function cleanup_old_data( $days = 365 ) {
		global $wpdb;

		$days = (int) $days;

		if ( $days <= 0 ) {
			return 0;
		}

		$daily_table = $wpdb->prefix . 'fotogrids_statistics_daily';
		$cutoff      = time() - ( $days * DAY_IN_SECONDS );

		return (int) $wpdb->query(
			$wpdb->prepare(
				'DELETE FROM %i WHERE viewed_date < %s',
				$daily_table,
				wp_date( 'Y-m-d', $cutoff )
			)
		);
	}

	/**
	 * Deletes the statistics of galleries and albums that have gone longer
	 * without a view than their Retain Statistics setting allows.
	 *
	 * Collections set to Forever keep their statistics. Item statistics are
	 * not covered.
	 *
	 * @since 1.3.0
	 * @return int Number of rows deleted.
	 */
	private static function cleanup_expired_collections() {
		global $wpdb;

		$table       = $wpdb->prefix . 'fotogrids_statistics';
		$daily_table = $wpdb->prefix . 'fotogrids_statistics_daily';

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT object_type, object_id, last_viewed FROM %i WHERE object_type IN ('gallery', 'album')",
				$table
			),
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return 0;
		}

		update_meta_cache( 'post', array_map( 'intval', wp_list_pluck( $rows, 'object_id' ) ) );

		$now     = time();
		$deleted = 0;

		foreach ( $rows as $row ) {
			$object_id = (int) $row['object_id'];
			$settings  = 'album' === $row['object_type']
				? Album_Repository::get_settings( $object_id )
				: Gallery_Repository::get_settings( $object_id );
			$window    = $settings['retain_statistics'] ?? 'forever';
			$days      = is_numeric( $window ) ? (int) $window : 0;

			if ( $days <= 0 || strtotime( $row['last_viewed'] . ' UTC' ) >= $now - ( $days * DAY_IN_SECONDS ) ) {
				continue;
			}

			$where    = array(
				'object_type' => $row['object_type'],
				'object_id'   => $object_id,
			);
			$deleted += (int) $wpdb->delete( $table, $where, array( '%s', '%d' ) );
			$deleted += (int) $wpdb->delete( $daily_table, $where, array( '%s', '%d' ) );
		}

		return $deleted;
	}

	/**
	 * Initialize scheduled cleanup
	 */
	public static function init_cleanup_schedule() {
		if ( ! wp_next_scheduled( Actions_Cron::STATS_CLEANUP ) ) {
			wp_schedule_event( time(), 'weekly', Actions_Cron::STATS_CLEANUP );
		}
	}

	/**
	 * Run scheduled cleanup
	 */
	public static function run_scheduled_cleanup() {
		$days_to_keep = apply_filters( Filters_Settings::STATS_RETENTION_DAYS, 365 );
		self::cleanup_old_data( $days_to_keep );
		self::cleanup_expired_collections();
	}

	// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
}

add_action( 'init', array( 'FotoGrids\Statistics', 'init_cleanup_schedule' ) );
add_action( Actions_Cron::STATS_CLEANUP, array( 'FotoGrids\Statistics', 'run_scheduled_cleanup' ) );
