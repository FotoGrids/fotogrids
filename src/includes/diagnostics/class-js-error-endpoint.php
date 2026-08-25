<?php
/**
 * Receives browser errors raised by FotoGrids scripts.
 *
 * @package FotoGrids\Diagnostics
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Diagnostics;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * JS Error Endpoint
 *
 * Registers the ingest route and enqueues the capture script.
 *
 * The script is only ever enqueued for users who can already see the System
 * Info tool, so there is no anonymous write surface: an error that reproduces
 * only for logged-out visitors is deliberately not captured.
 *
 * @since 1.0.0
 */
final class JS_Error_Endpoint {

	/**
	 * Reports accepted per user per window.
	 */
	private const RATE_LIMIT = 30;

	/**
	 * Rate-limit window, in seconds.
	 */
	private const RATE_WINDOW = 60;

	/**
	 * Capability required to report and to read.
	 */
	private const CAPABILITY = 'manage_fotogrids';

	/**
	 * Hooks the route and the asset.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( self::class, 'register_route' ) );
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue' ) );
	}

	/**
	 * Registers the ingest route.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function register_route(): void {
		register_rest_route(
			'fotogrids/v1',
			'/admin/diagnostics/js-error',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'handle' ),
					'permission_callback' => array( self::class, 'check_permission' ),
					'args'                => array(
						'message' => array(
							'type'     => 'string',
							'required' => true,
						),
						'file'    => array( 'type' => 'string' ),
						'line'    => array( 'type' => 'integer' ),
						'stack'   => array( 'type' => 'string' ),
						'url'     => array( 'type' => 'string' ),
					),
				),
			)
		);
	}

	/**
	 * Whether the current user may report an error.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	public static function check_permission(): bool {
		return current_user_can( self::CAPABILITY );
	}

	/**
	 * Stores one reported browser error.
	 *
	 * @since  1.0.0
	 * @param  \WP_REST_Request $request Incoming request.
	 * @return \WP_REST_Response
	 */
	public static function handle( \WP_REST_Request $request ): \WP_REST_Response {
		if ( ! self::within_rate_limit() ) {
			return new \WP_REST_Response( array( 'recorded' => false ), 429 );
		}

		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/diagnostics/class-error-store.php';

		$stack = sanitize_textarea_field( (string) $request->get_param( 'stack' ) );

		Error_Store::record(
			array(
				'type'    => 'js',
				'level'   => 'error',
				'message' => sanitize_text_field( (string) $request->get_param( 'message' ) ),
				'file'    => sanitize_text_field( (string) $request->get_param( 'file' ) ),
				'line'    => (int) $request->get_param( 'line' ),
				'source'  => 'free',
				'context' => array(
					'stack' => mb_substr( $stack, 0, 2000 ),
					'url'   => esc_url_raw( (string) $request->get_param( 'url' ) ),
					'agent' => sanitize_text_field( wp_unslash( (string) ( $_SERVER['HTTP_USER_AGENT'] ?? '' ) ) ),
				),
			)
		);

		Error_Store::flush();

		return new \WP_REST_Response( array( 'recorded' => true ), 200 );
	}

	/**
	 * Enqueues the capture script for users who can see the log.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function enqueue(): void {
		if ( ! is_user_logged_in() || ! current_user_can( self::CAPABILITY ) ) {
			return;
		}

		$handle  = 'fotogrids-error-capture';
		$version = defined( 'FOTOGRIDS_VERSION' ) ? FOTOGRIDS_VERSION : '1.0.0';

		wp_enqueue_script(
			$handle,
			FOTOGRIDS_PLUGIN_URL . 'includes/diagnostics/assets/error-capture.js',
			array(),
			$version,
			false
		);

		$paths = array( FOTOGRIDS_PLUGIN_URL );

		if ( defined( 'FOTOGRIDS_PRO_PLUGIN_URL' ) ) {
			$paths[] = FOTOGRIDS_PRO_PLUGIN_URL;
		}

		wp_localize_script(
			$handle,
			'fotogridsErrorCapture',
			array(
				'endpoint' => rest_url( 'fotogrids/v1/admin/diagnostics/js-error' ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'paths'    => array_values( array_unique( $paths ) ),
			)
		);
	}

	/**
	 * Whether the current user is under the per-window report limit.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	private static function within_rate_limit(): bool {
		$key   = 'fotogrids_js_errors_' . get_current_user_id();
		$count = (int) get_transient( $key );

		if ( $count >= self::RATE_LIMIT ) {
			return false;
		}

		set_transient( $key, $count + 1, self::RATE_WINDOW );

		return true;
	}
}
