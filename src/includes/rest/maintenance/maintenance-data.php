<?php
namespace FotoGrids\REST\Maintenance;

use FotoGrids\Hooks\Actions_Maintenance;
use FotoGrids\Hooks\Filters_Maintenance;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Handler methods for the Maintenance REST resource.
 *
 * Three concerns:
 *  - Reset all plugin-wide settings to first-activation defaults, preserving
 *    install metadata, the licence cache, and any keys contributed via the
 *    `fotogrids/maintenance/reset_options/preserve_keys` filter.
 *  - Reinstall the custom database tables by re-running the dbDelta-based
 *    activator. Tables are NOT truncated - dbDelta only adds missing tables,
 *    columns and indexes; existing rows survive.
 *  - Read and write the per-channel debug-log toggle list backing the
 *    Maintenance > Debug Log panel.
 *
 * @since 1.0.0
 */
class Maintenance_Data {

    /**
     * Option keys that the reset action clears. Reseeded where a first-
     * activation default exists; otherwise just deleted so the next read
     * falls back to the option's runtime default.
     *
     * @since 1.0.0
     * @return array<int, string>
     */
    private static function resettable_option_keys(): array {
        return array(
            // Plugin-wide settings (Plugin Settings tabs)
            'fotogrids_general_settings',
            'fotogrids_permission_settings',
            'fotogrids_integration_settings',
            'fotogrids_gallery_defaults',
            'fotogrids_album_defaults',
            'fotogrids_media_settings',
            'fotogrids_sharing_settings',
            'fotogrids_view_settings',

            // Advanced tab booleans
            'fotogrids_autosave',
            'fotogrids_share_statistics',
            'fotogrids_custom_js_allow_dynamic_execution',
            'fotogrids_preserve_data_on_uninstall',

            // In-product UX state
            'fotogrids_notice_bar_dismissed',
            'fotogrids_review_stats',

            // Maintenance > Debug Log
            'fotogrids_debug_channels',
        );
    }

    /**
     * Option keys that the reset action MUST NOT touch. Includes install
     * metadata, the db-version pointer, and the entire licence cache.
     *
     * @since 1.0.0
     * @return array<int, string>
     */
    private static function preserved_option_keys(): array {
        $defaults = array(
            // Install metadata - regenerating these would orphan analytics
            // and break the activation/upgrade gate.
            'fotogrids_version',
            'fotogrids_db_version',
            'fotogrids_activated_time',
            'fotogrids_deactivated_time',
            'fotogrids_site_id',

            // Licence cache. Resetting these would force a re-activation
            // flow on Pro users for what is meant to be a settings reset.
            'fotogrids_license_key',
            'fotogrids_license_data',
            'fotogrids_license_secret',
            'fotogrids_license_last_valid_response',
            'fotogrids_license_last_check_time',
        );

        /**
         * Filter the list of option keys that survive "Reset all settings".
         *
         * Pro and third-party modules can extend this list to keep their own
         * install-time or licence-adjacent state across a settings reset.
         *
         * @since 1.0.0
         * @param array<int, string> $defaults Default preserved keys.
         */
        $filtered = apply_filters( Filters_Maintenance::RESET_OPTIONS_PRESERVE_KEYS, $defaults );

        if ( ! is_array( $filtered ) ) {
            return $defaults;
        }

        return array_values( array_unique( array_filter( $filtered, 'is_string' ) ) );
    }

    /**
     * POST /admin/maintenance/reset-options
     *
     * Wipes the curated list of plugin-wide options and reseeds defaults
     * where a first-activation default exists. Fires
     * `fotogrids/maintenance/options_reset` so Pro and modules can clear
     * their own option state in the same request.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request Request object.
     * @return \WP_REST_Response
     */
    public static function reset_options( $request ): \WP_REST_Response {
        $preserved = self::preserved_option_keys();
        $resettable = array_values( array_diff( self::resettable_option_keys(), $preserved ) );

        foreach ( $resettable as $option_key ) {
            delete_option( $option_key );
        }

        // Reseed first-activation defaults for the options that have them.
        if ( ! get_option( 'fotogrids_media_settings' ) ) {
            update_option(
                'fotogrids_media_settings',
                \FotoGrids\Image_Size_Manager::get_plugin_size_defaults(),
                false
            );
        }

        /**
         * Fires after the Maintenance reset has cleared and reseeded
         * Free's plugin-wide options. Pro modules can clear their own option
         * state on this hook so a reset is a one-click operation.
         *
         * @since 1.0.0
         * @param array<int, string> $resettable Keys that were cleared.
         * @param array<int, string> $preserved  Keys that were preserved.
         */
        do_action( Actions_Maintenance::OPTIONS_RESET, $resettable, $preserved );

        return rest_ensure_response( array(
            'success'    => true,
            'message'    => __( 'Plugin settings reset to defaults. Your galleries, albums and licence are untouched.', 'fotogrids' ),
            'reset'      => $resettable,
            'preserved'  => $preserved,
        ) );
    }

