<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Plugin Deactivator Class
 *
 * Handles plugin deactivation tasks
 */
class Deactivator {

    /**
     * Deactivate the plugin
     *
     * @since 1.0.0
     */
    public static function deactivate() {
        flush_rewrite_rules();

        if ( class_exists( '\FotoGrids\FotoGrids_Cache' ) ) {
            \FotoGrids\FotoGrids_Cache::flush_all();
        }

        self::clear_transients();

        // Let lifecycle modules clear their own scheduled events / transient
        // state. Deactivation is reversible - modules must NOT drop data here.
        if ( class_exists( '\FotoGrids\Activator' ) ) {
            Activator::run_module_lifecycle( 'on_deactivate' );
        }

        update_option( 'fotogrids_deactivated_time', current_time( 'timestamp' ) );
    }

    /**
     * Clear plugin transients
     *
     * Removes all FotoGrids-related transients from the WordPress database
     * and flushes object cache if available. This ensures no stale cached
     * data remains after plugin deactivation.
     *
     * @since 1.0.0
     */
    private static function clear_transients() {
        global $wpdb;

        $wpdb->query(
            "DELETE FROM {$wpdb->options}
             WHERE option_name LIKE '_transient_fotogrids_%'
             OR option_name LIKE '_transient_timeout_fotogrids_%'"
        );

        if ( function_exists( 'wp_cache_flush' ) ) {
            wp_cache_flush();
        }
    }
}
