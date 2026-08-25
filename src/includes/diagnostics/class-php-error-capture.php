<?php
/**
 * Captures PHP errors raised by FotoGrids code.
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
 * PHP Error Capture
 *
 * Records PHP errors whose call stack passes through FotoGrids, so the System
 * Info tool can show them without the site owner reading a raw debug log.
 *
 * Booted from the main plugin file at file scope, before the plugin's own
 * requires, so a fatal during load is still caught by the shutdown handler.
 *
 * @since 1.0.0
 */
final class PHP_Error_Capture {

	/**
	 * Backtrace frames inspected when attributing an error.
	 */
	private const BACKTRACE_LIMIT = 15;

	/**
	 * Error handler that was installed before this one, if any.
	 *
	 * @var callable|null
	 */
	private static $previous_handler = null;

	/**
	 * Whether boot() has already run.
	 *
	 * @var bool
	 */
	private static bool $booted = false;

	/**
	 * Error levels recorded, mapped to the label shown in the UI.
	 *
	 * @var array<int, string>
	 */
	private const LEVEL_MAP = array(
		E_ERROR             => 'error',
		E_CORE_ERROR        => 'error',
		E_COMPILE_ERROR     => 'error',
		E_USER_ERROR        => 'error',
		E_RECOVERABLE_ERROR => 'error',
		E_PARSE             => 'error',
		E_WARNING           => 'warning',
		E_CORE_WARNING      => 'warning',
		E_COMPILE_WARNING   => 'warning',
		E_USER_WARNING      => 'warning',
		E_NOTICE            => 'notice',
		E_USER_NOTICE       => 'notice',
		E_DEPRECATED        => 'deprecated',
		E_USER_DEPRECATED   => 'deprecated',
	);

	/**
	 * Installs the shutdown and error handlers.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}

		self::$booted = true;

		register_shutdown_function( array( self::class, 'on_shutdown' ) );

		// The previous handler is kept and called through, so installing this
		// one never suppresses another plugin's error handling.
		self::$previous_handler = set_error_handler( array( self::class, 'on_error' ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_set_error_handler -- capturing FotoGrids errors is this class's purpose; the previous handler is kept and called through.
	}

	/**
	 * Records a fatal error that ended the request.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function on_shutdown(): void {
		$last = error_get_last();

		if ( null === $last ) {
			Error_Store::flush();

			return;
		}

		$fatal = array( E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_PARSE, E_USER_ERROR, E_RECOVERABLE_ERROR );

		if ( in_array( $last['type'], $fatal, true ) && self::is_fotogrids_path( (string) $last['file'] ) ) {
			Error_Store::record(
				array(
					'type'    => 'php',
					'level'   => self::LEVEL_MAP[ $last['type'] ] ?? 'error',
					'message' => (string) $last['message'],
					'file'    => Error_Store::relative_path( (string) $last['file'] ),
					'line'    => (int) $last['line'],
					'source'  => self::source_for( (string) $last['file'] ),
				)
			);
		}

		Error_Store::flush();
	}

	/**
	 * Records a non-fatal error, then hands control to the previous handler.
	 *
	 * @since  1.0.0
	 * @param  int    $errno   Error level.
	 * @param  string $message Error message.
	 * @param  string $file    File the error was raised in.
	 * @param  int    $line    Line the error was raised on.
	 * @return bool True to stop PHP's default handling, false to continue it.
	 */
	public static function on_error( int $errno, string $message, string $file = '', int $line = 0 ): bool {
		// A silenced expression (@) reports error_reporting() as 0 in PHP 7 and
		// as a fixed mask in PHP 8; either way the author asked for silence.
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.prevent_path_disclosure_error_reporting, WordPress.PHP.DiscouragedPHPFunctions.runtime_configuration_error_reporting, PluginCheck.CodeAnalysis.PHPErrorReporting.DirectErrorReportingCall -- read, never set; needed to honour the @ operator.
		if ( 0 === ( error_reporting() & $errno ) ) {
			return self::delegate( $errno, $message, $file, $line );
		}

		if ( isset( self::LEVEL_MAP[ $errno ] ) ) {
			$origin = self::attribute( $file, $line );

			if ( null !== $origin ) {
				Error_Store::record(
					array(
						'type'    => 'php',
						'level'   => self::LEVEL_MAP[ $errno ],
						'message' => $message,
						'file'    => Error_Store::relative_path( $origin['file'] ),
						'line'    => $origin['line'],
						'source'  => self::source_for( $origin['file'] ),
						'context' => array( 'raised_in' => Error_Store::relative_path( $file ) ),
					)
				);
			}
		}

		return self::delegate( $errno, $message, $file, $line );
	}

