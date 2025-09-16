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
     */
    public static function deactivate() {
        // Flush rewrite rules to clean up custom post type URLs
        flush_rewrite_rules();
        
        // Clear any scheduled events
        wp_clear_scheduled_hook( 'fotogrids_daily_cleanup' );
        wp_clear_scheduled_hook( 'fotogrids_stats_aggregation' );
        
        // Clear transients
        self::clear_transients();
        
        // Log deactivation
        update_option( 'fotogrids_deactivated_time', current_time( 'timestamp' ) );
    }
    
    /**
     * Clear plugin transients
     */
    private static function clear_transients() {
        global $wpdb;
        
        // Delete all fotogrids transients
        $wpdb->query( 
            "DELETE FROM {$wpdb->options} 
             WHERE option_name LIKE '_transient_fotogrids_%' 
             OR option_name LIKE '_transient_timeout_fotogrids_%'"
        );
        
        // Clear object cache if available
        if ( function_exists( 'wp_cache_flush' ) ) {
            wp_cache_flush();
        }
    }
}
