<?php
namespace FotoGrids;

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

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * Statistics is the data layer for the custom fotogrids_statistics
	 * table(s). The WPDB sniffs below are suppressed class-wide:
	 *
	 *  - DirectDatabaseQuery.DirectQuery: custom tables with no WP_Query /
	 *    core API equivalent; direct $wpdb access is required.
	 *  - DirectDatabaseQuery.NoCaching: counters are written on view/share
	 *    events and read for admin reporting; caching a constantly-mutating
	 *    counter would be counterproductive, so it is an intentional non-goal.
	 *  - PreparedSQL.NotPrepared / PreparedSQL.InterpolatedNotPrepared /
	 *    Security.DirectDB.UnescapedDBParameter: every interpolated table
	 *    name is `$wpdb->prefix . 'fotogrids_*'` (a trusted literal — WP
	 *    placeholders cannot bind table identifiers). All user-supplied
	 *    *values* are passed through $wpdb->prepare(); where SQL is built
	 *    incrementally the prepare call is a separate statement from the
	 *    get_*()/query() call, which the sniff cannot follow.
	 * ---------------------------------------------------------------------
	 */
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

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

		// Validate parameters
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

		// Try to update existing record first
		$updated = $wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
             SET $field = $field + %d,
                 last_viewed = NOW(),
                 updated_at = NOW()
             WHERE object_type = %s AND object_id = %d",
				$amount,
				$object_type,
				$object_id
			)
		);

		if ( false === $updated ) {
			return false;
		}

		// If no rows were updated, insert a new record
		if ( 0 === $updated ) {
			$data = array(
				'object_type' => $object_type,
				'object_id'   => $object_id,
				'views'       => ( 'views' === $field ) ? $amount : 0,
				'shares'      => ( 'shares' === $field ) ? $amount : 0,
				'last_viewed' => current_time( 'mysql', true ),
				'created_at'  => current_time( 'mysql', true ),
				'updated_at'  => current_time( 'mysql', true ),
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
					"INSERT INTO $daily_table (object_type, object_id, viewed_date, views, shares)
                 VALUES (%s, %d, %s, %d, 0)
                 ON DUPLICATE KEY UPDATE views = views + %d",
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
					"INSERT INTO $daily_table (object_type, object_id, viewed_date, views, shares)
                 VALUES (%s, %d, %s, 0, %d)
                 ON DUPLICATE KEY UPDATE shares = shares + %d",
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
				"SELECT * FROM $table WHERE object_type = %s AND object_id = %d",
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
	 * Get top performing objects by views
	 *
	 * @param string $object_type Type of object
	 * @param int $limit Number of results to return
	 * @param int $days Number of days to look back (0 for all time)
	 * @return array Array of objects with statistics
	 */
	public static function get_top_by_views( $object_type, $limit = 10, $days = 0 ) {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';
		$limit = (int) $limit;

		$where_date = '';
		$params     = array( $object_type );

		if ( $days > 0 ) {
			$where_date = ' AND last_viewed >= DATE_SUB(NOW(), INTERVAL %d DAY)';
			$params[]   = $days;
		}

		$params[] = $limit;

		$sql = "SELECT object_id, views, shares, last_viewed
                FROM $table
                WHERE object_type = %s $where_date
                ORDER BY views DESC
                LIMIT %d";

		$results = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );

		// Enrich with object data
		$enriched = array();
		foreach ( $results as $row ) {
			$object_data = self::get_object_data( $object_type, $row['object_id'] );
			if ( $object_data ) {
				$enriched[] = array_merge( $row, $object_data );
			}
		}

		return $enriched;
	}

	/**
	 * Get top performing objects by shares
	 *
	 * @param string $object_type Type of object
	 * @param int $limit Number of results to return
	 * @param int $days Number of days to look back (0 for all time)
	 * @return array Array of objects with statistics
	 */
	public static function get_top_by_shares( $object_type, $limit = 10, $days = 0 ) {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';
		$limit = (int) $limit;

		$where_date = '';
		$params     = array( $object_type );

		if ( $days > 0 ) {
			$where_date = ' AND last_viewed >= DATE_SUB(NOW(), INTERVAL %d DAY)';
			$params[]   = $days;
		}

		$params[] = $limit;

		$sql = "SELECT object_id, views, shares, last_viewed
                FROM $table
                WHERE object_type = %s $where_date
                ORDER BY shares DESC
                LIMIT %d";

		$results = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );

		// Enrich with object data
		$enriched = array();
		foreach ( $results as $row ) {
			$object_data = self::get_object_data( $object_type, $row['object_id'] );
			if ( $object_data ) {
				$enriched[] = array_merge( $row, $object_data );
			}
		}

		return $enriched;
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
			"SELECT
                SUM(views) as total_views,
                SUM(shares) as total_shares,
                COUNT(DISTINCT object_id) as total_objects
             FROM $table",
			ARRAY_A
		);

		return array(
			'total_views'   => (int) $result['total_views'],
			'total_shares'  => (int) $result['total_shares'],
			'total_objects' => (int) $result['total_objects'],
		);
	}

	/**
	 * Get statistics over time
	 *
	 * @param string $object_type Type of object
	 * @param int $object_id Specific object ID (optional)
	 * @param int $days Number of days to look back
	 * @return array Time series data
	 */
	public static function get_time_series( $object_type, $object_id = null, $days = 30 ) {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';

		$where_conditions = array( 'object_type = %s' );
		$params           = array( $object_type );

		if ( $object_id ) {
			$where_conditions[] = 'object_id = %d';
			$params[]           = $object_id;
		}

		$where_conditions[] = 'last_viewed >= DATE_SUB(NOW(), INTERVAL %d DAY)';
		$params[]           = $days;

		$where_sql = implode( ' AND ', $where_conditions );

		$sql = "SELECT
                    DATE(last_viewed) as date,
                    SUM(views) as daily_views,
                    SUM(shares) as daily_shares
                FROM $table
                WHERE $where_sql
                GROUP BY DATE(last_viewed)
                ORDER BY date ASC";

		return $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
	}

	/**
	 * Clean up old statistics data
	 *
	 * @param int $days Number of days to keep (older data will be deleted)
	 * @return int Number of rows deleted
	 */
	public static function cleanup_old_data( $days = 365 ) {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_statistics';

		$deleted = $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM $table WHERE last_viewed < DATE_SUB(NOW(), INTERVAL %d DAY)",
				$days
			)
		);

		return $deleted;
	}

	/**
	 * Get object data based on type and ID
	 *
	 * @param string $object_type Type of object
	 * @param int $object_id ID of the object
	 * @return array|null Object data or null if not found
	 */
	private static function get_object_data( $object_type, $object_id ) {
		switch ( $object_type ) {
			case 'gallery':
				$post = get_post( $object_id );
				if ( $post && 'fotogrids_gallery' === $post->post_type ) {
					return array(
						'title'     => $post->post_title,
						'url'       => get_permalink( $post->ID ),
						'thumbnail' => \FotoGrids\Galleries\Cover_Resolver::url_for_collection( $post->ID, 'thumbnail' ),
					);
				}
				break;

			case 'album':
				$post = get_post( $object_id );
				if ( $post && 'fotogrids_album' === $post->post_type ) {
					return array(
						'title'     => $post->post_title,
						'url'       => get_permalink( $post->ID ),
						'thumbnail' => \FotoGrids\Galleries\Cover_Resolver::url_for_collection( $post->ID, 'thumbnail' ),
					);
				}
				break;

			case 'item':
				$attachment = get_post( $object_id );
				if ( $attachment && 'attachment' === $attachment->post_type ) {
					return array(
						'title'     => $attachment->post_title,
						'url'       => wp_get_attachment_url( $object_id ),
						'thumbnail' => wp_get_attachment_image_url( $object_id, 'thumbnail' ),
					);
				}
				break;
		}

		return null;
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
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}

add_action( 'init', array( 'FotoGrids\Statistics', 'init_cleanup_schedule' ) );
add_action( Actions_Cron::STATS_CLEANUP, array( 'FotoGrids\Statistics', 'run_scheduled_cleanup' ) );
