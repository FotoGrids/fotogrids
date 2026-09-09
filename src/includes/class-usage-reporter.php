<?php
/**
 * Anonymous usage reporting, gated on the site owner's usage-data consent.
 *
 * @package FotoGrids
 * @since   1.1.2
 */

namespace FotoGrids;

use FotoGrids\Hooks\Actions_Cron;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Collects and sends the anonymous usage report described in readme.txt.
 *
 * Registered outside the `is_admin()` guard because both of its triggers run
 * in non-admin contexts: WP-Cron dispatches the scheduled event from
 * `wp-cron.php`, and the Settings tab writes the consent option over REST.
 */
class Usage_Reporter {

	/**
	 * Collector endpoint.
	 *
	 * @since 1.1.2
	 */
	const ENDPOINT = 'https://www.fotogrids.com/wp-json/fotogrids/v1/statistics';

	/**
	 * Option holding the site owner's usage-data consent.
	 *
	 * @since 1.1.2
	 */
	const OPTION_CONSENT = 'fotogrids_share_statistics';

	/**
	 * Transient marking a recent send, throttling the report to once a day.
	 *
	 * @since 1.1.2
	 */
	const THROTTLE_KEY = 'fotogrids_stats_last_sent';

	/**
	 * Register the consent listener and the scheduled-event listener.
	 *
	 * @since  1.1.2
	 * @return void
	 */
	public static function init(): void {
		add_action( 'update_option_' . self::OPTION_CONSENT, array( __CLASS__, 'handle_consent_change' ), 10, 2 );
		add_action( Actions_Cron::SEND_STATISTICS, array( __CLASS__, 'send' ) );
	}

	/**
	 * Whether the site owner has opted in to usage-data sharing.
	 *
	 * @since  1.1.2
	 * @return bool
	 */
	public static function is_enabled(): bool {
		return (bool) get_option( self::OPTION_CONSENT, false );
	}

	/**
	 * Queue a report, at most once per day.
	 *
	 * @since  1.1.2
	 * @return void
	 */
	public static function schedule(): void {
		if ( ! self::is_enabled() ) {
			return;
		}

		if ( false !== get_transient( self::THROTTLE_KEY ) ) {
			return;
		}

		if ( wp_next_scheduled( Actions_Cron::SEND_STATISTICS ) ) {
			return;
		}

		wp_schedule_single_event( time() + 10, Actions_Cron::SEND_STATISTICS );
	}

	/**
	 * Send on opt-in, cancel any pending report on opt-out.
	 *
	 * @since  1.1.2
	 * @param  mixed $old_value Previous option value.
	 * @param  mixed $new_value New option value.
	 * @return void
	 */
	public static function handle_consent_change( $old_value, $new_value ): void {
		if ( $new_value ) {
			self::send();
			return;
		}

		wp_clear_scheduled_hook( Actions_Cron::SEND_STATISTICS );
		delete_transient( self::THROTTLE_KEY );
	}

	/**
	 * Send the report, if there is anything to say and consent allows it.
	 *
	 * @since  1.1.2
	 * @return void
	 */
	public static function send(): void {
		if ( ! self::is_enabled() ) {
			return;
		}

		$payload = self::payload();

		if ( '' === $payload['persona'] && empty( $payload['review_stats'] ) ) {
			return;
		}

		set_transient( self::THROTTLE_KEY, time(), DAY_IN_SECONDS );

		wp_remote_post(
			self::ENDPOINT,
			array(
				'body'     => wp_json_encode( $payload ),
				'headers'  => array( 'Content-Type' => 'application/json' ),
				'timeout'  => 15,
				'blocking' => false,
			)
		);
	}

	/**
	 * Build the report body.
	 *
	 * `site_id` is the random identifier minted at activation. The site URL is
	 * deliberately not sent, which is what lets readme.txt call this anonymous.
	 *
	 * @since  1.1.2
	 * @return array<string, mixed>
	 */
	private static function payload(): array {
		return array(
			'site_id'        => (string) get_option( 'fotogrids_site_id', '' ),
			'plugin_version' => FOTOGRIDS_VERSION,
			'wp_version'     => get_bloginfo( 'version' ),
			'php_version'    => PHP_VERSION,
			'persona'        => (string) get_option( 'fotogrids_user_persona', '' ),
			'review_stats'   => get_option( 'fotogrids_review_stats', array() ),
			'timestamp'      => current_time( 'mysql' ),
		);
	}
}
