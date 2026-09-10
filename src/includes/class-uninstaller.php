<?php
namespace FotoGrids;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.SchemaChange

	/**
	 * Uninstall the plugin completely
	 */
	public static function uninstall() {
		if ( ! self::should_delete_data() ) {
			return;
		}

		self::remove_cpt_posts();

		// Let lifecycle modules drop the tables/options they own before the
		// core cleanup runs. Guarded: if the registry is not loaded in this
		// uninstall request, the blanket option/postmeta cleanup below still
		// removes module options, and a module's own uninstall hook (if it
		// registered one against WordPress) handles its tables.
		if ( class_exists( '\FotoGrids\Activator' ) ) {
			Activator::run_module_lifecycle( 'on_uninstall' );
		}

		self::drop_tables();
		self::remove_capabilities();
		self::remove_options();
		self::remove_post_meta();
		self::remove_transients();
	}

	/**
	 * Check if we should delete plugin data
	 */
	private static function should_delete_data() {
		$preserve_data = get_option( 'fotogrids_preserve_data_on_uninstall', true );

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
			$wpdb->prefix . 'fotogrids_gallery_albums',
			$wpdb->prefix . 'fotogrids_tags',
			$wpdb->prefix . 'fotogrids_item_metadata',
			$wpdb->prefix . 'fotogrids_render_cache',
		);

		foreach ( $tables as $table ) {
			$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- table name is plugin-owned and never user input.
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

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
				$wpdb->esc_like( 'fotogrids_' ) . '%'
			)
		);
	}

	/**
	 * Remove plugin post meta.
	 *
	 * Matches the `fotogrids_*` keys on collection posts, the `_fotogrids_*`
	 * keys on attachments, and the FotoGrids-owned `_wp_attachment_item_alt`.
	 * Core's `_wp_attachment_image_alt` is matched by none of the three.
	 */
	private static function remove_post_meta() {
		global $wpdb;

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->postmeta}
                 WHERE meta_key LIKE %s
                    OR meta_key LIKE %s
                    OR meta_key = %s",
				$wpdb->esc_like( 'fotogrids_' ) . '%',
				$wpdb->esc_like( '_fotogrids_' ) . '%',
				'_wp_attachment_item_alt'
			)
		);
	}

	/**
	 * Remove plugin transients
	 */
	private static function remove_transients() {
		global $wpdb;

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options}
                 WHERE option_name LIKE %s
                    OR option_name LIKE %s",
				$wpdb->esc_like( '_transient_fotogrids_' ) . '%',
				$wpdb->esc_like( '_transient_timeout_fotogrids_' ) . '%'
			)
		);
	}

	/**
	 * Delete every gallery, album and embed post.
	 *
	 * WordPress leaves posts of an unregistered post type in place, and the
	 * FotoGrids post types are not registered during the uninstall request, so
	 * the rows are collected with a direct query instead of WP_Query. That
	 * query carries no status filter: `post_status => 'any'` excludes trashed
	 * and auto-draft posts. Each row is removed with wp_delete_post() so core
	 * and third-party `before_delete_post` listeners clear their own data.
	 *
	 * @return void
	 */
	private static function remove_cpt_posts() {
		global $wpdb;

		$post_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
                 WHERE post_type IN ( %s, %s, %s )",
				'fotogrids_gallery',
				'fotogrids_album',
				'fotogrids_embed'
			)
		);

		if ( empty( $post_ids ) ) {
			return;
		}

		wp_defer_term_counting( true );
		wp_suspend_cache_invalidation( true );

		foreach ( $post_ids as $post_id ) {
			wp_delete_post( (int) $post_id, true );
		}

		wp_suspend_cache_invalidation( false );
		wp_defer_term_counting( false );
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.SchemaChange
}
