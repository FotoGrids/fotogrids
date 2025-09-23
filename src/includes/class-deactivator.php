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
        
        wp_clear_scheduled_hook( 'fotogrids_daily_cleanup' );
        wp_clear_scheduled_hook( 'fotogrids_stats_aggregation' );
        
        self::clear_transients();
        
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
