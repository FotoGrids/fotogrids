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

    /*
     * ---------------------------------------------------------------------
     * PHPCS: WPDB direct-query sniffs disabled for this class.
     * ---------------------------------------------------------------------
     * This class is part of the FotoGrids custom-table data layer. Every
     * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
     * (or a WP core table such as $wpdb->posts) -- a trusted identifier that
     * WP placeholders cannot bind. All user-supplied *values* are passed
     * through $wpdb->prepare(); where SQL is assembled incrementally or uses
     * a generated %d IN() list, the prepare call is a separate statement the
     * sniff cannot follow. Custom tables have no WP_Query / core-API
     * equivalent and no object-cache layer applies at this level.
     * ---------------------------------------------------------------------
     */
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

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

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
