<?php
/**
 * Remote template catalog client.
 *
 * Fetches the FotoGrids template catalog from the library service, caches it in
 * a transient, and falls back to the bundled templates when the service is
 * unreachable. The plugin only contacts the service when the user opens the
 * Templates screen (consent-by-use); it never phones home on a normal load.
 *
 * @package FotoGrids\REST\Templates
 * @since   1.1.0
 */

namespace FotoGrids\REST\Templates;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Catalog client: remote fetch with transient cache and bundled fallback.
 *
 * @since 1.1.0
 */
class Templates_Catalog {

	/**
	 * Library catalog endpoint.
	 */
	const CATALOG_URL = 'https://library.fotogrids.com/wp-json/fotogrids-library/v1/catalog';

	/**
	 * Transient key for the cached catalog payload.
	 */
	const CACHE_KEY = 'fotogrids_remote_catalog';

	/**
	 * Option key storing metadata about the last successful fetch
	 * (timestamp + source + catalog generated date).
	 */
	const META_KEY = 'fotogrids_remote_catalog_meta';

	/**
	 * Default cache lifetime (seconds). Filterable.
	 */
	const CACHE_TTL = 43200; // 12 hours.

	/**
	 * HTTP request timeout (seconds).
	 */
	const REQUEST_TIMEOUT = 8;

	/**
	 * Return the catalog templates, preferring the remote service.
	 *
	 * Order of resolution:
	 *   1. Cached remote catalog (transient), if present.
	 *   2. Fresh remote fetch, cached on success.
	 *   3. Bundled fallback templates (offline / service down).
	 *
	 * @since 1.1.0
	 * @param bool $force_refresh Bypass the transient and refetch.
	 * @return array<int, array<string, mixed>> Template entries.
	 */
	public static function get_templates( $force_refresh = false ) {
		if ( ! $force_refresh ) {
			$cached = get_transient( self::CACHE_KEY );
			if ( is_array( $cached ) ) {
				return $cached;
			}
		}

		$remote = self::fetch_remote();
		if ( null !== $remote ) {
			set_transient( self::CACHE_KEY, $remote['templates'], self::cache_ttl() );
			update_option(
				self::META_KEY,
				array(
					'fetched_at' => time(),
					'generated'  => $remote['generated'],
					'source'     => 'remote',
					'count'      => count( $remote['templates'] ),
					'flags'      => $remote['flags'],
				),
				false
			);
			return $remote['templates'];
		}

		// Service unreachable - serve whatever we last cached, else bundled.
		$cached = get_transient( self::CACHE_KEY );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		return self::fallback_templates();
	}

	/**
	 * Metadata about the last successful catalog fetch.
	 *
	 * `fetched_at` is the moment of the last successful server fetch, not the
	 * last page load: between fetches the catalog is served from the cache, so
	 * this can legitimately read up to the cache lifetime old. `synced_human`
	 * is a ready-to-render relative string ("2 hours ago") so the admin UI does
	 * not need its own time-ago formatter.
	 *
	 * @since 1.1.0
	 * @return array{fetched_at:int, generated:string, source:string, count:int, synced_human:string}|array{}
	 */
	public static function get_meta() {
		$meta = get_option( self::META_KEY );
		if ( ! is_array( $meta ) ) {
			return array();
		}

		if ( ! empty( $meta['fetched_at'] ) ) {
			$meta['synced_human'] = human_time_diff( (int) $meta['fetched_at'], time() );
		}

		$meta['flags'] = self::normalize_flags( isset( $meta['flags'] ) ? $meta['flags'] : array() );

		return $meta;
	}

	/**
	 * Clear the cached catalog (e.g. a manual "refresh library" action).
	 *
	 * @since 1.1.0
	 * @return void
	 */
	public static function clear_cache() {
		delete_transient( self::CACHE_KEY );
	}

	/**
	 * Fetch and validate the remote catalog.
	 *
	 * @since 1.1.0
	 * @return array{templates: array<int, array<string, mixed>>, generated: string}|null
	 *         Payload on success, or null on failure.
	 */
	private static function fetch_remote() {
		/**
		 * Filter the catalog endpoint URL (e.g. to point at a staging library).
		 *
		 * @since 1.1.0
		 * @param string $url Catalog endpoint.
		 */
		$url = apply_filters( 'fotogrids/templates/catalog_url', self::CATALOG_URL );

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => self::REQUEST_TIMEOUT,
				'headers' => array( 'Accept' => 'application/json' ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return null;
		}

		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		$body = wp_remote_retrieve_body( $response );
		if ( ! $body ) {
			return null;
		}

		$data = json_decode( $body, true );
		if ( ! is_array( $data ) || ! isset( $data['templates'] ) || ! is_array( $data['templates'] ) ) {
			return null;
		}

		$templates = array();
		foreach ( $data['templates'] as $entry ) {
			$valid = self::sanitize_entry( $entry );
			if ( null !== $valid ) {
				$templates[] = $valid;
			}
		}

		if ( empty( $templates ) ) {
			return null;
		}

		return array(
			'templates' => $templates,
			'generated' => isset( $data['generated'] ) ? sanitize_text_field( $data['generated'] ) : '',
			'flags'     => self::normalize_flags( isset( $data['flags'] ) ? $data['flags'] : array() ),
		);
	}

