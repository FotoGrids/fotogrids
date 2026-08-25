<?php
/**
 * Read-only access to the WordPress debug log.
 *
 * @package FotoGrids\Diagnostics
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Diagnostics;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Debug Log Reader
 *
 * Shows the tail of the WordPress debug log. This covers what the plugin's own
 * capture cannot: errors raised before FotoGrids loaded, and requests that died
 * before any shutdown handler ran.
 *
 * Only the final chunk of the file is read, so a multi-gigabyte log costs the
 * same as a small one. The log is never written to, cleared, or moved - it
 * belongs to WordPress.
 *
 * @since 1.0.0
 */
final class Debug_Log_Reader {

	/**
	 * Bytes read from the end of the log. Comfortably more than the largest
	 * line count the UI will ask for, while staying cheap on a huge file.
	 */
	private const TAIL_BYTES = 262144;

	/**
	 * Whether the debug log can be read right now.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	public static function is_available(): bool {
		return '' !== self::log_path();
	}

	/**
	 * Returns the last lines of the debug log.
	 *
	 * @since  1.0.0
	 * @param  int $lines Maximum lines to return.
	 * @return array<string, mixed>
	 */
	public static function tail( int $lines = 200 ): array {
		$path = self::log_path();

		if ( '' === $path ) {
			return self::empty_result( '' );
		}

		// phpcs:disable WordPress.WP.AlternativeFunctions -- WP_Filesystem cannot seek, and reading a multi-gigabyte log whole to show its last lines is not an option.
		$size = (int) filesize( $path );

		if ( $size <= 0 ) {
			return self::empty_result( $path );
		}

		$handle = fopen( $path, 'rb' );

		if ( false === $handle ) {
			return self::empty_result( $path );
		}

		$offset = max( 0, $size - self::TAIL_BYTES );

		if ( $offset > 0 ) {
			fseek( $handle, $offset );
		}

		$chunk = stream_get_contents( $handle );
		fclose( $handle );
		// phpcs:enable WordPress.WP.AlternativeFunctions

		if ( ! is_string( $chunk ) || '' === trim( $chunk ) ) {
			return self::empty_result( $path );
		}

		$all = preg_split( '/\r\n|\r|\n/', rtrim( $chunk ) );
		$all = is_array( $all ) ? $all : array();

		// Seeking mid-file almost always lands inside a line; drop that fragment.
		$from_start = 0 === $offset;

		if ( ! $from_start && count( $all ) > 1 ) {
			array_shift( $all );
		}

		$shown = array_slice( $all, -$lines );

		return array(
			'available'  => true,
			'lines'      => array_values( self::strip_root( $shown ) ),
			'shown'      => count( $shown ),
			'path'       => Error_Store::relative_path( $path ),
			'size'       => $size,
			'size_label' => size_format( $size ),
			'truncated'  => ! $from_start || count( $all ) > count( $shown ),
		);
	}

	/**
	 * Removes the WordPress root from log lines so the server layout is not
	 * printed into the admin screen.
	 *
	 * @since  1.0.0
	 * @param  array<int, string> $lines Raw log lines.
	 * @return array<int, string>
	 */
	private static function strip_root( array $lines ): array {
		if ( ! defined( 'ABSPATH' ) ) {
			return $lines;
		}

		$root = wp_normalize_path( ABSPATH );

		if ( '' === $root ) {
			return $lines;
		}

		return array_map(
			static function ( $line ) use ( $root ): string {
				return str_replace( $root, '', wp_normalize_path( (string) $line ) );
			},
			$lines
		);
	}

	/**
	 * Result shape for a log that exists but has nothing to show.
	 *
	 * @since  1.0.0
	 * @param  string $path Resolved log path, or an empty string.
	 * @return array<string, mixed>
	 */
	private static function empty_result( string $path ): array {
		return array(
			'available'  => '' !== $path,
			'lines'      => array(),
			'shown'      => 0,
			'path'       => '' === $path ? '' : Error_Store::relative_path( $path ),
			'size'       => 0,
			'size_label' => '',
			'truncated'  => false,
		);
	}

	/**
	 * Resolves the debug log path, or an empty string when unreadable.
	 *
	 * @since  1.0.0
	 * @return string
	 */
	private static function log_path(): string {
		if ( ! defined( 'WP_DEBUG_LOG' ) || ! WP_DEBUG_LOG ) {
			return '';
		}

		$path = is_string( WP_DEBUG_LOG )
			? WP_DEBUG_LOG
			: WP_CONTENT_DIR . '/debug.log';

		if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
			return '';
		}

		if ( 'direct' !== get_filesystem_method() ) {
			return '';
		}

		return $path;
	}
}
