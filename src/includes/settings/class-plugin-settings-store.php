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
        return array(
            'autosave'                          => (bool) get_option( 'fotogrids_autosave', false ),
            'share_statistics'                  => (bool) get_option( 'fotogrids_share_statistics', false ),
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
        update_option( 'fotogrids_share_statistics', self::truthy( $input['share_statistics'] ?? false ) );
        update_option( 'fotogrids_custom_js_allow_dynamic_execution', self::truthy( $input['custom_js_allow_dynamic_execution'] ?? false ) );

        // Persist the inverse "preserve" flag the uninstaller reads.
        $delete = self::truthy( $input['delete_data_on_uninstall'] ?? false );
        update_option( 'fotogrids_preserve_data_on_uninstall', ! $delete );

        return self::get_advanced();
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
        return $value === true
            || $value === 1
            || $value === '1'
            || $value === 'true'
            || $value === 'on';
    }
}
