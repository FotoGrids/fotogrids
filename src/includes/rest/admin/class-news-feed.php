<?php
/**
 * Remote news client for the dashboard widget and the What's New panel.
 *
 * Requests the latest posts in the News category from the public FotoGrids
 * blog, caches the normalized result in a transient, and falls back to the
 * announcements bundled with the plugin when the site is unreachable. The
 * request is made from the site's server, carries no site or user data, and
 * only runs when the dashboard widget or the What's New panel asks for it.
 *
 * @package FotoGrids\REST\Admin
 * @since   1.0.0
 */

namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * News client: remote fetch with transient cache and bundled fallback.
 *
 * @since 1.0.0
 */
class News_Feed {

	/**
	 * Public posts endpoint on the FotoGrids blog.
	 */
	const FEED_URL = 'https://www.fotogrids.com/wp-json/wp/v2/posts';

	/**
	 * Term ID of the blog's News category.
	 */
	const CATEGORY_ID = 160;

	/**
	 * Bundled fallback file, relative to the plugin directory.
	 */
	const BUNDLED_FILE = 'config/news.json';

	/**
	 * Option key holding the site owner's opt-out for the feed.
	 */
	const OPTION_ENABLED = 'fotogrids_allow_news_updates';

	/**
	 * Transient key for the cached, normalized items.
	 */
	const CACHE_KEY = 'fotogrids_news_feed';

	/**
	 * Transient key marking a recent failed fetch.
	 */
	const FAILURE_KEY = 'fotogrids_news_feed_failed';

	/**
	 * Cache lifetime for a successful fetch (seconds).
	 */
	const CACHE_TTL = 43200; // 12 hours.

	/**
	 * Cache lifetime for a failed fetch (seconds).
	 *
	 * A short negative cache keeps an unreachable site from being retried on
	 * every request while still recovering within the hour.
	 */
	const FAILURE_TTL = 3600; // 1 hour.

	/**
	 * HTTP request timeout (seconds).
	 */
	const REQUEST_TIMEOUT = 8;

	/**
	 * Maximum items kept from a feed response.
	 */
	const MAX_ITEMS = 10;

	/**
	 * Summary length: words, then a hard character ceiling.
	 */
	const SUMMARY_WORDS = 50;
	const SUMMARY_CHARS = 320;

	/**
	 * Whether the site owner allows the feed to be fetched.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	public static function is_enabled(): bool {
		return (bool) get_option( self::OPTION_ENABLED, true );
	}

	/**
	 * Return the news items, newest first.
	 *
	 * Order of resolution: cached items, then a fresh fetch, then the bundled
	 * announcements. Returns an empty list when the site owner has turned the
	 * feed off.
	 *
	 * @since  1.0.0
	 * @param  bool $force_refresh Bypass the transient and refetch.
	 * @return array<int, array<string, string>> Normalized news items.
	 */
	public static function get_items( bool $force_refresh = false ): array {
		if ( ! self::is_enabled() ) {
			return array();
		}

		if ( ! $force_refresh ) {
			$cached = get_transient( self::CACHE_KEY );
			if ( is_array( $cached ) && ! empty( $cached ) ) {
				return $cached;
			}

			if ( get_transient( self::FAILURE_KEY ) ) {
				return self::bundled_items();
			}
		}

		$items = self::fetch_remote();

		if ( null === $items ) {
			set_transient( self::FAILURE_KEY, 1, self::FAILURE_TTL );
			return self::bundled_items();
		}

		delete_transient( self::FAILURE_KEY );
		set_transient( self::CACHE_KEY, $items, self::cache_ttl() );

		return $items;
	}