    /**
     * POST /admin/maintenance/reinstall-tables
     *
     * Forces the activator's dbDelta path to re-run, which adds any missing
     * tables, columns or indexes. No data is deleted. Fires
     * `fotogrids/maintenance/tables_reinstalled` for modules that ship their
     * own tables and may want to re-run their own dbDelta in the same
     * request.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request Request object.
     * @return \WP_REST_Response
     */
    public static function reinstall_tables( $request ): \WP_REST_Response {
        // Force the upgrade path. `maybe_upgrade` only runs `create_tables`
        // when the stored db_version is below the schema version, so
        // resetting it to '0' is the public way to ask for a re-run.
        delete_option( 'fotogrids_db_version' );

        \FotoGrids\Activator::maybe_upgrade();

        /**
         * Fires after Free's dbDelta has re-run. Modules that ship their own
         * tables can re-run their own dbDelta on this hook.
         *
         * @since 1.0.0
         */
        do_action( Actions_Maintenance::TABLES_REINSTALLED );

        global $wpdb;
        $tables = array(
            $wpdb->prefix . 'fotogrids_item_meta',
            $wpdb->prefix . 'fotogrids_statistics',
            $wpdb->prefix . 'fotogrids_statistics_daily',
            $wpdb->prefix . 'fotogrids_licenses',
            $wpdb->prefix . 'fotogrids_gallery_albums',
            $wpdb->prefix . 'fotogrids_tags',
            $wpdb->prefix . 'fotogrids_item_metadata',
            $wpdb->prefix . 'fotogrids_render_cache',
        );

        return rest_ensure_response( array(
            'success' => true,
            'message' => __( 'Database tables reinstalled. No data was deleted.', 'fotogrids' ),
            'tables'  => $tables,
        ) );
    }

    /**
     * Build the response payload describing the current debug-log state. Used
     * by both the GET and POST handlers.
     *
     * @since 1.0.0
     * @return array<string, mixed>
     */
    private static function build_debug_channels_payload(): array {
        $wp_debug = defined( 'WP_DEBUG' ) && WP_DEBUG;
        $enabled  = \FotoGrids\Debug_Log::get_enabled_channels();

        $channels = array();
        foreach ( \FotoGrids\Debug_Log::get_channels() as $entry ) {
            $slug           = $entry['slug'];
            $constant_state = \FotoGrids\Debug_Log::constant_state_for( $slug );

            $channels[] = array(
                'slug'                => $slug,
                'label'               => $entry['label'],
                'description'         => $entry['description'],
                'enabled'             => in_array( $slug, $enabled, true ),
                'forced_by_constant'  => $constant_state['forced'],
                'forced_value'        => $constant_state['value'],
                'constant_name'       => \FotoGrids\Debug_Log::constant_name_for( $slug ),
            );
        }

        return array(
            'wp_debug' => $wp_debug,
            'channels' => $channels,
            'note'     => $wp_debug
                ? __( 'These toggles only take effect while WP_DEBUG is true. The constant override always wins.', 'fotogrids' )
                : __( 'WP_DEBUG is off, so FotoGrids is not writing any debug-log lines. Set WP_DEBUG to true in wp-config.php to use these toggles.', 'fotogrids' ),
        );
    }

    /**
     * GET /admin/maintenance/debug-channels
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request Request object.
     * @return \WP_REST_Response
     */
    public static function get_debug_channels( $request ): \WP_REST_Response {
        return rest_ensure_response( self::build_debug_channels_payload() );
    }

    /**
     * POST /admin/maintenance/debug-channels
     *
     * Accepts `{ channels: ['catalog', ...] }`. Channels overridden by a
     * `FOTOGRIDS_DEBUG_<UPPER_SLUG>` constant are persisted in the option as
     * requested, but `should_log()` will still defer to the constant.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request Request object.
     * @return \WP_REST_Response
     */
    public static function save_debug_channels( $request ): \WP_REST_Response {
        $raw = $request->get_param( 'channels' );
        if ( ! is_array( $raw ) ) {
            $raw = array();
        }

        \FotoGrids\Debug_Log::save_enabled_channels( $raw );

        return rest_ensure_response( self::build_debug_channels_payload() );
    }
}
