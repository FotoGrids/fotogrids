<?php
declare(strict_types=1);

namespace FotoGrids\Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Plugin_Settings_Store
 *
 * Single source of truth for the plugin-wide "general" (responsiveness) and
 * "advanced" (boolean) settings: their defaults, sanitisation, read, and
 * write. Lives in includes/settings/ which is required unconditionally at
 * bootstrap, so it is available on BOTH admin requests (Settings API via
 * Admin_Init) and frontend/REST requests (Admin_Data) - unlike Admin_Init,
 * which only loads when is_admin() is true.
 *
 * The "general" settings keys (mobile_breakpoint / tablet_breakpoint /
 * detect_responsive_by_browser) are the canonical ones the public frontend
 * renderer (Breakpoint_Config) reads.
 *
 * The uninstall flag is exposed to the UI as "delete on uninstall" but
 * persisted as its inverse, fotogrids_preserve_data_on_uninstall, which is
 * the option the uninstaller actually checks.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */
final class Plugin_Settings_Store {

	const OPTION_GENERAL = 'fotogrids_general_settings';

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
	 * Sanitise general settings.
	 *
	 * Clamps the breakpoints (mobile must not exceed tablet) and coerces the
	 * detection flag from any truthy form posted by the UI.
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
	 * Sanitise and persist general settings.
	 *
	 * @param mixed $value Raw input.
	 * @return array<string, mixed> The stored, merged settings.
	 */
	public static function save_general( $value ): array {
		update_option( self::OPTION_GENERAL, self::sanitize_general( $value ) );
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
			'autosave'                          => (bool) get_option( 'fotogrids_autosave', false ),
			// Tolerant cast - see `Admin_Init::resolve_share_statistics_state()`
			// for the same logic. Defaults to off on fresh install.
			'share_statistics'                  => ! (
				null === $share_raw ||
				false === $share_raw ||
				'' === $share_raw ||
				'0' === $share_raw ||
				0 === $share_raw
			),
			'custom_js_allow_dynamic_execution' => (bool) get_option( 'fotogrids_custom_js_allow_dynamic_execution', false ),
			// UI: "delete on uninstall" - persisted as the inverse "preserve" flag.
			'delete_data_on_uninstall'          => ! (bool) get_option( 'fotogrids_preserve_data_on_uninstall', false ),
		);
	}

	/**
	 * Persist advanced settings from a raw map (REST params or POST).
	 *
	 * @param array<string, mixed> $input Keys: autosave, share_statistics,
	 *        custom_js_allow_dynamic_execution, delete_data_on_uninstall.
	 * @return array<string, bool> The stored settings.
	 */
	public static function save_advanced( array $input ): array {
		update_option( 'fotogrids_autosave', self::truthy( $input['autosave'] ?? false ) );

		// share_statistics has a Freemius side-effect; route through the
		// shared helper so this REST path and the wizard's AJAX path
		// both stay in sync (option + Freemius opt-in/out).
		self::apply_share_statistics_consent( self::truthy( $input['share_statistics'] ?? false ) );

		update_option( 'fotogrids_custom_js_allow_dynamic_execution', self::truthy( $input['custom_js_allow_dynamic_execution'] ?? false ) );

		// Persist the inverse "preserve" flag the uninstaller reads.
		$delete = self::truthy( $input['delete_data_on_uninstall'] ?? false );
		update_option( 'fotogrids_preserve_data_on_uninstall', ! $delete );

		return self::get_advanced();
	}

	/**
	 * Apply the user's "share anonymous statistics" choice.
	 *
	 * Writes the local `fotogrids_share_statistics` option as a real bool
	 * and mirrors the change to Freemius's per-site tracking permissions
	 * via the FS_Permission_Manager. Both the Settings tab REST path and
	 * the wizard's AJAX path call this so the option and Freemius state
	 * can't drift out of sync.
	 *
	 * The earlier (broken) version assumed `Freemius::allow_tracking()` /
	 * `stop_tracking()` methods existed; they don't. The real API is
	 * `FS_Permission_Manager::update_site_tracking( $bool )` which
	 * flips the underlying per-permission storage that
	 * `Freemius::is_tracking_allowed()` reads.
	 *
	 * @since 1.0.0
	 * @param bool $opted_in
	 * @return bool The applied state.
	 */
	public static function apply_share_statistics_consent( bool $opted_in ): bool {
		$before_option = get_option( 'fotogrids_share_statistics', null );
		$update_result = update_option( 'fotogrids_share_statistics', $opted_in );
		$after_option  = get_option( 'fotogrids_share_statistics', null );

		$fs_before = self::probe_freemius_state();
		$fs_after  = $fs_before; // updated below if we successfully mirror

		if ( function_exists( 'freemius' ) ) {
			$fs = freemius( 'fotogrids' );
			if ( $fs instanceof \Freemius ) {
				try {
					if ( class_exists( 'FS_Permission_Manager' ) ) {
						$pm = \FS_Permission_Manager::instance( $fs );
						if ( $pm && method_exists( $pm, 'update_site_tracking' ) ) {
							$pm->update_site_tracking( $opted_in );
							$fs_after = self::probe_freemius_state();
						} else {
							\FotoGrids\Debug_Log::write( 'license', 'apply_share_statistics_consent: FS_Permission_Manager has no update_site_tracking()' );
						}
					} else {
						\FotoGrids\Debug_Log::write( 'license', 'apply_share_statistics_consent: FS_Permission_Manager not loaded' );
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
	 * Snapshot of Freemius's current tracking state, used for debug
	 * logging around `apply_share_statistics_consent` and
	 * `resolve_share_statistics_state` so log lines pin down whether a
	 * desync is on our side or Freemius's side.
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
			// Probe for an install without touching the private $_site
			// property. get_site() / has_active_valid_license() are
			// public; the presence of *any* install also makes
			// is_registered() true.
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

	// ---------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------

	/**
	 * Coerce any of the truthy forms the UI may post into a strict bool.
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