	/**
	 * Decides whether an error belongs to FotoGrids and where it originated.
	 *
	 * The file an error is raised in is often a WordPress core file called by
	 * plugin code, so the whole call stack is inspected and the first FotoGrids
	 * frame is reported as the origin.
	 *
	 * @since  1.0.0
	 * @param  string $file File the error was raised in.
	 * @param  int    $line Line the error was raised on.
	 * @return array{file: string, line: int}|null Null when the error is not ours.
	 */
	private static function attribute( string $file, int $line ): ?array {
		if ( self::is_fotogrids_path( $file ) ) {
			return array(
				'file' => $file,
				'line' => $line,
			);
		}

		$frames = debug_backtrace( DEBUG_BACKTRACE_IGNORE_ARGS, self::BACKTRACE_LIMIT ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_debug_backtrace -- attributing an error to the calling plugin requires the stack; arguments are excluded so no values are captured.

		foreach ( $frames as $frame ) {
			$frame_file = (string) ( $frame['file'] ?? '' );

			if ( '' !== $frame_file && self::is_fotogrids_path( $frame_file ) ) {
				return array(
					'file' => $frame_file,
					'line' => (int) ( $frame['line'] ?? 0 ),
				);
			}
		}

		return null;
	}

	/**
	 * Hands the error to whatever handler was installed before this one.
	 *
	 * @since  1.0.0
	 * @param  int    $errno   Error level.
	 * @param  string $message Error message.
	 * @param  string $file    File the error was raised in.
	 * @param  int    $line    Line the error was raised on.
	 * @return bool
	 */
	private static function delegate( int $errno, string $message, string $file, int $line ): bool {
		if ( null !== self::$previous_handler ) {
			return (bool) call_user_func( self::$previous_handler, $errno, $message, $file, $line );
		}

		// False lets PHP log and display the error exactly as it would have.
		return false;
	}

	/**
	 * Whether a path belongs to FotoGrids.
	 *
	 * @since  1.0.0
	 * @param  string $file Absolute filesystem path.
	 * @return bool
	 */
	private static function is_fotogrids_path( string $file ): bool {
		if ( '' === $file ) {
			return false;
		}

		$normalised = wp_normalize_path( $file );

		foreach ( self::related_paths() as $path ) {
			if ( str_contains( $normalised, $path ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Names the plugin a path belongs to.
	 *
	 * @since  1.0.0
	 * @param  string $file Absolute filesystem path.
	 * @return string 'free' or 'pro'.
	 */
	private static function source_for( string $file ): string {
		if ( ! defined( 'FOTOGRIDS_PRO_PLUGIN_DIR' ) ) {
			return 'free';
		}

		$pro = untrailingslashit( wp_normalize_path( FOTOGRIDS_PRO_PLUGIN_DIR ) );

		return str_contains( wp_normalize_path( $file ), $pro ) ? 'pro' : 'free';
	}

	/**
	 * Path prefixes treated as FotoGrids code.
	 *
	 * Pro adds its own directory on the filter rather than Free knowing about it.
	 * Deliberately uncached: the first error may be raised before Pro has
	 * defined its constant or before any filter has been added.
	 *
	 * @since  1.0.0
	 * @return array<int, string>
	 */
	private static function related_paths(): array {
		$paths = array();

		if ( defined( 'FOTOGRIDS_PLUGIN_DIR' ) ) {
			$paths[] = FOTOGRIDS_PLUGIN_DIR;
		}

		if ( defined( 'FOTOGRIDS_PRO_PLUGIN_DIR' ) ) {
			$paths[] = FOTOGRIDS_PRO_PLUGIN_DIR;
		}

		if ( function_exists( 'apply_filters' ) ) {
			/**
			 * Filters the paths whose errors are recorded as FotoGrids errors.
			 *
			 * @since 1.0.0
			 *
			 * @param string[] $paths Absolute directory paths.
			 */
			$paths = (array) apply_filters( 'fotogrids/diagnostics/related_paths', $paths );
		}

		$clean = array();

		foreach ( $paths as $path ) {
			$path = untrailingslashit( wp_normalize_path( (string) $path ) );

			if ( '' !== $path ) {
				$clean[] = $path;
			}
		}

		return $clean;
	}
}
