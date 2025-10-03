<?php
namespace FotoGrids;

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) && ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Plugin Uninstaller Class
 * 
 * Handles complete plugin removal:
 * - Database cleanup
 * - Options removal
 * - Capabilities removal
 */
class Uninstaller {
    
    /**
     * Uninstall the plugin completely
     */
    public static function uninstall() {
        // Check if user really wants to delete everything
        if ( ! self::should_delete_data() ) {
            return;
        }
        
        // Remove database tables
        self::drop_tables();
        
        // Remove capabilities
        self::remove_capabilities();
        
        // Remove options
        self::remove_options();
        
        // Remove post meta
        self::remove_post_meta();
        
        // Remove transients
        self::remove_transients();
        
        // Clear any scheduled events
        wp_clear_scheduled_hook( 'fotogrids_daily_cleanup' );
        wp_clear_scheduled_hook( 'fotogrids_stats_aggregation' );
    }
    
    /**
     * Check if we should delete plugin data
     */
    private static function should_delete_data() {
        // Check if there's a setting to preserve data
        $preserve_data = get_option( 'fotogrids_preserve_data_on_uninstall', false );
        
        return ! $preserve_data;
    }
    
    /**
     * Drop custom database tables
     */
    private static function drop_tables() {
        global $wpdb;
        
        $tables = array(
            $wpdb->prefix . 'fotogrids_item_meta',
            $wpdb->prefix . 'fotogrids_statistics',
            $wpdb->prefix . 'fotogrids_licenses',
        );
        
        foreach ( $tables as $table ) {
            $wpdb->query( "DROP TABLE IF EXISTS $table" );
        }
    }
    
    /**
     * Remove plugin capabilities from all roles
     */
    private static function remove_capabilities() {
        $capabilities = array(
            'manage_fotogrids',
            'edit_fotogrids',
            'publish_fotogrids',
            'delete_fotogrids',
            'view_fotogrids_stats',
            'manage_fotogrids_settings',
        );
        
        // Get all roles
        $roles = wp_roles()->roles;
        
        foreach ( $roles as $role_name => $role_info ) {
            $role = get_role( $role_name );
            if ( $role ) {
                foreach ( $capabilities as $cap ) {
                    $role->remove_cap( $cap );
                }
            }
        }
    }
    
    /**
     * Remove all plugin options
     */
    private static function remove_options() {
        global $wpdb;
        
        // Remove all options that start with 'fotogrids_'
        $wpdb->query( 
            "DELETE FROM {$wpdb->options} 
             WHERE option_name LIKE 'fotogrids_%'"
        );
    }
    
    /**
     * Remove plugin post meta
     */
    private static function remove_post_meta() {
        global $wpdb;
        
        // Remove all post meta that starts with 'fotogrids_'
        $wpdb->query( 
            "DELETE FROM {$wpdb->postmeta} 
             WHERE meta_key LIKE 'fotogrids_%'"
        );
    }
    
    /**
     * Remove plugin transients
     */
    private static function remove_transients() {
        global $wpdb;
        
        // Remove all transients that start with 'fotogrids_'
        $wpdb->query( 
            "DELETE FROM {$wpdb->options} 
             WHERE option_name LIKE '_transient_fotogrids_%' 
             OR option_name LIKE '_transient_timeout_fotogrids_%'"
        );
    }
    
    /**
     * Remove custom post type posts
     * This will be called automatically by WordPress when CPTs are unregistered
     */
    private static function remove_cpt_posts() {
        $post_types = array( 'fotogrids_gallery', 'fotogrids_album' );
        
        foreach ( $post_types as $post_type ) {
            $posts = get_posts( array(
                'post_type' => $post_type,
                'numberposts' => -1,
                'post_status' => 'any',
            ) );
            
            foreach ( $posts as $post ) {
                wp_delete_post( $post->ID, true );
            }
        }
    }
}
