<?php
declare(strict_types=1);

namespace FotoGrids\Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Plugin_Settings_Store
 *
 * Defaults, sanitisation, reads and writes for the general (responsiveness)
 * and advanced (boolean) plugin settings. Loaded on every request, so REST
 * and frontend code can use it.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */
final class Plugin_Settings_Store {

	const OPTION_GENERAL = 'fotogrids_general_settings';

	/**
	 * Freemius permissions covered by the usage-data choice.
	 *
	 * @since 1.3.0
	 * @var array<int, string>
	 */
	private const FREEMIUS_PERMISSIONS = array( 'user', 'site', 'events', 'extensions' );

	// ---------------------------------------------------------------------
	// General (responsiveness) settings
	// ---------------------------------------------------------------------

	/**
	 * Default values for general settings.
	 *
	 * @return array<string, mixed>
	 */
	public static function general_defaults(): array {
		return array(
			'mobile_breakpoint'            => 767,
			'tablet_breakpoint'            => 1024,
			'detect_responsive_by_browser' => false,
		);
	}

	/**
	 * General settings merged with defaults.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_general(): array {
		$defaults = self::general_defaults();
		$stored   = get_option( self::OPTION_GENERAL, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		return wp_parse_args( $stored, $defaults );
	}

	/**
	 * Sanitise general settings. Mobile may not exceed tablet.
	 *
	 * @param mixed $value Raw option value.
	 * @return array<string, mixed>
	 */
	public static function sanitize_general( $value ): array {
		$defaults = self::general_defaults();
		$input    = is_array( $value ) ? $value : array();

		$mobile = isset( $input['mobile_breakpoint'] ) ? absint( $input['mobile_breakpoint'] ) : $defaults['mobile_breakpoint'];
		$tablet = isset( $input['tablet_breakpoint'] ) ? absint( $input['tablet_breakpoint'] ) : $defaults['tablet_breakpoint'];

		if ( $mobile > $tablet ) {
			$mobile = $defaults['mobile_breakpoint'];
			$tablet = $defaults['tablet_breakpoint'];
		}

		return array(
			'mobile_breakpoint'            => $mobile,
			'tablet_breakpoint'            => $tablet,
			'detect_responsive_by_browser' => self::truthy( $input['detect_responsive_by_browser'] ?? false ),
		);
	}

	/**
	 * Sanitise and persist general settings. A change flushes the render cache.
	 *
	 * @param mixed $value Raw input.
	 * @return array<string, mixed> The stored, merged settings.
	 */
	public static function save_general( $value ): array {
		if ( update_option( self::OPTION_GENERAL, self::sanitize_general( $value ) ) ) {
			\FotoGrids\FotoGrids_Cache::flush_all();
		}
		return self::get_general();
	}

	// ---------------------------------------------------------------------
	// Advanced (boolean) settings
	// ---------------------------------------------------------------------

	/**
	 * Advanced settings as a single map.
	 *
	 * @return array<string, bool>
	 */
	public static function get_advanced(): array {
		$share_raw = get_option( 'fotogrids_share_statistics', null );
		return array(
			'autosave'                 => (bool) get_option( 'fotogrids_autosave', true ),
			// Off unless explicitly on.
			'share_statistics'         => ! (
				null === $share_raw ||
				false === $share_raw ||
				'' === $share_raw ||
				'0' === $share_raw ||
				0 === $share_raw
			),
			'marketing_allowed'        => (bool) get_option( 'fotogrids_marketing_allowed', false ),
			'allow_google_fonts'       => (bool) get_option( 'fotogrids_allow_google_fonts', true ),
			'allow_news_updates'       => (bool) get_option( 'fotogrids_allow_news_updates', true ),
			// Stored inverted as the flag the uninstaller reads.
			'delete_data_on_uninstall' => ! (bool) get_option( 'fotogrids_preserve_data_on_uninstall', true ),
		);
	}

