<?php
/**
 * Render-time swapping of clean image URLs to watermarked variants.
 *
 * @package FotoGrids\Watermark
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Watermark;

use FotoGrids\Settings\Watermark_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Rewrites image URLs to their `-fgwm` watermarked siblings while a
 * watermark-enabled collection is being rendered.
 *
 * The render pipeline wraps each collection render in begin()/end(). begin()
 * pushes whether that collection's watermark is enabled (per
 * Watermark_Settings_Store::resolve); the active state is the top of the stack,
 * so nested album → gallery renders each apply their own setting and restore
 * cleanly. While any frame is active a single filter on
 * wp_calculate_image_srcset rewrites srcset candidates; the renderer rewrites
 * the thumbnail and full URLs directly via is_active() + rewrite_url().
 *
 * A URL is only swapped when its `-fgwm` sibling actually exists on disk, so a
 * collection with un-generated variants degrades to clean images rather than
 * 404s. Existence checks are cached per request.
 *
 * @since 1.0.0
 */
final class Watermark_Render_Filter {

	/**
	 * Stack of per-collection enabled flags, innermost render last.
	 *
	 * @var bool[]
	 */
	private static $stack = array();

	/**
	 * Whether the srcset filter is currently registered.
	 *
	 * @var bool
	 */
	private static $filter_added = false;

	/**
	 * Cache of clean-URL → swapped-URL (or the clean URL when no variant).
	 *
	 * @var array<string, string>
	 */
	private static $url_cache = array();

	/**
	 * Begin a collection render scope.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery or album ID being rendered (0 for previews).
	 * @return void
	 */
	public static function begin( int $gallery_id ): void {
		$enabled = false;

		if ( $gallery_id > 0 ) {
			$resolved = Watermark_Settings_Store::resolve( $gallery_id );
			$enabled  = ! empty( $resolved['enabled'] );
		}

		self::$stack[] = $enabled;

		if ( $enabled && ! self::$filter_added ) {
			add_filter( 'wp_calculate_image_srcset', array( __CLASS__, 'filter_srcset' ), 10, 1 );
			self::$filter_added = true;
		}
	}

	/**
	 * End the innermost collection render scope.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function end(): void {
		array_pop( self::$stack );

		if ( empty( self::$stack ) && self::$filter_added ) {
			remove_filter( 'wp_calculate_image_srcset', array( __CLASS__, 'filter_srcset' ), 10 );
			self::$filter_added = false;
		}
	}

	/**
	 * Whether the innermost active render scope has watermarking enabled.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function is_active(): bool {
		return ! empty( self::$stack ) && end( self::$stack ) === true;
	}

	/**
	 * Swap a clean image URL for its watermarked sibling when active and the
	 * variant file exists; otherwise return the URL unchanged.
	 *
	 * @since 1.0.0
	 * @param string $url Clean image URL.
	 * @return string
	 */
	public static function rewrite_url( string $url ): string {
		if ( '' === $url || ! self::is_active() ) {
			return $url;
		}

		if ( isset( self::$url_cache[ $url ] ) ) {
			return self::$url_cache[ $url ];
		}

		$swapped = self::variant_exists( $url ) ? Watermark_Paths::wm_url( $url ) : $url;

		self::$url_cache[ $url ] = $swapped;

		return $swapped;
	}

	/**
	 * Filter callback for wp_calculate_image_srcset: rewrite each candidate URL.
	 *
	 * @since 1.0.0
	 * @param array<int, array<string, mixed>> $sources Srcset source descriptors.
	 * @return array<int, array<string, mixed>>
	 */
	public static function filter_srcset( $sources ) {
		if ( ! is_array( $sources ) || ! self::is_active() ) {
			return $sources;
		}

		foreach ( $sources as $key => $source ) {
			if ( ! empty( $source['url'] ) && is_string( $source['url'] ) ) {
				$sources[ $key ]['url'] = self::rewrite_url( $source['url'] );
			}
		}

		return $sources;
	}

	/**
	 * Whether the watermarked sibling for a clean URL exists on disk.
	 *
	 * Maps the URL into the uploads directory, then checks the `-fgwm` sibling.
	 * URLs outside the uploads base, or already watermarked, return false.
	 *
	 * @since 1.0.0
	 * @param string $clean_url Clean image URL.
	 * @return bool
	 */
	private static function variant_exists( string $clean_url ): bool {
		if ( Watermark_Paths::is_wm_path( $clean_url ) ) {
			return false;
		}

		$uploads = wp_get_upload_dir();
		$baseurl = $uploads['baseurl'] ?? '';
		$basedir = $uploads['basedir'] ?? '';

		if ( '' === $baseurl || '' === $basedir || strpos( $clean_url, $baseurl ) !== 0 ) {
			return false;
		}

		// Strip any query string before mapping to a path.
		$path_part = strtok( $clean_url, '?#' );
		if ( false === $path_part ) {
			return false;
		}

		$relative   = substr( $path_part, strlen( $baseurl ) );
		$clean_path = $basedir . $relative;
		$wm_path    = Watermark_Paths::wm_path( $clean_path );

		return is_string( $wm_path ) && file_exists( $wm_path );
	}
}
