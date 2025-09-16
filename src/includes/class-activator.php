<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Plugin Activator Class
 * 
 * Handles plugin activation tasks:
 * - Database table creation
 * - Capability assignment
 * - Initial setup
 */
class Activator {
    
    /**
     * Activate the plugin
     */
    public static function activate() {
        // Create database tables
        self::create_tables();
        
        // Register CPTs and taxonomies for flush_rewrite_rules
        Post_Types::register_cpts();
        Taxonomies::register_taxonomies();
        
        // Flush rewrite rules to ensure permalinks work
        flush_rewrite_rules();
        
        // Add capabilities to roles
        self::add_capabilities();
        
        // Set plugin version
        update_option( 'fotogrids_version', FOTOGRIDS_VERSION );
        
        // Set activation timestamp
        update_option( 'fotogrids_activated_time', current_time( 'timestamp' ) );
    }
    
    /**
     * Create custom database tables
     */
    private static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Table names
        $table_image_meta = $wpdb->prefix . 'fotogrids_image_meta';
        $table_stats = $wpdb->prefix . 'fotogrids_statistics';
        $table_licenses = $wpdb->prefix . 'fotogrids_licenses';
        
        // SQL for creating tables
        $sql = "
        CREATE TABLE $table_image_meta (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          attachment_id BIGINT UNSIGNED NOT NULL,
          gallery_id BIGINT UNSIGNED DEFAULT NULL,
          position INT NOT NULL DEFAULT 0,
          caption TEXT DEFAULT NULL,
          description LONGTEXT DEFAULT NULL,
          location VARCHAR(191) DEFAULT NULL,
          exif_data LONGTEXT DEFAULT NULL,
          custom_data LONGTEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY attachment_id (attachment_id),
          KEY gallery_id (gallery_id),
          KEY position (position)
        ) $charset_collate;

        CREATE TABLE $table_stats (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          object_type ENUM('gallery','album','image') NOT NULL,
          object_id BIGINT UNSIGNED NOT NULL,
          views BIGINT UNSIGNED NOT NULL DEFAULT 0,
          shares BIGINT UNSIGNED NOT NULL DEFAULT 0,
          last_viewed DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY object_idx (object_type, object_id),
          KEY last_viewed (last_viewed),
          KEY views (views),
          KEY shares (shares)
        ) $charset_collate;

        CREATE TABLE $table_licenses (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          license_key VARCHAR(64) NOT NULL,
          license_type ENUM('starter','expert','commerce','lifetime') NOT NULL,
          status ENUM('active','expired','disabled') NOT NULL DEFAULT 'disabled',
          user_email VARCHAR(191) DEFAULT NULL,
          expiry_date DATE DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY license_key (license_key),
          KEY status (status),
          KEY expiry_date (expiry_date)
        ) $charset_collate;
        ";
        
        // Execute table creation
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
        
        // Store database version for future migrations
        update_option( 'fotogrids_db_version', '1.0' );
    }
    
    /**
     * Add plugin capabilities to WordPress roles
     */
    private static function add_capabilities() {
        $capabilities = array(
            'manage_fotogrids',
            'edit_fotogrids',
            'publish_fotogrids',
            'delete_fotogrids',
            'view_fotogrids_stats',
            'manage_fotogrids_settings',
        );
        
        // Add capabilities to administrator
        $admin_role = get_role( 'administrator' );
        if ( $admin_role ) {
            foreach ( $capabilities as $cap ) {
                $admin_role->add_cap( $cap );
            }
        }
        
        // Add limited capabilities to editor
        $editor_role = get_role( 'editor' );
        if ( $editor_role ) {
            $editor_caps = array(
                'edit_fotogrids',
                'publish_fotogrids',
                'view_fotogrids_stats',
            );
            foreach ( $editor_caps as $cap ) {
                $editor_role->add_cap( $cap );
            }
        }
    }
    
    /**
     * Check if this is a fresh install or an update
     */
    public static function is_fresh_install() {
        return ! get_option( 'fotogrids_version' );
    }
    
    /**
     * Get the previous version if this is an update
     */
    public static function get_previous_version() {
        return get_option( 'fotogrids_version', '0.0.0' );
    }
}