	/**
	 * Normalize catalog-level feature flags from the remote payload.
	 *
	 * `show_pro` defaults to true so an older library response with no flags
	 * block keeps surfacing Pro templates.
	 *
	 * @since 1.1.0
	 * @param mixed $flags Raw flags value.
	 * @return array{show_pro: bool}
	 */
	private static function normalize_flags( $flags ) {
		$flags = is_array( $flags ) ? $flags : array();

		return array(
			'show_pro' => isset( $flags['show_pro'] ) ? (bool) $flags['show_pro'] : true,
		);
	}

	/**
	 * The catalog feature flags from the last successful fetch.
	 *
	 * @since 1.1.0
	 * @return array{show_pro: bool}
	 */
	public static function get_flags() {
		$meta = self::get_meta();
		if ( isset( $meta['flags'] ) && is_array( $meta['flags'] ) ) {
			return self::normalize_flags( $meta['flags'] );
		}

		return self::normalize_flags( array() );
	}

	/**
	 * Validate and normalize one remote catalog entry.
	 *
	 * Drops entries that can't be used: a missing id, or a free template with
	 * no settings (it would apply nothing). Pro entries need no settings.
	 *
	 * @since 1.1.0
	 * @param mixed $entry Raw entry.
	 * @return array<string, mixed>|null Normalized entry, or null to skip.
	 */
	private static function sanitize_entry( $entry ) {
		if ( ! is_array( $entry ) || empty( $entry['id'] ) ) {
			return null;
		}

		$type     = isset( $entry['type'] ) ? (string) $entry['type'] : 'free';
		$is_pro   = 'pro' === $type;
		$settings = isset( $entry['settings'] ) && is_array( $entry['settings'] ) ? $entry['settings'] : array();

		// A free/user template with no settings can't apply anything - skip it
		// rather than offer an Apply that silently does nothing.
		if ( ! $is_pro && empty( $settings ) ) {
			return null;
		}

		$normalized = array(
			'id'             => sanitize_text_field( $entry['id'] ),
			'name'           => isset( $entry['name'] ) ? sanitize_text_field( $entry['name'] ) : '',
			'description'    => isset( $entry['description'] ) ? sanitize_textarea_field( $entry['description'] ) : '',
			'type'           => $is_pro ? 'pro' : ( 'user' === $type ? 'user' : 'free' ),
			'category'       => isset( $entry['category'] ) && 'album' === $entry['category'] ? 'album' : 'gallery',
			'subcategory'    => isset( $entry['subcategory'] ) ? sanitize_text_field( $entry['subcategory'] ) : '',
			'order'          => isset( $entry['order'] ) ? (int) $entry['order'] : 999,
			'image_set'      => isset( $entry['image_set'] ) ? sanitize_text_field( $entry['image_set'] ) : '',
			'thumbnail_url'  => isset( $entry['thumbnail_url'] ) ? esc_url_raw( $entry['thumbnail_url'] ) : '',
			'preview_url'    => isset( $entry['preview_url'] ) ? esc_url_raw( $entry['preview_url'] ) : '',
			'isUserTemplate' => 'user' === $type,
		);

		if ( ! $is_pro ) {
			$normalized['settings'] = $settings;
		}

		return $normalized;
	}

	/**
	 * Bundled fallback templates, read from the on-disk JSON set.
	 *
	 * Used only when the remote service is unreachable and nothing is cached.
	 * Delegates to the existing on-disk loader so there is a single source of
	 * the bundled set.
	 *
	 * @since 1.1.0
	 * @return array<int, array<string, mixed>>
	 */
	private static function fallback_templates() {
		if ( method_exists( '\FotoGrids\REST\Templates\Templates_Data', 'load_bundled_templates' ) ) {
			return Templates_Data::load_bundled_templates();
		}

		return array();
	}

	/**
	 * Resolve the cache TTL.
	 *
	 * @since 1.1.0
	 * @return int Seconds.
	 */
	private static function cache_ttl() {
		/**
		 * Filter the catalog cache lifetime in seconds.
		 *
		 * @since 1.1.0
		 * @param int $ttl Default 12 hours.
		 */
		return (int) apply_filters( 'fotogrids/templates/catalog_cache_ttl', self::CACHE_TTL );
	}
}