	/**
	 * Persist advanced settings from a raw map (REST params or POST).
	 *
	 * @param array<string, mixed> $input Keys: autosave, share_statistics,
	 *        allow_google_fonts, allow_news_updates, delete_data_on_uninstall.
	 * @return array<string, bool> The stored settings.
	 */
	public static function save_advanced( array $input ): array {
		self::save_bool( 'fotogrids_autosave', self::truthy( $input['autosave'] ?? false ) );

		$share_on = self::truthy( $input['share_statistics'] ?? false );
		self::apply_share_statistics_consent( $share_on );

		// When sharing is off, marketing consent was already revoked.
		if ( $share_on ) {
			self::apply_marketing_consent( self::truthy( $input['marketing_allowed'] ?? false ) );
		}

		self::save_bool( 'fotogrids_allow_google_fonts', self::truthy( $input['allow_google_fonts'] ?? false ) );

		self::save_bool( 'fotogrids_allow_news_updates', self::truthy( $input['allow_news_updates'] ?? false ) );

		$delete = self::truthy( $input['delete_data_on_uninstall'] ?? false );
		self::save_bool( 'fotogrids_preserve_data_on_uninstall', ! $delete );

		return self::get_advanced();
	}

	/**
	 * Sanitise a map of collection defaults.
	 *
	 * Unknown keys are dropped; each value is coerced to its default's type.
	 *
	 * @param  mixed $input Raw map of setting key => value.
	 * @return array<string, mixed>
	 */
	public static function sanitize_collection_defaults( $input ): array {
		if ( ! is_array( $input ) ) {
			return array();
		}

		$defaults  = \FotoGrids\Collection_Defaults::resolve_gallery();
		$sanitized = array();

		foreach ( $defaults as $key => $default_value ) {
			if ( ! isset( $input[ $key ] ) ) {
				continue;
			}

			$value = $input[ $key ];

			if ( is_array( $default_value ) ) {
				if ( is_string( $value ) ) {
					// REST bodies are unslashed: no stripslashes().
					$decoded = json_decode( $value, true );
					if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
						$sanitized[ $key ] = \FotoGrids\Sanitization\Array_Field::deep( $decoded );
					} else {
						$sanitized[ $key ] = $default_value;
					}
				} elseif ( is_array( $value ) ) {
					$sanitized[ $key ] = \FotoGrids\Sanitization\Array_Field::deep( $value );
				} else {
					$sanitized[ $key ] = $default_value;
				}
			} elseif ( is_bool( $default_value ) ) {
				$sanitized[ $key ] = ( '1' === $value || 'true' === $value || true === $value || 'on' === $value );
			} elseif ( is_numeric( $default_value ) ) {
				$sanitized[ $key ] = is_numeric( $value ) ? $value : $default_value;
			} else {
				$sanitized[ $key ] = Setting_Value_Codec::sanitize_text_value(
					$value,
					Setting_Value_Codec::catalog_field_type( $key )
				);
			}
		}

