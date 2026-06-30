<?php
namespace FotoGrids\Admin;

if ( ! defined( 'WPINC' ) ) {
	die;
}

use FotoGrids\Hooks\Actions_Cron;
/**
 * Admin Footer Review Prompt Class
 *
 * Displays a review prompt in the admin footer on FotoGrids admin pages.
 * Tracks which message variants perform best.
 */
class Review_Prompt {

	/**
	 * Initialize the review prompt
	 */
	public static function init() {
		add_filter( 'admin_footer_text', array( __CLASS__, 'admin_footer_review' ), 99 );
		add_action( 'admin_init', array( __CLASS__, 'handle_review_click' ) );

		// Schedule statistics sending if enabled
		add_action( 'update_option_fotogrids_share_statistics', array( __CLASS__, 'handle_statistics_sharing_change' ), 10, 2 );
		add_action( Actions_Cron::SEND_STATISTICS, array( __CLASS__, 'send_statistics' ) );
	}

	/**
	 * Get review message variants
	 *
	 * @return array Array of message templates with %s placeholder for review URL
	 */
	public static function get_review_messages() {
		return array(
			'Enjoying <strong>FotoGrids</strong>? Your support helps us improve - <a href="%s" target="_blank" rel="noopener noreferrer">leave a ★★★★★ review</a>.',
			'Using <strong>FotoGrids</strong> on your site? Help support ongoing development by <a href="%s" target="_blank" rel="noopener noreferrer">leaving a ★★★★★ review</a>.',
			'<strong>FotoGrids</strong> is built for creators. You can support the project by <a href="%s" target="_blank" rel="noopener noreferrer">leaving a ★★★★★ review</a>.',
			'Finding <strong>FotoGrids</strong> useful? Support the plugin and <a href="%s" target="_blank" rel="noopener noreferrer">leave a ★★★★★ review</a>.',
		);
	}

	/**
	 * Check if review prompt should be shown
	 *
	 * @return bool True if prompt should be shown
	 */
	public static function should_show_review_prompt() {
		if ( ! is_admin() ) {
			return false;
		}

		if ( ! \FotoGrids\Admin\Admin_Screen::is_fotogrids() ) {
			return false;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return false;
		}

		$last_review_version = get_user_meta(
			$user_id,
			'_fotogrids_review_version',
			true
		);

		if ( empty( $last_review_version ) ) {
			return true;
		}

		// Re-show when the plugin version is newer than the last reviewed version.
		return version_compare(
			FOTOGRIDS_VERSION,
			$last_review_version,
			'>'
		);
	}

	/**
	 * Get a random message variant
	 *
	 * Returns a random message variant on each call to show different messages.
	 *
	 * @return int Message index (0-based)
	 */
	public static function get_random_message_variant() {
		$messages = self::get_review_messages();
		return array_rand( $messages );
	}

	/**
	 * Track that a message variant was shown
	 *
	 * @param int $variant_index Message variant index (0-based)
	 */
	public static function track_message_shown( $variant_index ) {
		$stats = get_option( 'fotogrids_review_stats', array() );

		if ( ! isset( $stats[ $variant_index ] ) ) {
			$stats[ $variant_index ] = array(
				'shown'   => 0,
				'clicked' => 0,
			);
		}

		++$stats[ $variant_index ]['shown'];

		update_option( 'fotogrids_review_stats', $stats );

		if ( self::is_statistics_sharing_enabled() ) {
			self::schedule_statistics_send();
		}
	}

	/**
	 * Track that a message variant was clicked
	 *
	 * @param int $variant_index Message variant index (0-based)
	 */
	public static function track_message_clicked( $variant_index ) {
		$stats = get_option( 'fotogrids_review_stats', array() );

		if ( ! isset( $stats[ $variant_index ] ) ) {
			$stats[ $variant_index ] = array(
				'shown'   => 0,
				'clicked' => 0,
			);
		}

		++$stats[ $variant_index ]['clicked'];

		update_option( 'fotogrids_review_stats', $stats );

		if ( self::is_statistics_sharing_enabled() ) {
			self::schedule_statistics_send();
		}
	}

	/**
	 * Get review statistics
	 *
	 * @return array Statistics array with 'shown' and 'clicked' counts per variant
	 */
	public static function get_review_stats() {
		return get_option( 'fotogrids_review_stats', array() );
	}

	/**
	 * Get review statistics with conversion rates
	 *
	 * Returns statistics including conversion rate (clicked/shown) for each variant.
	 * Useful for analyzing which message performs best.
	 *
	 * @return array Statistics array with 'shown', 'clicked', and 'conversion_rate' per variant
	 */
	public static function get_review_stats_with_conversion() {
		$stats    = self::get_review_stats();
		$messages = self::get_review_messages();

		$result        = array();
		$message_count = count( $messages );

		for ( $i = 0; $i < $message_count; $i++ ) {
			$shown           = isset( $stats[ $i ]['shown'] ) ? (int) $stats[ $i ]['shown'] : 0;
			$clicked         = isset( $stats[ $i ]['clicked'] ) ? (int) $stats[ $i ]['clicked'] : 0;
			$conversion_rate = $shown > 0 ? ( $clicked / $shown ) * 100 : 0;

			$result[ $i ] = array(
				'message'         => $messages[ $i ],
				'shown'           => $shown,
				'clicked'         => $clicked,
				'conversion_rate' => round( $conversion_rate, 2 ),
			);
		}

		return $result;
	}

