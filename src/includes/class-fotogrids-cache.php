<?php
declare(strict_types=1);

namespace FotoGrids;

use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Hooks\Actions_Gallery;
use FotoGrids\Hooks\Actions_Item;
use FotoGrids\Hooks\Filters_Cache;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * FotoGrids Cache
 *
 * Manages rendered HTML output caching for FotoGrids collections.
 * Storage is a dedicated DB table (fotogrids_render_cache) used as L2,
 * with wp_cache_* as a transparent L1 when a persistent object cache is active.
 *
 * @package FotoGrids
 * @since   1.0.0
 */
class FotoGrids_Cache {

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * FotoGrids_Cache is the L2 data layer over the custom
	 * fotogrids_render_cache table (with a composed Object_Cache as L1).
	 * The WPDB sniffs below are suppressed class-wide:
	 *
	 *  - DirectDatabaseQuery.DirectQuery: custom table, no WP_Query / core
	 *    API equivalent.
	 *  - DirectDatabaseQuery.NoCaching: this class IS the cache; wrapping its
	 *    own table reads in another object cache is meaningless.
	 *  - PreparedSQL.InterpolatedNotPrepared /
	 *    Security.DirectDB.UnescapedDBParameter: the interpolated table name
	 *    is `$wpdb->prefix . 'fotogrids_render_cache'` (a trusted literal --
	 *    WP placeholders cannot bind table identifiers). All user-supplied
	 *    *values* are passed through $wpdb->prepare().
	 * ---------------------------------------------------------------------
	 */
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	// phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
	// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

	private const OBJECT_CACHE_GROUP = 'fotogrids_render';
	private const OBJECT_CACHE_TTL   = 0;

	/**
	 * Shared object-cache (L1) primitive for the render cache.
	 *
	 * @var \FotoGrids\Cache\Object_Cache|null
	 */
	private static ?\FotoGrids\Cache\Object_Cache $l1 = null;

	/**
	 * Lazily build the L1 object-cache wrapper.
	 *
	 * @since  1.0.0
	 * @return \FotoGrids\Cache\Object_Cache
	 */
	private static function l1(): \FotoGrids\Cache\Object_Cache {
		if ( self::$l1 === null ) {
			self::$l1 = new \FotoGrids\Cache\Object_Cache( self::OBJECT_CACHE_GROUP, self::OBJECT_CACHE_TTL );
		}
		return self::$l1;
	}

	// -------------------------------------------------------------------------
	// Bootstrap
	// -------------------------------------------------------------------------

	/**
	 * Register all action listeners. Called once from fotogrids_init().
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function init(): void {
		add_action( Actions_Item::ADDED,              [ __CLASS__, 'on_item_mutation' ],    10, 2 );
		add_action( Actions_Item::REMOVED,            [ __CLASS__, 'on_item_mutation' ],    10, 2 );
		add_action( Actions_Item::META_UPDATED,       [ __CLASS__, 'on_item_mutation' ],    10, 2 );
		add_action( Actions_Gallery::REORDERED,       [ __CLASS__, 'on_gallery_mutation' ], 10, 1 );
		add_action( Actions_Gallery::SETTINGS_SAVED,  [ __CLASS__, 'on_gallery_mutation' ], 10, 1 );
		add_action( Actions_Gallery::DELETED,         [ __CLASS__, 'on_gallery_mutation' ], 10, 1 );
		add_action( Actions_Gallery::IMPORTED,        [ __CLASS__, 'on_gallery_mutation' ], 10, 1 );
	}

	// -------------------------------------------------------------------------
	// Action callbacks
	// -------------------------------------------------------------------------

	/**
	 * @since  1.0.0
	 * @param  int|mixed $attachment_id
	 * @param  int|mixed $gallery_id
	 * @return void
	 */
	public static function on_item_mutation( $attachment_id, $gallery_id ): void {
		self::flush_for_gallery( (int) $gallery_id );
	}

	/**
	 * @since  1.0.0
	 * @param  int|mixed $gallery_id
	 * @return void
	 */
	public static function on_gallery_mutation( $gallery_id ): void {
		self::flush_for_gallery( (int) $gallery_id );
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	/**
	 * Retrieve a cached entry for a gallery.
	 *
	 * Checks the object cache (L1) before hitting the DB (L2).
	 * Returns false on a miss or when the entry has expired.
	 *
	 * The return value is an associative array with:
	 *   - 'html' (string)  Rendered gallery HTML.
	 *   - 'css'  (array)   Handle → URL map (Asset_Resolver::get_css_asset_urls()).
	 *   - 'js'   (array)   Handle → {src, in_footer} map (Asset_Resolver::get_js_asset_data()).
	 *
	 * @since  1.0.0
	 * @param  int    $gallery_id
	 * @param  string $cache_key  md5 key produced by make_key().
	 * @return array{html: string, css: array<string, string>, js: array<string, array{src: string, in_footer: bool}>}|false
	 */
	public static function get( int $gallery_id, string $cache_key ) {
		$l1 = self::l1()->get( $cache_key );
		if ( $l1 !== false ) {
			return self::decode_entry( (string) $l1 );
		}

		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_render_cache';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT html FROM {$table}
				 WHERE cache_key = %s AND expires_at > %s
				 LIMIT 1",
				$cache_key,
				current_time( 'mysql' )
			)
		);

