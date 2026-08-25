<?php
/**
 * Deduplicated store for captured FotoGrids errors.
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
 * Error Store
 *
 * Holds captured PHP and JS errors in a single non-autoloaded option, keyed by
 * fingerprint. A repeat of an error already in the store increments its
 * occurrence counter rather than adding a row, which is what keeps the entry
 * cap meaningful on a site throwing the same notice on every request.
 *
 * Writes are buffered for the request and flushed once on shutdown, so a
 * healthy request never touches the option at all.
 *
 * @since 1.0.0
 */
final class Error_Store {

	/**
	 * Option holding the fingerprint-keyed entry map.
	 */
	public const OPTION_KEY = 'fotogrids_error_log';

	/**
	 * Maximum entries retained. Oldest by last_seen are dropped first.
	 */
	private const MAX_ENTRIES = 150;

	/**
	 * Longest message retained, in characters.
	 */
	private const MAX_MESSAGE_LENGTH = 1000;

	/**
	 * Entries recorded during this request, keyed by fingerprint.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static array $buffer = array();

	/**
	 * Whether the shutdown flush has been registered.
	 *
	 * @var bool
	 */
	private static bool $flush_registered = false;

	/**
	 * Whether the buffer has already been written this request.
	 *
	 * @var bool
	 */
	private static bool $flushed = false;

	/**
	 * Buffers one error for writing at shutdown.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $entry Error fields. 'type' and 'message' are required.
	 * @return void
	 */
	public static function record( array $entry ): void {
		$type    = (string) ( $entry['type'] ?? 'php' );
		$message = trim( (string) ( $entry['message'] ?? '' ) );

		if ( '' === $message ) {
			return;
		}

		if ( strlen( $message ) > self::MAX_MESSAGE_LENGTH ) {
			$message = substr( $message, 0, self::MAX_MESSAGE_LENGTH ) . '…';
		}

		$level = (string) ( $entry['level'] ?? 'error' );
		$file  = (string) ( $entry['file'] ?? '' );
		$line  = (int) ( $entry['line'] ?? 0 );
		$now   = gmdate( 'Y-m-d H:i:s' );

		$fingerprint = md5( $type . '|' . $level . '|' . $message . '|' . $file . '|' . $line );

		if ( isset( self::$buffer[ $fingerprint ] ) ) {
			++self::$buffer[ $fingerprint ]['times'];
			self::$buffer[ $fingerprint ]['last_seen'] = $now;
		} else {
			self::$buffer[ $fingerprint ] = array(
				'type'           => $type,
				'level'          => $level,
				'message'        => $message,
				'file'           => $file,
				'line'           => $line,
				'context'        => $entry['context'] ?? array(),
				'source'         => (string) ( $entry['source'] ?? 'free' ),
				'plugin_version' => defined( 'FOTOGRIDS_VERSION' ) ? FOTOGRIDS_VERSION : '',
				'times'          => 1,
				'first_seen'     => $now,
				'last_seen'      => $now,
			);
		}

		if ( ! self::$flush_registered ) {
			self::$flush_registered = true;
			register_shutdown_function( array( self::class, 'flush' ) );
		}
	}

	/**
	 * Merges the request buffer into the stored map.
	 *
	 * Safe to call more than once; only the first call in a request writes.
	 * Never throws - a diagnostics write must not be able to break a response.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function flush(): void {
		if ( self::$flushed || empty( self::$buffer ) ) {
			return;
		}

		self::$flushed = true;

		try {
			$stored = get_option( self::OPTION_KEY, array() );

			if ( ! is_array( $stored ) ) {
				$stored = array();
			}

			foreach ( self::$buffer as $fingerprint => $entry ) {
				if ( isset( $stored[ $fingerprint ] ) && is_array( $stored[ $fingerprint ] ) ) {
					$stored[ $fingerprint ]['times']     = (int) ( $stored[ $fingerprint ]['times'] ?? 0 ) + (int) $entry['times'];
					$stored[ $fingerprint ]['last_seen'] = $entry['last_seen'];
					continue;
				}

				$stored[ $fingerprint ] = $entry;
			}

			$stored = self::prune( $stored );

			update_option( self::OPTION_KEY, $stored, false );
		} catch ( \Throwable $throwable ) {
			return;
		}

		self::$buffer = array();
	}

	/**
	 * Returns stored entries, newest first.
	 *
	 * @since  1.0.0
	 * @param  string $type Optional 'php' or 'js' filter.
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_all( string $type = '' ): array {
		$stored = get_option( self::OPTION_KEY, array() );

		if ( ! is_array( $stored ) ) {
			return array();
		}

		$entries = array();

		foreach ( $stored as $fingerprint => $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}

			$entry_type = (string) ( $entry['type'] ?? '' );

			if ( '' !== $type && $entry_type !== $type ) {
				continue;
			}

			$entry['fingerprint'] = $fingerprint;
			$entries[]            = $entry;
		}

		usort(
			$entries,
			static function ( array $a, array $b ): int {
				return strcmp( (string) ( $b['last_seen'] ?? '' ), (string) ( $a['last_seen'] ?? '' ) );
			}
		);

		return $entries;
	}

	/**
	 * Deletes stored entries.
	 *
	 * @since  1.0.0
	 * @param  string $type Optional 'php' or 'js' filter. Empty clears everything.
	 * @return int Number of entries removed.
	 */
	public static function clear( string $type = '' ): int {
		$stored = get_option( self::OPTION_KEY, array() );

		if ( ! is_array( $stored ) || empty( $stored ) ) {
			return 0;
		}

		if ( '' === $type ) {
			delete_option( self::OPTION_KEY );

			return count( $stored );
		}

		$kept    = array();
		$removed = 0;

		foreach ( $stored as $fingerprint => $entry ) {
			$entry_type = is_array( $entry ) ? (string) ( $entry['type'] ?? '' ) : '';

			if ( '' !== $entry_type && $entry_type === $type ) {
				++$removed;
				continue;
			}

			$kept[ $fingerprint ] = $entry;
		}

		update_option( self::OPTION_KEY, $kept, false );

		return $removed;
	}

	/**
	 * Makes a path safe to display by dropping the WordPress root.
	 *
	 * @since  1.0.0
	 * @param  string $path Absolute filesystem path.
	 * @return string
	 */
	public static function relative_path( string $path ): string {
		if ( '' === $path || ! defined( 'ABSPATH' ) ) {
			return $path;
		}

		$normalised = wp_normalize_path( $path );
		$root       = wp_normalize_path( ABSPATH );

		if ( str_starts_with( $normalised, $root ) ) {
			return substr( $normalised, strlen( $root ) );
		}

		return $normalised;
	}

	/**
	 * Drops the oldest entries once the map exceeds the cap.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $stored Entry map.
	 * @return array<string, mixed>
	 */
	private static function prune( array $stored ): array {
		if ( count( $stored ) <= self::MAX_ENTRIES ) {
			return $stored;
		}

		uasort(
			$stored,
			static function ( $a, $b ): int {
				$a_seen = is_array( $a ) ? (string) ( $a['last_seen'] ?? '' ) : '';
				$b_seen = is_array( $b ) ? (string) ( $b['last_seen'] ?? '' ) : '';

				return strcmp( $b_seen, $a_seen );
			}
		);

		return array_slice( $stored, 0, self::MAX_ENTRIES, true );
	}
}
