<?php
namespace FotoGrids;

use FotoGrids\Hooks\Actions_System;

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
        update_option( 'fotogrids_caps_version', self::CAPS_VERSION, false );

        update_option( 'fotogrids_version', FOTOGRIDS_VERSION );
        update_option( 'fotogrids_activated_time', current_time( 'timestamp' ) );

        if ( ! get_option( 'fotogrids_site_id' ) ) {
            $site_id = wp_generate_uuid4();
            update_option( 'fotogrids_site_id', $site_id, false );
        }

        // Seed plugin-wide media settings with defaults (only on first activation)
        if ( ! get_option( 'fotogrids_media_settings' ) ) {
            update_option( 'fotogrids_media_settings', Image_Size_Manager::get_plugin_size_defaults(), false );
        }

        // Let modules that own persistent state (tables, options, cron) create
        // it as part of activation. Free's six core tables stay above - those
        // are platform, not modules. This is how a (Pro) module ships its own
        // table creation with the feature instead of editing this activator.
        self::run_module_lifecycle( 'on_activate' );
    }

    /**
     * Run a lifecycle hook across every registered Lifecycle_Module_Interface.
     *
     * Activation / deactivation / uninstall run in isolated requests where the
     * 'init' hook has not fired, so modules are not yet registered. We fire the
     * registration action here explicitly (its listeners are attached at
     * plugin-file load time) before iterating. No-op until a lifecycle module
     * exists.
     *
     * @since 1.0.0
     * @param string $method One of 'on_activate' | 'on_deactivate' | 'on_uninstall'.
     * @return void
     */
    public static function run_module_lifecycle( string $method ): void {
        if ( ! class_exists( '\FotoGrids\Modules\Module_Registry' ) ) {
            return;
        }

        // Ensure modules are registered for this isolated request.
        do_action( Actions_System::MODULES_REGISTER );

        foreach ( \FotoGrids\Modules\Module_Registry::get_all() as $entry ) {
            $module = $entry['module'];

            if ( ! $module instanceof \FotoGrids\Modules\Lifecycle_Module_Interface ) {
                continue;
            }

            if ( is_callable( [ $module, $method ] ) ) {
                $module->{$method}();
            }
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
        $table_stats_daily = $wpdb->prefix . 'fotogrids_statistics_daily';
        $table_licenses = $wpdb->prefix . 'fotogrids_licenses';
        $table_gallery_albums = $wpdb->prefix . 'fotogrids_gallery_albums';
        $table_tags = $wpdb->prefix . 'fotogrids_tags';
        $table_item_metadata = $wpdb->prefix . 'fotogrids_item_metadata';
        $table_render_cache = $wpdb->prefix . 'fotogrids_render_cache';
        $table_permission_grants = $wpdb->prefix . 'fotogrids_permission_grants';

        $sql = "
        CREATE TABLE $table_item_meta (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          attachment_id BIGINT UNSIGNED NOT NULL,
          gallery_id BIGINT UNSIGNED DEFAULT NULL,
          position INT NOT NULL DEFAULT 0,
          item_type VARCHAR(20) NOT NULL DEFAULT 'image',
          caption TEXT DEFAULT NULL,
          description LONGTEXT DEFAULT NULL,
          credit TEXT DEFAULT NULL,
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
          KEY position (position),
          KEY item_type (item_type)
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

        CREATE TABLE $table_stats_daily (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          object_type ENUM('gallery','album','item') NOT NULL,
          object_id BIGINT UNSIGNED NOT NULL,
          viewed_date DATE NOT NULL,
          views BIGINT UNSIGNED NOT NULL DEFAULT 0,
          shares BIGINT UNSIGNED NOT NULL DEFAULT 0,
          PRIMARY KEY (id),
          UNIQUE KEY daily_idx (object_type, object_id, viewed_date),
          KEY viewed_date (viewed_date),
          KEY object_lookup (object_type, object_id)
        ) $charset_collate;

        CREATE TABLE $table_render_cache (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          object_type ENUM('gallery','album') NOT NULL,
          object_id BIGINT UNSIGNED NOT NULL,
          cache_key VARCHAR(64) NOT NULL,
          html LONGTEXT NOT NULL,
          cached_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY cache_key (cache_key),
          KEY object_lookup (object_type, object_id),
          KEY expires_at (expires_at)
        ) $charset_collate;

        CREATE TABLE $table_permission_grants (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          grantee_type ENUM('role','user','token') NOT NULL,
          grantee_id VARCHAR(64) NOT NULL,
          scope_type ENUM('global','gallery','album') NOT NULL DEFAULT 'global',
          scope_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
          capability VARCHAR(96) NOT NULL,
          state ENUM('granted','denied') NOT NULL DEFAULT 'granted',
          source VARCHAR(32) NOT NULL DEFAULT 'fotogrids',
          created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NULL,
          PRIMARY KEY (id),
          UNIQUE KEY grant_idx (grantee_type, grantee_id, scope_type, scope_id, capability),
          KEY capability (capability),
          KEY scope_lookup (scope_type, scope_id),
          KEY expires_at (expires_at)
        ) $charset_collate;
        ";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );

        do_action( Actions_System::ACTIVATE );

        update_option( 'fotogrids_db_version', '1.4' );
    }

    /**
     * Run database upgrades if needed
     *
     * Compares the stored db version against the current schema version.
     * The version check uses the options cache (no DB hit on the fast path),
     * so this is safe to call on every plugins_loaded without measurable overhead.
     * upgrade.php and dbDelta are only loaded when an upgrade is actually needed.
     *
     * @since 1.0.0
     */
    public static function maybe_upgrade() {
        $current = get_option( 'fotogrids_db_version', '0' );
        if ( version_compare( $current, '1.4', '<' ) ) {
            self::create_tables();
        }

        // Cap resync runs on 'init' priority 8 - after Permission_Registry::boot
        // (priority 7) and after Pro's listeners are attached, so module / tool
        // / Pro caps are all visible to the registry walk.
        if ( ! has_action( 'init', [ __CLASS__, 'maybe_resync_capabilities' ] ) ) {
            add_action( 'init', [ __CLASS__, 'maybe_resync_capabilities' ], 8 );
        }
    }

    /**
     * Re-run capability grants on existing installs whenever the cap catalogue
     * version moves forward.
     *
     * Activator::activate() only fires on plugin (re)activation, so any cap
     * added to the Permission_Registry after first install would never reach
     * the admin role on existing sites - producing silent permission denials
     * downstream (e.g. the modify_fotogrids_{gallery|album}_settings caps,
     * added with the Permissions Manager, gated every settings save and
     * caused the save pipeline to drop the payload while still returning a
     * success response).
     *
     * Bump CAPS_VERSION whenever atomic caps are added to Core_Permissions or
     * to a module's harvester so this resync runs once on next page load.
     *
     * Public so the 'init' hook can call it; not part of the external API.
     *
     * @since 1.0.0
     */
    public static function maybe_resync_capabilities(): void {
        $current = get_option( 'fotogrids_caps_version', '0' );
        if ( version_compare( $current, self::CAPS_VERSION, '>=' ) ) {
            return;
        }

        // 'init' has already fired by the time this runs (priority 8),
        // so the module/tool registries are already populated - pass false
        // to skip re-firing their registration actions.
        self::add_capabilities( false );
        update_option( 'fotogrids_caps_version', self::CAPS_VERSION, false );
    }

    /**
     * Current capability-catalogue version. Bump whenever new atomic caps are
     * added to Core_Permissions or to a module's harvester so existing installs
     * receive them via Activator::maybe_resync_capabilities.
     */
    private const CAPS_VERSION = '1.1';

    /**
     * Add plugin capabilities to WordPress roles.
     *
     * Reads every atomic capability from Permission_Registry and grants it to
     * its default lowest role plus every role above on the WP role ladder.
     * The historical hand-rolled cap arrays are gone - the registry is the
     * single source of truth.
     *
     * Pro plugins can contribute additional capabilities via the
     * 'fotogrids/permissions/register' filter; those will be granted here
     * too when Pro is active during activation.
     *
     * @since 1.0.0
     */
    private static function add_capabilities( bool $bootstrap_registries = true ) {
        // The registry needs Tools_Registry and Module_Registry to be
        // populated to harvest their capabilities. Activation runs in an
        // isolated request where 'init' has not fired, so trigger the
        // registration actions explicitly. When called from the resync path
        // on a normal request, 'init' has already fired and re-firing these
        // actions would invoke listeners a second time - skip them.
        if ( $bootstrap_registries ) {
            do_action( Actions_System::MODULES_REGISTER );
            do_action( Actions_System::TOOLS_INIT );
        }

        \FotoGrids\Permissions\Permission_Registry::boot();

        foreach ( \FotoGrids\Permissions\Permission_Registry::get_all() as $def ) {
            if ( $def->is_logical() ) {
                // Logical caps are not real WP caps - their underlying atomic
                // caps each registered separately and get granted there.
                continue;
            }

            $roles = self::roles_at_or_above( $def->default_lowest_role );
            foreach ( $roles as $role_name ) {
                $role = get_role( $role_name );
                if ( $role ) {
                    $role->add_cap( $def->key );
                }
            }
        }
    }

    /**
     * Return the standard WP role ladder from the given role and up.
     *
     * Used by the activator and by the permissions REST endpoints. Roles
     * outside the standard ladder (custom roles created by other plugins)
     * are not granted defaults - administrators can grant them via the
     * matrix later if Pro is active.
     *
     * @param string $lowest_role 'administrator' | 'editor' | 'author' | 'contributor' | 'subscriber'.
     * @return string[] Role slugs, most-privileged first.
     */
    public static function roles_at_or_above( string $lowest_role ): array {
        $ladder = [ 'administrator', 'editor', 'author', 'contributor', 'subscriber' ];
        $index  = array_search( $lowest_role, $ladder, true );
        if ( $index === false ) {
            // Unknown role - grant administrators only.
            return [ 'administrator' ];
        }
        return array_slice( $ladder, 0, $index + 1 );
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