	/**
	 * Admin footer review prompt filter
	 *
	 * @param string $footer_text Default footer text
	 * @return string Modified footer text
	 */
	public static function admin_footer_review( $footer_text ) {
		if ( ! self::should_show_review_prompt() ) {
			return $footer_text;
		}

		// Get random message variant
		$variant_index = self::get_random_message_variant();

		// Track that this variant was shown
		self::track_message_shown( $variant_index );

		// Build review URL with variant tracking
		$review_url = add_query_arg(
			array(
				'fotogrids_review' => '1',
				'variant'          => $variant_index,
			),
			admin_url()
		);

		$messages = self::get_review_messages();
		$message  = isset( $messages[ $variant_index ] ) ? $messages[ $variant_index ] : $messages[0];

		return sprintf(
			$message,
			esc_url( $review_url )
		);
	}

	/**
	 * Handle review link click
	 *
	 * Tracks the click, stores user meta, and redirects to WordPress.org reviews
	 */
	public static function handle_review_click() {
		// Read-only handling of a review-prompt click link in wp-admin: detects
		// the ?fotogrids_review marker and an absint() variant index, records
		// dismissal, and redirects. No state-changing form submission, so nonce
		// verification does not apply.
        // phpcs:disable WordPress.Security.NonceVerification.Recommended
		if ( ! is_admin() || ! isset( $_GET['fotogrids_review'] ) ) {
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return;
		}

		// Get variant index from URL
		$variant_index = isset( $_GET['variant'] ) ? absint( $_GET['variant'] ) : 0;

		// Validate variant index
		$messages = self::get_review_messages();
		if ( $variant_index < 0 || $variant_index >= count( $messages ) ) {
			$variant_index = 0;
		}

		// Track the click
		self::track_message_clicked( $variant_index );

		// Store that user clicked review for this version
		update_user_meta(
			$user_id,
			'_fotogrids_review_version',
			FOTOGRIDS_VERSION
		);

		wp_safe_redirect( 'https://wordpress.org/plugins/fotogrids/#reviews' );
		exit;
        // phpcs:enable WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Check if statistics sharing is enabled
	 *
	 * @return bool True if sharing is enabled
	 */
	public static function is_statistics_sharing_enabled() {
		return (bool) get_option( 'fotogrids_share_statistics', false );
	}

	/**
	 * Schedule statistics sending
	 *
	 * Uses WordPress transients to throttle sending (once per day)
	 */
	public static function schedule_statistics_send() {
		$last_sent = get_transient( 'fotogrids_stats_last_sent' );

		// Only send once per day
		if ( false === $last_sent ) {
			// Schedule for immediate sending (next page load)
			set_transient( 'fotogrids_stats_last_sent', time(), DAY_IN_SECONDS );
			wp_schedule_single_event( time() + 10, 'fotogrids_send_statistics' );
		}
	}

	/**
	 * Handle statistics sharing setting change
	 *
	 * @param mixed $old_value Previous value
	 * @param mixed $new_value New value
	 */
	public static function handle_statistics_sharing_change( $old_value, $new_value ) {
		if ( $new_value ) {
			// If enabled, send current stats immediately
			self::send_statistics();
		} else {
			// If disabled, clear scheduled sends
			wp_clear_scheduled_hook( Actions_Cron::SEND_STATISTICS );
		}
	}

	/**
	 * Send statistics to FotoGrids
	 *
	 * Sends anonymous review prompt statistics to FotoGrids servers
	 */
	public static function send_statistics() {
		if ( ! self::is_statistics_sharing_enabled() ) {
			return;
		}

		$stats = self::get_review_stats();

		if ( empty( $stats ) ) {
			return;
		}

		// Prepare anonymous data
		$data = array(
			'plugin_version' => FOTOGRIDS_VERSION,
			'wp_version'     => get_bloginfo( 'version' ),
			'php_version'    => PHP_VERSION,
			'site_url'       => home_url(),
			'stats'          => $stats,
			'timestamp'      => current_time( 'mysql' ),
		);

		// Send to FotoGrids API endpoint
		$response = wp_remote_post(
			'https://www.fotogrids.com/wp-json/fotogrids/v1/statistics',
			array(
				'body'     => wp_json_encode( $data ),
				'headers'  => array(
					'Content-Type' => 'application/json',
				),
				'timeout'  => 15,
				'blocking' => false, // Non-blocking request
			)
		);

		// Update last sent time
		set_transient( 'fotogrids_stats_last_sent', time(), DAY_IN_SECONDS );
	}
}