		if ( ! $row ) {
			return false;
		}

		self::l1()->set( $cache_key, $row->html );

		return self::decode_entry( $row->html );
	}

	/**
	 * Store a rendered gallery entry in the cache.
	 *
	 * The HTML string and the asset maps (CSS + JS) are encoded together so a
	 * cache hit can replay the exact assets that the original render required.
	 *
	 * Writes to both the DB (L2) and object cache (L1).
	 * Uses INSERT … ON DUPLICATE KEY UPDATE so concurrent requests producing the
	 * same cache_key are safe.
	 *
	 * @since  1.0.0
	 * @param  int                                            $gallery_id
	 * @param  string                                         $cache_key
	 * @param  string                                         $html
	 * @param  array<string, string>                          $css  Handle → URL map from Asset_Resolver::get_css_asset_urls().
	 * @param  array<string, array{src: string, in_footer: bool}> $js   Handle → metadata map from Asset_Resolver::get_js_asset_data().
	 * @param  int                                            $duration_hours
	 * @return bool
	 */
	public static function put( int $gallery_id, string $cache_key, string $html, array $css, array $js, int $duration_hours ): bool {
		global $wpdb;

		$payload    = self::encode_entry( $html, $css, $js );
		$table      = $wpdb->prefix . 'fotogrids_render_cache';
		$now        = current_time( 'mysql' );
		$expires_at = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) + $duration_hours * HOUR_IN_SECONDS );

		$result = $wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (object_type, object_id, cache_key, html, cached_at, expires_at)
				 VALUES ('gallery', %d, %s, %s, %s, %s)
				 ON DUPLICATE KEY UPDATE html = VALUES(html), cached_at = VALUES(cached_at), expires_at = VALUES(expires_at)",
				$gallery_id,
				$cache_key,
				$payload,
				$now,
				$expires_at
			)
		);

		if ( $result !== false ) {
			self::l1()->set( $cache_key, $payload );
		}

		return $result !== false;
	}

	/**
	 * Flush all cache entries for a specific gallery.
	 *
	 * @since  1.0.0
	 * @param  int $gallery_id
	 * @return void
	 */
	public static function flush_for_gallery( int $gallery_id ): void {
		if ( $gallery_id <= 0 ) {
			return;
		}

		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_render_cache';

		$keys = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT cache_key FROM {$table} WHERE object_type = 'gallery' AND object_id = %d",
				$gallery_id
			)
		);

		$wpdb->delete(
			$table,
			[ 'object_type' => 'gallery', 'object_id' => $gallery_id ],
			[ '%s', '%d' ]
		);

		foreach ( (array) $keys as $key ) {
			self::l1()->delete( (string) $key );
		}

		do_action( Actions_Cache::FLUSHED_FOR_GALLERY, $gallery_id );
	}

	/**
	 * Flush the entire render cache (all object types).
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function flush_all(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_render_cache';
		$wpdb->query( "DELETE FROM {$table}" );

		// Backend-agnostic group invalidation (orphans every namespaced L1 key)
		// in place of wp_cache_flush_group(), which not all backends implement.
		self::l1()->flush_namespace();

		do_action( Actions_Cache::FLUSHED_ALL );
	}

	/**
	 * Return metadata about the current cache state for a gallery.
	 *
	 * Used by the cache_status admin UI renderer.
	 * Returns null when no valid (non-expired) entries exist.
	 *
	 * @since  1.0.0
	 * @param  int $gallery_id
	 * @return array{cached_at: string, expires_at: string, entry_count: int}|null
	 */
	public static function get_meta( int $gallery_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_render_cache';

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT MIN(cached_at) AS cached_at, MIN(expires_at) AS expires_at, COUNT(*) AS entry_count
				 FROM {$table}
				 WHERE object_type = 'gallery' AND object_id = %d AND expires_at > %s",
				$gallery_id,
				current_time( 'mysql' )
			)
		);

		if ( ! $row || (int) $row->entry_count === 0 ) {
			return null;
		}

		return [
			'cached_at'   => $row->cached_at,
			'expires_at'  => $row->expires_at,
			'entry_count' => (int) $row->entry_count,
		];
	}

	/**
	 * Delete all expired rows from the cache table.
	 *
	 * Intended for use in a scheduled cleanup hook.
	 *
	 * @since  1.0.0
	 * @return int Number of rows deleted.
	 */
	public static function purge_expired(): int {
		global $wpdb;

		$table  = $wpdb->prefix . 'fotogrids_render_cache';
		$result = $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table} WHERE expires_at <= %s",
				current_time( 'mysql' )
			)
		);

		$deleted = is_int( $result ) ? $result : 0;

		if ( $deleted > 0 ) {
			do_action( Actions_Cache::PURGED_EXPIRED, $deleted );
		}

		return $deleted;
	}

	// -------------------------------------------------------------------------
	// Cacheability helpers
	// -------------------------------------------------------------------------

	/**
	 * Determine whether the current request should use the cache.
	 *
	 * Only universal, non-domain conditions are checked here.
	 * Domain-specific exclusions (gates, Pro features, etc.) are handled via
	 * the fotogrids/cache/should_cache filter.
	 *
	 * @since  1.0.0
	 * @param  array $settings  Gallery settings array.
	 * @param  int   $gallery_id
	 * @return bool
	 */
	public static function should_cache( array $settings, int $gallery_id ): bool {
		if ( empty( $settings['enable_cache'] ) ) {
			return false;
		}

		if ( self::is_privileged_user() ) {
			return false;
		}

		if ( is_preview() ) {
			return false;
		}

		if ( wp_doing_ajax() ) {
			return false;
		}

		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return false;
		}

		return (bool) apply_filters( Filters_Cache::SHOULD_CACHE, true, $settings, $gallery_id );
	}

	/**
	 * Build the cache key for a gallery render.
	 *
	 * The visitor bucket is included so that gates producing user-context-variant
	 * output (e.g. who_can_view = registered_users) naturally produce separate
	 * cache entries without the cache needing to know about gate logic.
	 * The bucket itself is filterable so any gate or module can append its own
	 * dimension via the fotogrids/cache/bucket filter.
	 *
	 * @since  1.0.0
	 * @param  int   $gallery_id
	 * @param  array $settings
	 * @param  array $item_ids
	 * @param  array $atts
	 * @return string
	 */
	public static function make_key( int $gallery_id, array $settings, array $item_ids, array $atts ): string {
		$cache_settings = $settings;
		unset( $cache_settings['enable_cache'], $cache_settings['cache_duration'] );

		$bucket = (string) apply_filters( Filters_Cache::BUCKET, 'default', $settings, $gallery_id );

		$payload = implode( '|', [
			$gallery_id,
			FOTOGRIDS_VERSION,
			$bucket,
			md5( serialize( $cache_settings ) ),
			implode( ',', $item_ids ),
			md5( serialize( $atts ) ),
		] );

		return md5( $payload );
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	/**
	 * Returns true when the current user has FotoGrids editing privileges.
	 *
	 * Privileged users always bypass the cache so they see live output and any
	 * inline render errors.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	private static function is_privileged_user(): bool {
		return is_user_logged_in()
			&& ( current_user_can( 'manage_fotogrids' ) || current_user_can( 'edit_fotogrids_galleries' ) );
	}

	/**
	 * Encode HTML, CSS, and JS asset maps into a single storable string.
	 *
	 * @since  1.0.0
	 * @param  string                                            $html
	 * @param  array<string, string>                             $css
	 * @param  array<string, array{src: string, in_footer: bool}> $js
	 * @return string
	 */
	private static function encode_entry( string $html, array $css, array $js ): string {
		return json_encode( [ 'html' => $html, 'css' => $css, 'js' => $js ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
	}

	/**
	 * Decode a stored entry back into its HTML, CSS, and JS components.
	 *
	 * Falls back gracefully for legacy entries that contain raw HTML (no JSON
	 * envelope) so an old cache row never causes a hard error.
	 *
	 * @since  1.0.0
	 * @param  string $stored
	 * @return array{html: string, css: array<string, string>, js: array<string, array{src: string, in_footer: bool}>}
	 */
	private static function decode_entry( string $stored ): array {
		$decoded = json_decode( $stored, true );
		if ( is_array( $decoded ) && isset( $decoded['html'] ) ) {
			return [
				'html' => (string) $decoded['html'],
				'css'  => is_array( $decoded['css'] ?? null ) ? $decoded['css'] : [],
				'js'   => is_array( $decoded['js'] ?? null ) ? $decoded['js'] : [],
			];
		}

		return [ 'html' => $stored, 'css' => [], 'js' => [] ];
	}

	// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
	// phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
	// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	// phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
	// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
