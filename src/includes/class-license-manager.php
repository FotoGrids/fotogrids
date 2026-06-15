<?php
namespace FotoGrids;

use FotoGrids\Hooks\Actions_Cron;
use FotoGrids\Hooks\Filters_Features;
use FotoGrids\Hooks\Filters_Licensing;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * License Manager Class.
 * Handles license verification and Pro feature checks.
 *
 * @since 1.0.0
 */
class License_Manager {

	/**
	 * Active license provider, resolved lazily.
	 *
	 * @var \FotoGrids\Licensing\License_Provider|null
	 */
	protected static $provider = null;

	/**
	 * License response cache
	 *
	 * @var array|null
	 */
	protected static $license_response_cache = null;

	/**
	 * Cache expiration time (in seconds)
	 *
	 * @var int
	 */
	private static $cache_duration = 3600; // 1 hour

	/**
	 * Grace period in seconds (7 days)
	 *
	 * @var int
	 */
	private static $grace_period = 7 * DAY_IN_SECONDS;

	/**
	 * Initialize the license manager
	 *
	 * @since 1.0.0
	 */
	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'maybe_verify_license' ), 20 );
		add_action( 'activated_plugin', array( __CLASS__, 'clear_cache_on_plugin_change' ), 10, 2 );
		add_action( 'deactivated_plugin', array( __CLASS__, 'clear_cache_on_plugin_change' ), 10, 2 );
		add_action( Actions_Cron::VERIFY_LICENSE, array( __CLASS__, 'verify_license_from_server' ) );
	}

	/**
	 * Check if a specific Pro feature is enabled.
	 *
	 * @since 1.0.0
	 * @param string $feature_name Feature identifier
	 * @return bool True if feature is enabled
	 */
	public static function feature_enabled( $feature_name ) {
		return apply_filters( Filters_Features::PRO_CAN_USE, false, $feature_name );
	}

	/**
	 * Filter callback: Check if Pro feature can be used.
	 *
	 * @since 1.0.0
	 * @param bool   $can_use Default false
	 * @param string $feature_name Feature identifier
	 * @return bool True if feature is enabled
	 */
	public static function can_use_pro_feature( $can_use, $feature_name ) {
		if ( ! defined( 'FOTOGRIDS_PRO_VERSION' ) ) {
			return false;
		}

		$license_response = self::get_license_response();

		if ( ! $license_response || ! isset( $license_response['status'] ) ) {
			return false;
		}

		if ( 'valid' !== $license_response['status'] ) {
			return false;
		}

		$features = isset( $license_response['features'] ) && is_array( $license_response['features'] )
			? $license_response['features']
			: array();

		if ( empty( $features ) ) {
			return true;
		}

		return in_array( $feature_name, $features, true );
	}

	/**
	 * Get all enabled features.
	 *
	 * @since 1.0.0
	 * @return array Array of enabled feature names
	 */
	public static function get_enabled_features() {
		$license_response = self::get_license_response();

		if ( ! $license_response || 'valid' !== $license_response['status'] ) {
			return array();
		}

		return isset( $license_response['features'] ) && is_array( $license_response['features'] )
			? $license_response['features']
			: array();
	}

	/**
	 * Get license response from cache or server.
	 *
	 * Server is source of truth, cache is for performance only.
	 *
	 * @since 1.0.0
	 * @return array|null License response array or null if invalid
	 */
	protected static function get_license_response() {
		// Check cache first
		if ( null !== self::$license_response_cache ) {
			return self::$license_response_cache;
		}

		// Check transient cache
		$cached = get_transient( 'fotogrids_license_response' );

		if ( false !== $cached ) {
			$cached_data = maybe_unserialize( $cached );

			// Verify cached data integrity
			if ( is_array( $cached_data ) && isset( $cached_data['signature'] ) ) {
				// Verify signature
				$expected_sig = self::generate_response_signature( $cached_data );

				if ( hash_equals( $expected_sig, $cached_data['signature'] ) ) {
					// Check if cache is still valid (not expired)
					$expires = isset( $cached_data['expires'] ) ? strtotime( $cached_data['expires'] ) : 0;

					if ( $expires > time() ) {
						self::$license_response_cache = $cached_data;
						return $cached_data;
					}
				}
			}

			// Invalid or expired cache, clear it
			delete_transient( 'fotogrids_license_response' );
		}

		// No valid cache, verify from server
		// If Pro plugin exists, it will handle the server communication
		if ( class_exists( 'FotoGrids_Pro\License_Manager' ) ) {
			$response = \FotoGrids_Pro\License_Manager::get_license_response_from_server();

			if ( $response ) {
				self::$license_response_cache = $response;

				// Cache for performance (server is still source of truth)
				set_transient( 'fotogrids_license_response', maybe_serialize( $response ), self::$cache_duration );

				return $response;
			}
		}

		// No Pro plugin or server verification failed
		// Check grace period
		$last_valid = get_option( 'fotogrids_license_last_valid_response', false );
		$last_check = get_option( 'fotogrids_license_last_check_time', 0 );

		if ( false !== $last_valid && ( time() - $last_check ) < self::$grace_period ) {
			// Grace period: use last known valid response
			return maybe_unserialize( $last_valid );
		}

		return null;
	}

	/**
	 * Generate signature for response verification.
	 *
	 * @since 1.0.0
	 * @param array $response Response data
	 * @return string Signature
	 */
	protected static function generate_response_signature( $response ) {
		// Create signature data (exclude signature itself)
		$sig_data = $response;
		unset( $sig_data['signature'] );

		$data_string = wp_json_encode( $sig_data, JSON_UNESCAPED_SLASHES );
		$secret      = self::get_license_secret();

		return hash_hmac( 'sha256', $data_string, $secret );
	}

	/**
	 * Get license secret for signing/verification.
	 *
	 * Public so Pro plugin can use it for response signature verification.
	 *
	 * @since 1.0.0
	 * @return string Secret key
	 */
	public static function get_license_secret() {
		$secret = get_option( 'fotogrids_license_secret', '' );

		if ( empty( $secret ) ) {
			$secret = wp_generate_password( 64, true, true );
			update_option( 'fotogrids_license_secret', $secret, false );
		}

		return $secret;
	}

	/**
	 * Verify license from server (called by Pro plugin).
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function verify_license_from_server() {
		// This will be called by Pro plugin's background verification
		self::clear_cache();
	}

	/**
	 * Get license key (if exists)
	 *
	 * @since 1.0.0
	 * @return string|false License key or false if not set
	 */
	public static function get_license_key() {
		$license_key = get_option( 'fotogrids_license_key', '' );

		if ( empty( $license_key ) ) {
			return false;
		}

		return $license_key;
	}

	/**
	 * Get license data
	 *
	 * @since 1.0.0
	 * @return array License data array
	 */
	public static function get_license_data() {
		$data = get_option( 'fotogrids_license_data', array() );

		if ( ! is_array( $data ) ) {
			return array();
		}

		return $data;
	}

	/**
	 * Maybe verify license (periodic check)
	 *
	 * @since 1.0.0
	 */
	public static function maybe_verify_license() {
		if ( ! \FotoGrids\Admin\Admin_Screen::is_fotogrids() ) {
			return;
		}

		$last_check = get_transient( 'fotogrids_license_last_check' );

		if ( false === $last_check ) {
			self::clear_cache();

			set_transient( 'fotogrids_license_last_check', time(), DAY_IN_SECONDS );
		}
	}

	/**
	 * Clear license cache
	 *
	 * @since 1.0.0
	 */
	public static function clear_cache() {
		self::$license_response_cache = null;
		delete_transient( 'fotogrids_license_response' );
	}

	/**
	 * Clear cache on plugin change
	 *
	 * @since 1.0.0
	 * @param string $plugin Plugin basename
	 * @param bool   $network_wide Whether network-wide activation
	 */
	public static function clear_cache_on_plugin_change( $plugin, $network_wide ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		if ( strpos( $plugin, 'fotogrids' ) !== false ) {
			self::clear_cache();
		}
	}

	/**
	 * Validate license key format
	 *
	 * @since 1.0.0
	 * @param string $license_key License key to validate
	 * @return bool True if format is valid
	 */
	public static function validate_license_key_format( $license_key ) {
		if ( empty( $license_key ) || ! is_string( $license_key ) ) {
			return false;
		}

		if ( strlen( $license_key ) < 20 ) {
			return false;
		}

		if ( ! preg_match( '/^[a-zA-Z0-9\-]+$/', $license_key ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Get license status for display
	 *
	 * @since 1.0.0
	 * @return array Status information
	 */
	public static function get_license_status() {
		$response = self::get_license_response();

		return array(
			'status'   => $response ? $response['status'] : 'invalid',
			'has_key'  => self::get_license_key() !== false,
			'features' => self::get_enabled_features(),
			'expires'  => $response && isset( $response['expires'] ) ? $response['expires'] : null,
			'version'  => 'free',
		);
	}

	/**
	 * Get license status data for display.
	 *
	 * @since 1.0.0
	 * @return array License status data
	 */
	public static function get_license_status_data() {
		if ( ! defined( 'FOTOGRIDS_PRO_VERSION' ) ) {
			return array(
				'is_valid' => false,
				'status'   => 'free',
				'message'  => __( 'FotoGrids Pro is not active.', 'fotogrids' ),
			);
		}

		if ( ! class_exists( 'FotoGrids_Pro\License_Manager' ) ) {
			return array(
				'is_valid' => false,
				'status'   => 'error',
				'message'  => __( 'Pro license manager not found.', 'fotogrids' ),
			);
		}

		$license_key = self::get_license_key();

		if ( ! $license_key ) {
			return array(
				'is_valid' => false,
				'status'   => 'no_key',
				'message'  => __( 'No license key found.', 'fotogrids' ),
			);
		}

		$response = self::get_license_response();

		if ( ! $response || ! isset( $response['status'] ) ) {
			return array(
				'is_valid' => false,
				'status'   => 'invalid',
				'message'  => __( 'License verification failed.', 'fotogrids' ),
			);
		}

		$is_valid = 'valid' === $response['status'];

		return array(
			'is_valid' => $is_valid,
			'status'   => $response['status'],
			'expires'  => isset( $response['expires'] ) ? $response['expires'] : null,
			'features' => isset( $response['features'] ) && is_array( $response['features'] ) ? $response['features'] : array(),
			'message'  => isset( $response['message'] ) ? $response['message'] : ( $is_valid ? __( 'License is valid.', 'fotogrids' ) : __( 'License is invalid.', 'fotogrids' ) ),
		);
	}

	/**
	 * Check if Pro is active (backward compatibility).
	 *
	 * @deprecated Use feature_enabled() instead
	 * @since 1.0.0
	 * @return bool True if any Pro features are enabled
	 */
	public static function is_pro_active() {
		$features = self::get_enabled_features();
		return ! empty( $features );
	}

	/**
	 * Resolve the active license provider.
	 *
	 * Resolution order: explicit override via the
	 * `fotogrids/licensing/provider` filter, Freemius (when its SDK is loaded),
	 * the legacy local provider (when the Pro plugin is active), or the null
	 * provider as a final fallback.
	 *
	 * @since  1.0.0
	 * @return \FotoGrids\Licensing\License_Provider
	 */
	public static function provider(): \FotoGrids\Licensing\License_Provider {
		if ( null !== self::$provider ) {
			return self::$provider;
		}

		/**
		 * Filter the license provider.
		 *
		 * Return a License_Provider instance to override the default resolver.
		 *
		 * @since 1.0.0
		 * @param \FotoGrids\Licensing\License_Provider|null $override
		 */
		$override = apply_filters( Filters_Licensing::PROVIDER, null );
		if ( $override instanceof \FotoGrids\Licensing\License_Provider ) {
			self::$provider = $override;
			return self::$provider;
		}

		if ( class_exists( 'Freemius' ) && function_exists( 'freemius' ) ) {
			self::$provider = new \FotoGrids\Licensing\Freemius_License_Provider();
			return self::$provider;
		}

		if ( defined( 'FOTOGRIDS_PRO_VERSION' ) ) {
			self::$provider = new \FotoGrids\Licensing\Local_License_Provider();
			return self::$provider;
		}

		self::$provider = new \FotoGrids\Licensing\Null_License_Provider();
		return self::$provider;
	}

	/**
	 * Clear the cached provider so the next call re-resolves.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function reset_provider(): void {
		self::$provider = null;
	}

	/**
	 * Whether Pro features are available for the current user.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	public static function pro_is_active(): bool {
		return self::provider()->is_pro_active();
	}

	/**
	 * Whether the FotoGrids Pro plugin is loaded on this site.
	 *
	 * Constant-only check — does NOT validate license state. Use can_use()
	 * or on_plan() when you need to know whether a specific Pro feature
	 * is actually enabled for the current site / user.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	public static function has_pro(): bool {
		return defined( 'FOTOGRIDS_PRO_VERSION' );
	}

	/**
	 * Whether the current user can use a specific feature.
	 *
	 * @since  1.0.0
	 * @param  string $feature_id Stable feature identifier.
	 * @return bool
	 */
	public static function can_use( string $feature_id ): bool {
		return self::provider()->can_use( $feature_id );
	}

	/**
	 * Whether the current user is on a specific plan or higher.
	 *
	 * @since  1.0.0
	 * @param  string $plan Plan slug.
	 * @return bool
	 */
	public static function on_plan( string $plan ): bool {
		return self::provider()->is_on_plan( $plan );
	}

	/**
	 * Current plan slug, or null when no plan is active.
	 *
	 * @since  1.0.0
	 * @return string|null
	 */
	public static function current_plan(): ?string {
		return self::provider()->get_plan();
	}

	/**
	 * Stable identifier for the active provider.
	 *
	 * @since  1.0.0
	 * @return string
	 */
	public static function provider_id(): string {
		return self::provider()->get_id();
	}

	/**
	 * Activate a license key against the active provider.
	 *
	 * @since  1.0.0
	 * @param  string $license_key
	 * @return true|\WP_Error
	 */
	public static function activate( string $license_key ) {
		$result = self::provider()->activate_license( $license_key );

		if ( true === $result ) {
			self::reset_provider();
		}

		return $result;
	}

	/**
	 * Deactivate the current site's license against the active provider.
	 *
	 * @since  1.0.0
	 * @return true|\WP_Error
	 */
	public static function deactivate() {
		$result = self::provider()->deactivate_license();

		if ( true === $result ) {
			self::reset_provider();
		}

		return $result;
	}

	/**
	 * License status snapshot, shaped for the License admin page.
	 *
	 * @since  1.0.0
	 * @return array<string,mixed>
	 */
	public static function status_snapshot(): array {
		$provider = self::provider();
		$is_pro   = $provider->is_pro_active();
		$key      = $provider->get_license_key();
		$expires  = $provider->get_expiry();

		$details = method_exists( $provider, 'get_details' )
			? (array) $provider->get_details()
			: array();

		$license_key_display = null;
		if ( null !== $key && strlen( $key ) >= 11 ) {
			$hidden_len          = strlen( $key ) - 11;
			$license_key_display = substr( $key, 0, 7 ) . str_repeat( '•', $hidden_len ) . substr( $key, -4 );
		}

		return array(
			'is_pro'            => $is_pro,
			'has_license'       => $is_pro,
			'status'            => $is_pro ? 'valid' : 'no_license',
			'plan'              => $provider->get_plan(),
			'provider'          => $provider->get_id(),
			'expires'           => $expires,
			'expires_formatted' => $expires ? wp_date( get_option( 'date_format' ), $expires ) : null,
			'license_key_full'  => $key,
			'license_key'       => $license_key_display,
			'activations'       => $details['activations'] ?? null,
			'quota'             => $details['quota'] ?? null,
			'is_cancelled'      => $details['is_cancelled'] ?? false,
			'account_email'     => $details['account_email'] ?? null,
			'is_opted_in'       => method_exists( $provider, 'is_opted_in' )
				? $provider->is_opted_in()
				: false,
			'needs_pro_install' => $details['needs_pro_install'] ?? false,
			'pro_download_url'  => $details['pro_download_url'] ?? null,
		);
	}
}
