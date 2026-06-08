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

        // Let lifecycle modules drop the tables/options they own before the
        // core cleanup runs. Guarded: if the registry is not loaded in this
        // uninstall request, the blanket option/postmeta cleanup below still
        // removes module options, and a module's own uninstall hook (if it
        // registered one against WordPress) handles its tables.
        if ( class_exists( '\FotoGrids\Activator' ) ) {
            Activator::run_module_lifecycle( 'on_uninstall' );
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
            $wpdb->prefix . 'fotogrids_statistics_daily',
            $wpdb->prefix . 'fotogrids_licenses',
            $wpdb->prefix . 'fotogrids_gallery_albums',
            $wpdb->prefix . 'fotogrids_tags',
            $wpdb->prefix . 'fotogrids_item_metadata',
            $wpdb->prefix . 'fotogrids_render_cache',
            $wpdb->prefix . 'fotogrids_permission_grants',
        );
        
        foreach ( $tables as $table ) {
            $wpdb->query( "DROP TABLE IF EXISTS $table" );
        }
    }
    
    /**
     * Remove plugin capabilities from all roles.
     *
     * Reads the full list of FotoGrids-owned atomic caps from
     * Permission_Registry so this stays in sync as new caps are added or
     * Pro contributes its own.
     */
    private static function remove_capabilities() {
        // Boot the registry. Uninstall runs in an isolated request - fire
        // the registration actions explicitly so harvested caps (Tools,
        // Modules, Pro filters) are included.
        if ( class_exists( '\FotoGrids\Hooks\Actions_System' ) ) {
            do_action( \FotoGrids\Hooks\Actions_System::MODULES_REGISTER );
            do_action( \FotoGrids\Hooks\Actions_System::TOOLS_INIT );
        }

        if ( ! class_exists( '\FotoGrids\Permissions\Permission_Registry' ) ) {
            return;
        }

        \FotoGrids\Permissions\Permission_Registry::boot();
        $caps = \FotoGrids\Permissions\Permission_Registry::get_all_atomic_caps();

        $roles = wp_roles()->roles;
        foreach ( $roles as $role_name => $role_info ) {
            $role = get_role( $role_name );
            if ( ! $role ) {
                continue;
            }
            foreach ( $caps as $cap ) {
                $role->remove_cap( $cap );
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
        $post_types = array( 'fotogrids_gallery', 'fotogrids_album', 'fotogrids_embed' );
        
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
