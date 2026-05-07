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
     *
     * Performs all necessary setup tasks when the plugin is activated:
     * - Creates database tables for item metadata, statistics, licenses, etc.
     * - Registers custom post types and flushes rewrite rules
     * - Assigns capabilities to WordPress user roles
     * - Sets plugin version and activation timestamp
     *
     * @since 1.0.0
     */
    public static function activate() {
        self::create_tables();

        Post_Types::register_cpts();

        flush_rewrite_rules();

        self::add_capabilities();

        update_option( 'fotogrids_version', FOTOGRIDS_VERSION );
        update_option( 'fotogrids_activated_time', current_time( 'timestamp' ) );

        if ( ! get_option( 'fotogrids_site_id' ) ) {
            $site_id = wp_generate_uuid4();
            update_option( 'fotogrids_site_id', $site_id, false );
        }
    }

    /**
     * Create custom database tables
     *
     * Creates all necessary database tables for the plugin:
     * - Item metadata and positioning
     * - Statistics tracking (views, shares)
     * - License management
     * - Gallery-album relationships
     * - Tags, people, and location metadata
     *
     * Uses dbDelta for safe table creation and updates.
     *
     * @since 1.0.0
     */
    private static function create_tables() {
        global $wpdb;

        $charset_collate = $wpdb->get_charset_collate();

        $table_item_meta = $wpdb->prefix . 'fotogrids_item_meta';
        $table_stats = $wpdb->prefix . 'fotogrids_statistics';
        $table_licenses = $wpdb->prefix . 'fotogrids_licenses';
        $table_gallery_albums = $wpdb->prefix . 'fotogrids_gallery_albums';
        $table_tags = $wpdb->prefix . 'fotogrids_tags';
        $table_item_metadata = $wpdb->prefix . 'fotogrids_item_metadata';

        $sql = "
        CREATE TABLE $table_item_meta (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          attachment_id BIGINT UNSIGNED NOT NULL,
          gallery_id BIGINT UNSIGNED DEFAULT NULL,
          position INT NOT NULL DEFAULT 0,
          caption TEXT DEFAULT NULL,
          description LONGTEXT DEFAULT NULL,
          location VARCHAR(191) DEFAULT NULL,
          external_url TEXT DEFAULT NULL,
          link_target VARCHAR(20) DEFAULT 'global',
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
          object_type ENUM('gallery','album','item') NOT NULL,
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

        CREATE TABLE $table_gallery_albums (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          gallery_id BIGINT UNSIGNED NOT NULL,
          album_id BIGINT UNSIGNED NOT NULL,
          position INT NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_relationship (gallery_id, album_id),
          KEY gallery_id (gallery_id),
          KEY album_id (album_id),
          KEY position (position)
        ) $charset_collate;

        CREATE TABLE $table_tags (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          type VARCHAR(50) NOT NULL DEFAULT 'tag',
          name VARCHAR(191) NOT NULL,
          slug VARCHAR(191) NOT NULL,
          meta LONGTEXT DEFAULT NULL,
          usage_count INT NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_name_type (name, type),
          KEY name_index (name),
          KEY type_index (type),
          KEY usage_count_index (usage_count)
        ) $charset_collate;

        CREATE TABLE $table_item_metadata (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          attachment_id BIGINT UNSIGNED NOT NULL,
          metadata_type VARCHAR(50) NOT NULL,
          metadata_id BIGINT UNSIGNED NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_relationship (attachment_id, metadata_type, metadata_id),
          KEY attachment_id (attachment_id),
          KEY metadata_lookup (metadata_type, metadata_id)
        ) $charset_collate;
        ";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );

        do_action( 'fotogrids/system/activate' );

        update_option( 'fotogrids_db_version', '1.0' );
    }

    /**
     * Add plugin capabilities to WordPress roles
     *
     * Assigns appropriate capabilities to WordPress user roles:
     * - Administrator: Full access to all plugin features
     * - Editor: Gallery/album management + statistics viewing
     * - Author: Basic gallery/album creation and editing
     *
     * Capabilities are based on the capability_type defined in Post_Types class.
     *
     * @since 1.0.0
     */
    private static function add_capabilities() {
        $gallery_capabilities = array(
            'edit_fotogrids_gallery',
            'read_fotogrids_gallery',
            'delete_fotogrids_gallery',
            'edit_fotogrids_galleries',
            'edit_others_fotogrids_galleries',
            'publish_fotogrids_galleries',
            'read_private_fotogrids_galleries',
            'delete_fotogrids_galleries',
            'delete_private_fotogrids_galleries',
            'delete_published_fotogrids_galleries',
            'delete_others_fotogrids_galleries',
            'edit_private_fotogrids_galleries',
            'edit_published_fotogrids_galleries',
        );

        $album_capabilities = array(
            'edit_fotogrids_album',
            'read_fotogrids_album',
            'delete_fotogrids_album',
            'edit_fotogrids_albums',
            'edit_others_fotogrids_albums',
            'publish_fotogrids_albums',
            'read_private_fotogrids_albums',
            'delete_fotogrids_albums',
            'delete_private_fotogrids_albums',
            'delete_published_fotogrids_albums',
            'delete_others_fotogrids_albums',
            'edit_private_fotogrids_albums',
            'edit_published_fotogrids_albums',
        );

        $plugin_capabilities = array(
            'manage_fotogrids',
            'view_fotogrids_stats',
            'manage_fotogrids_settings',
        );

        $all_capabilities = array_merge( $gallery_capabilities, $album_capabilities, $plugin_capabilities );

        $admin_role = get_role( 'administrator' );
        if ( $admin_role ) {
            foreach ( $all_capabilities as $cap ) {
                $admin_role->add_cap( $cap );
            }
        }

        $editor_role = get_role( 'editor' );
        if ( $editor_role ) {
            $editor_caps = array_merge( $gallery_capabilities, $album_capabilities, array( 'view_fotogrids_stats' ) );
            foreach ( $editor_caps as $cap ) {
                $editor_role->add_cap( $cap );
            }
        }

        $author_role = get_role( 'author' );
        if ( $author_role ) {
            $author_caps = array(
                'edit_fotogrids_gallery',
                'read_fotogrids_gallery',
                'delete_fotogrids_gallery',
                'edit_fotogrids_galleries',
                'publish_fotogrids_galleries',
                'delete_fotogrids_galleries',
                'edit_fotogrids_album',
                'read_fotogrids_album',
                'delete_fotogrids_album',
                'edit_fotogrids_albums',
                'publish_fotogrids_albums',
                'delete_fotogrids_albums',
            );
            foreach ( $author_caps as $cap ) {
                $author_role->add_cap( $cap );
            }
        }
    }

    /**
     * Check if this is a fresh install or an update
     *
     * Determines whether the plugin is being installed for the first time
     * by checking if the version option exists in the database.
     *
     * @since 1.0.0
     *
     * @return bool True if this is a fresh install, false if updating
     */
    public static function is_fresh_install() {
        return ! get_option( 'fotogrids_version' );
    }

    /**
     * Get the previous version if this is an update
     *
     * Retrieves the previously installed version of the plugin from the database.
     * Returns '0.0.0' if no previous version is found (fresh install).
     *
     * @since 1.0.0
     *
     * @return string The previous plugin version or '0.0.0' for fresh installs
     */
    public static function get_previous_version() {
        return get_option( 'fotogrids_version', '0.0.0' );
    }
}
