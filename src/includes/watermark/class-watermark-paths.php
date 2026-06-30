<?php
/**
 * Clean ↔ watermarked file path/URL mapping.
 *
 * @package FotoGrids\Watermark
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Watermark;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Single source of truth for the watermarked-variant naming rule.
 *
 * A watermarked variant lives beside its clean sub-size with a `-fgwm` token
 * inserted before the file extension, e.g.:
 *
 *   photo-1024x768.jpg        (clean WP sub-size)
 *   photo-1024x768-fgwm.jpg   (watermarked sibling)
 *
 * Every component that writes, reads, maps, or cleans up watermarked files
 * routes through this class, so the suffix rule can never drift between the
 * generator, the render filter, and the cleanup path. All methods are pure:
 * no filesystem or WordPress side effects.
 *
 * @since 1.0.0
 */
final class Watermark_Paths {

	/**
	 * Token inserted before the extension to mark a watermarked variant.
	 *
	 * @var string
	 */
	public const SUFFIX = '-fgwm';

	/**
	 * Map a clean filesystem path to its watermarked sibling path.
	 *
	 * Inserts the suffix before the final extension. A path with no extension
	 * gets the suffix appended. An already-watermarked path is returned
	 * unchanged (idempotent).
	 *
	 * @since 1.0.0
	 * @param string $clean_path Absolute or relative filesystem path.
	 * @return string Watermarked sibling path.
	 */
	public static function wm_path( string $clean_path ): string {
		if ( '' === $clean_path || self::is_wm_path( $clean_path ) ) {
			return $clean_path;
		}

		return self::insert_suffix( $clean_path );
	}

	/**
	 * Map a clean URL to its watermarked sibling URL.
	 *
	 * Preserves any query string or fragment (e.g. CDN cache-busters) by only
	 * transforming the path portion. An already-watermarked URL is returned
	 * unchanged.
	 *
	 * @since 1.0.0
	 * @param string $clean_url Image URL.
	 * @return string Watermarked sibling URL.
	 */
	public static function wm_url( string $clean_url ): string {
		if ( '' === $clean_url ) {
			return $clean_url;
		}

		[ $path, $tail ] = self::split_url( $clean_url );

		if ( self::is_wm_path( $path ) ) {
			return $clean_url;
		}

		return self::insert_suffix( $path ) . $tail;
	}

	/**
	 * Whether a path or URL already points at a watermarked variant.
	 *
	 * Checks the basename (ignoring any query string or fragment) for the
	 * `<suffix>.<ext>` ending, or a trailing `<suffix>` when there is no
	 * extension.
	 *
	 * @since 1.0.0
	 * @param string $path Path or URL.
	 * @return bool
	 */
	public static function is_wm_path( string $path ): bool {
		if ( '' === $path ) {
			return false;
		}

		[ $clean_path ] = self::split_url( $path );

		$dot   = strrpos( $clean_path, '.' );
		$slash = strrpos( $clean_path, '/' );

		// A dot that belongs to the filename (after the last slash) marks an
		// extension; otherwise the name has no extension.
		$has_ext = false !== $dot && ( false === $slash || $dot > $slash );

		$stem = $has_ext ? substr( $clean_path, 0, $dot ) : $clean_path;

		return substr( $stem, -strlen( self::SUFFIX ) ) === self::SUFFIX;
	}

	/**
	 * Map a watermarked path or URL back to its clean counterpart.
	 *
	 * Removes the suffix from before the extension. A path that is not a
	 * watermarked variant is returned unchanged. Query strings and fragments
	 * on URLs are preserved.
	 *
	 * @since 1.0.0
	 * @param string $wm_path Watermarked path or URL.
	 * @return string Clean path or URL.
	 */
	public static function clean_from_wm( string $wm_path ): string {
		if ( '' === $wm_path || ! self::is_wm_path( $wm_path ) ) {
			return $wm_path;
		}

		[ $path, $tail ] = self::split_url( $wm_path );

		[ $stem, $ext ] = self::split_extension( $path );

		$clean_stem = substr( $stem, 0, -strlen( self::SUFFIX ) );

		return $clean_stem . $ext . $tail;
	}

	/**
	 * Insert the suffix before the extension of a bare path (no query string).
	 *
	 * @since 1.0.0
	 * @param string $path Path without query string or fragment.
	 * @return string
	 */
	private static function insert_suffix( string $path ): string {
		[ $stem, $ext ] = self::split_extension( $path );

		return $stem . self::SUFFIX . $ext;
	}

	/**
	 * Split a bare path into [ stem, extension ] where extension includes the
	 * leading dot (or '' when there is no filename extension).
	 *
	 * @since 1.0.0
	 * @param string $path Path without query string or fragment.
	 * @return array{0: string, 1: string}
	 */
	private static function split_extension( string $path ): array {
		$dot   = strrpos( $path, '.' );
		$slash = strrpos( $path, '/' );

		$has_ext = false !== $dot && ( false === $slash || $dot > $slash );

		if ( ! $has_ext ) {
			return array( $path, '' );
		}

		return array( substr( $path, 0, $dot ), substr( $path, $dot ) );
	}

	/**
	 * Split a URL into [ path, tail ] where tail is the query string and/or
	 * fragment (including their leading `?`/`#`), or '' when neither is present.
	 *
	 * @since 1.0.0
	 * @param string $url URL or plain path.
	 * @return array{0: string, 1: string}
	 */
	private static function split_url( string $url ): array {
		$cut = strcspn( $url, '?#' );

		if ( strlen( $url ) === $cut ) {
			return array( $url, '' );
		}

		return array( substr( $url, 0, $cut ), substr( $url, $cut ) );
	}
}