	/**
	 * Clear the cached feed.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function clear_cache(): void {
		delete_transient( self::CACHE_KEY );
		delete_transient( self::FAILURE_KEY );
	}

	/**
	 * Fetch and normalize the remote feed.
	 *
	 * @since  1.0.0
	 * @return array<int, array<string, string>>|null Items on success, null on failure.
	 */
	private static function fetch_remote(): ?array {
		/**
		 * Filters the news feed endpoint URL.
		 *
		 * @since 1.0.0
		 * @param string $url Posts endpoint.
		 */
		$url = apply_filters( 'fotogrids/news/feed_url', self::FEED_URL );

		/**
		 * Filters the category the news feed is drawn from.
		 *
		 * @since 1.0.0
		 * @param int $category_id Term ID.
		 */
		$category_id = (int) apply_filters( 'fotogrids/news/category_id', self::CATEGORY_ID );

		$url = add_query_arg(
			array(
				'categories' => $category_id,
				'per_page'   => self::MAX_ITEMS,
				'orderby'    => 'date',
				'order'      => 'desc',
				'_fields'    => 'id,link,title,excerpt,date',
			),
			$url
		);

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

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) ) {
			return null;
		}

		$items = self::normalize_items( $data );

		return empty( $items ) ? null : $items;
	}

	/**
	 * Read the announcements bundled with the plugin.
	 *
	 * @since  1.0.0
	 * @return array<int, array<string, string>> Normalized news items.
	 */
	private static function bundled_items(): array {
		$path = FOTOGRIDS_PLUGIN_DIR . self::BUNDLED_FILE;

		if ( ! file_exists( $path ) ) {
			return array();
		}

		$contents = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled plugin file, not a remote resource.
		if ( false === $contents ) {
			return array();
		}

		$data = json_decode( $contents, true );
		if ( ! is_array( $data ) ) {
			return array();
		}

		$raw = isset( $data['news'] ) && is_array( $data['news'] ) ? $data['news'] : $data;

		return self::normalize_items( $raw );
	}

	/**
	 * Normalize a raw item list, newest first, capped to the feed length.
	 *
	 * Accepts both the blog's REST post shape and the flat shape used by the
	 * bundled file.
	 *
	 * @since  1.0.0
	 * @param  array<int, mixed> $raw Raw items.
	 * @return array<int, array<string, string>>
	 */
	private static function normalize_items( array $raw ): array {
		$items = array();

		foreach ( $raw as $entry ) {
			$item = self::sanitize_entry( $entry );
			if ( null !== $item ) {
				$items[] = $item;
			}
		}

		usort(
			$items,
			static function ( $a, $b ) {
				return strcmp( $b['date'], $a['date'] );
			}
		);

		return array_slice( $items, 0, self::MAX_ITEMS );
	}

	/**
	 * Validate and normalize one news item.
	 *
	 * @since  1.0.0
	 * @param  mixed $entry Raw item payload.
	 * @return array<string, string>|null Normalized item, or null to skip.
	 */
	private static function sanitize_entry( $entry ): ?array {
		if ( ! is_array( $entry ) ) {
			return null;
		}

		$title = self::plain_text( self::read_rendered( $entry, 'title' ) );
		if ( '' === $title ) {
			return null;
		}

		$url = isset( $entry['link'] ) ? (string) $entry['link'] : ( isset( $entry['url'] ) ? (string) $entry['url'] : '' );

		$date      = isset( $entry['date'] ) ? (string) $entry['date'] : '';
		$timestamp = $date ? strtotime( $date ) : false;

		return array(
			'id'         => isset( $entry['id'] ) ? (string) $entry['id'] : '',
			'title'      => $title,
			'summary'    => self::summarize( self::plain_text( self::read_rendered( $entry, 'excerpt', 'summary' ) ) ),
			'url'        => esc_url_raw( $url ),
			'date'       => $timestamp ? gmdate( 'c', $timestamp ) : '',
			'date_label' => $timestamp ? date_i18n( get_option( 'date_format' ), $timestamp ) : '',
		);
	}

	/**
	 * Read a field that may be a plain string or a `rendered` object.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $entry    Raw item.
	 * @param  string               $key      Primary field name.
	 * @param  string               $fallback Alternative field name.
	 * @return string Raw value.
	 */
	private static function read_rendered( array $entry, string $key, string $fallback = '' ): string {
		$value = $entry[ $key ] ?? ( '' !== $fallback ? ( $entry[ $fallback ] ?? '' ) : '' );

		if ( is_array( $value ) ) {
			$value = $value['rendered'] ?? '';
		}

		return (string) $value;
	}

	/**
	 * Reduce a remote string to a single line of plain text.
	 *
	 * Feed strings arrive as rendered, texturized markup; both surfaces render
	 * them as text nodes, so entities are decoded here rather than left to
	 * display literally.
	 *
	 * @since  1.0.0
	 * @param  string $value Raw string.
	 * @return string Plain text.
	 */
	private static function plain_text( string $value ): string {
		$text = wp_strip_all_tags( $value, true );
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		return trim( sanitize_text_field( $text ) );
	}

	/**
	 * Trim a summary to the display length.
	 *
	 * @since  1.0.0
	 * @param  string $text Plain text.
	 * @return string Trimmed summary.
	 */
	private static function summarize( string $text ): string {
		// WordPress appends a "[…]" marker to auto-generated excerpts.
		$text = (string) preg_replace( '/\s*\[(?:…|\.\.\.)\]\s*$/u', '', $text );

		if ( '' === $text ) {
			return '';
		}

		$words     = preg_split( '/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY );
		$words     = is_array( $words ) ? $words : array();
		$truncated = count( $words ) > self::SUMMARY_WORDS;
		$summary   = implode( ' ', array_slice( $words, 0, self::SUMMARY_WORDS ) );

		if ( mb_strlen( $summary ) > self::SUMMARY_CHARS ) {
			$summary   = (string) preg_replace( '/\s+\S*$/u', '', mb_substr( $summary, 0, self::SUMMARY_CHARS ) );
			$truncated = true;
		}

		if ( ! $truncated ) {
			return $summary;
		}

		return rtrim( $summary, " \t\n\r\0\x0B.,;:–-" ) . '…';
	}

	/**
	 * Resolve the cache lifetime for a successful fetch.
	 *
	 * @since  1.0.0
	 * @return int Seconds.
	 */
	private static function cache_ttl(): int {
		/**
		 * Filters the news feed cache lifetime.
		 *
		 * @since 1.0.0
		 * @param int $ttl Seconds.
		 */
		$ttl = (int) apply_filters( 'fotogrids/news/cache_ttl', self::CACHE_TTL );

		return $ttl > 0 ? $ttl : self::CACHE_TTL;
	}
}