		return $sanitized;
	}

	/**
	 * Persist a boolean option as '1' or '0'.
	 *
	 * A raw `false` is not written to a missing option, so a default-true
	 * option could never be switched off.
	 *
	 * @param  string $option Option name.
	 * @param  bool   $value  Value to store.
	 * @return bool True when the option was written.
	 */
	private static function save_bool( string $option, bool $value ): bool {
		return update_option( $option, $value ? '1' : '0' );
	}

	/**
	 * Apply the usage-data sharing choice and mirror it into Freemius.
	 *
	 * Turning it off revokes marketing consent first, while the account can
	 * still be reached. If Freemius refuses the opt-out, the site is opted
	 * out locally.
	 *
	 * @since 1.0.0
	 * @param bool $opted_in
	 * @return bool The applied state.
	 */
	public static function apply_share_statistics_consent( bool $opted_in ): bool {
		$before_option = get_option( 'fotogrids_share_statistics', null );
		$update_result = self::save_bool( 'fotogrids_share_statistics', $opted_in );
		$after_option  = get_option( 'fotogrids_share_statistics', null );

		$fs_before = self::probe_freemius_state();
		$fs_after  = $fs_before;

		if ( ! $opted_in ) {
			self::apply_marketing_consent( false );
		}

		if ( function_exists( 'freemius' ) ) {
			$fs = freemius( 'fotogrids' );
			if ( $fs instanceof \Freemius ) {
				try {
					if ( $fs->is_registered( true ) ) {
						if ( ! self::toggle_freemius_tracking( $fs, $opted_in ) ) {
							\FotoGrids\Debug_Log::write( 'license', 'apply_share_statistics_consent: the Freemius permission update did not complete' );

							if ( ! $opted_in ) {
								self::opt_out_locally( $fs );
							}
						}
						$fs_after = self::probe_freemius_state();
					} elseif ( $opted_in ) {
						// No marketing consent and no redirect.
						$identity = self::current_user_identity();
						$fs->opt_in(
							$identity['email'],
							$identity['first'],
							$identity['last'],
							false,
							false,
							false,
							false,
							false,
							array(),
							false
						);
						$fs_after = self::probe_freemius_state();
					}
				} catch ( \Throwable $e ) {
					\FotoGrids\Debug_Log::write( 'license', 'apply_share_statistics_consent: Freemius mirror threw: ' . $e->getMessage() );
				}
			} else {
				\FotoGrids\Debug_Log::write( 'license', 'apply_share_statistics_consent: freemius() returned non-Freemius' );
			}
		} else {
			\FotoGrids\Debug_Log::write( 'license', 'apply_share_statistics_consent: freemius() not available' );
		}

		\FotoGrids\Debug_Log::write(
			'license',
			sprintf(
				'apply_share_statistics_consent: requested=%s | option before=%s after=%s update_option=%s | FS tracking_allowed before=%s after=%s registered=%s install_exists=%s',
				$opted_in ? 'on' : 'off',
				self::dump( $before_option ),
				self::dump( $after_option ),
				$update_result ? 'true' : 'false',
				self::dump( $fs_before['tracking_allowed'] ?? null ),
				self::dump( $fs_after['tracking_allowed'] ?? null ),
				self::dump( $fs_after['is_registered'] ?? null ),
				self::dump( $fs_after['install_exists'] ?? null )
			)
		);

		return $opted_in;
	}

	/**
	 * Opt the site out of Freemius without calling its API.
	 *
	 * @since  1.3.0
	 * @param  \Freemius $fs The FotoGrids Freemius instance.
	 * @return void
	 */
	private static function opt_out_locally( \Freemius $fs ): void {
		if ( class_exists( 'FS_Permission_Manager' ) ) {
			\FS_Permission_Manager::instance( $fs )->update_site_tracking( false );
		}

		$fs->skip_connection();
	}

	/**
	 * Switch the Freemius permissions behind the usage-data choice.
	 *
	 * Calls the private `Freemius::toggle_permission_tracking()`, guarded by
	 * `FreemiusConsentContractTest`.
	 *
	 * @since  1.3.0
	 * @param  \Freemius $fs      The FotoGrids Freemius instance.
	 * @param  bool      $enabled Whether to grant the permissions.
	 * @return bool True when the SDK reported success.
	 */
	private static function toggle_freemius_tracking( \Freemius $fs, bool $enabled ): bool {
		if ( ! method_exists( $fs, 'toggle_permission_tracking' ) ) {
			return false;
		}

		$method = new \ReflectionMethod( $fs, 'toggle_permission_tracking' );
		$method->setAccessible( true );

		return true === $method->invoke( $fs, self::FREEMIUS_PERMISSIONS, $enabled );
	}

	/**
	 * Freemius tracking state, for debug logging.
	 *
	 * @return array<string,mixed>
	 */
	public static function probe_freemius_state(): array {
		$state = array(
			'freemius_available'  => function_exists( 'freemius' ),
			'is_registered'       => null,
			'install_exists'      => null,
			'tracking_allowed'    => null,
			'tracking_prohibited' => null,
		);

		if ( ! function_exists( 'freemius' ) ) {
			return $state;
		}

		$fs = freemius( 'fotogrids' );
		if ( ! ( $fs instanceof \Freemius ) ) {
			return $state;
		}

		try {
			$state['is_registered']       = method_exists( $fs, 'is_registered' ) ? (bool) $fs->is_registered() : null;
			$state['tracking_allowed']    = method_exists( $fs, 'is_tracking_allowed' ) ? (bool) $fs->is_tracking_allowed() : null;
			$state['tracking_prohibited'] = method_exists( $fs, 'is_tracking_prohibited' ) ? (bool) $fs->is_tracking_prohibited() : null;
			if ( method_exists( $fs, 'get_site' ) ) {
				$state['install_exists'] = is_object( $fs->get_site() );
			} else {
				$state['install_exists'] = (bool) $state['is_registered'];
			}
		} catch ( \Throwable $e ) {
			\FotoGrids\Debug_Log::write( 'license', 'probe_freemius_state threw: ' . $e->getMessage() );
		}

		return $state;
	}

	/**
	 * Stringify a mixed value for compact debug-log lines.
	 *
	 * @param mixed $v
	 * @return string
	 */
	private static function dump( $v ): string {
		if ( null === $v ) {
			return 'null';
		}
		if ( true === $v ) {
			return 'true';
		}
		if ( false === $v ) {
			return 'false';
		}
		if ( '' === $v ) {
			return '""';
		}
		if ( is_scalar( $v ) ) {
			return (string) $v;
		}
		return wp_json_encode( $v );
	}

	/**
	 * Apply the promotional-email consent and mirror it into Freemius's
	 * `is_marketing_allowed` flag when it changes.
	 *
	 * @since  1.0.0
	 * @param  bool $allowed
	 * @return bool The applied state.
	 */
	public static function apply_marketing_consent( bool $allowed ): bool {
		$before = (bool) get_option( 'fotogrids_marketing_allowed', false );
		self::save_bool( 'fotogrids_marketing_allowed', $allowed );

		if ( $before === $allowed ) {
			return $allowed;
		}

		if ( ! function_exists( 'freemius' ) ) {
			return $allowed;
		}

		$fs = freemius( 'fotogrids' );
		if ( ! ( $fs instanceof \Freemius ) ) {
			return $allowed;
		}

		try {
			if ( method_exists( $fs, 'is_registered' ) && $fs->is_registered() ) {
				// Same call as the SDK's GDPR opt-in notice.
				$fs->get_api_user_scope()->call(
					'?plugin_id=' . $fs->get_id(),
					'put',
					array( 'is_marketing_allowed' => $allowed )
				);
			} elseif ( $allowed ) {
				$identity = self::current_user_identity();
				$fs->opt_in(
					$identity['email'],
					$identity['first'],
					$identity['last'],
					false,
					false,
					false,
					false,
					true,
					array(),
					false
				);
			}
		} catch ( \Throwable $e ) {
			\FotoGrids\Debug_Log::write( 'license', 'apply_marketing_consent: ' . $e->getMessage() );
		}

		return $allowed;
	}

	/**
	 * Current WordPress user's identity for a Freemius opt-in.
	 *
	 * @since  1.0.0
	 * @return array{email:string,first:string,last:string}
	 */
	private static function current_user_identity(): array {
		$user = wp_get_current_user();

		if ( ! ( $user instanceof \WP_User ) || 0 === (int) $user->ID ) {
			return array(
				'email' => '',
				'first' => '',
				'last'  => '',
			);
		}

		return array(
			'email' => (string) $user->user_email,
			'first' => (string) $user->user_firstname,
			'last'  => (string) $user->user_lastname,
		);
	}

	// ---------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------

	/**
	 * Coerce a posted truthy value to a bool.
	 *
	 * @param mixed $value
	 * @return bool
	 */
	public static function truthy( $value ): bool {
		return true === $value
			|| 1 === $value
			|| '1' === $value
			|| 'true' === $value
			|| 'on' === $value;
	}
}
