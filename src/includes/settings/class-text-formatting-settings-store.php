<?php
/**
 * Site-wide caption and description formatting settings store.
 *
 * @package FotoGrids\Settings
 * @since   1.3.0
 */

namespace FotoGrids\Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Reads and writes the Gallery Items formatting settings.
 *
 * @since 1.3.0
 */
final class Text_Formatting_Settings_Store {

	const OPTION = 'fotogrids_text_formatting';

	const MODES = array( 'basic', 'plain' );

	/**
	 * Per-request cache of the stored settings.
	 *
	 * @var array<string, mixed>|null
	 */
	private static ?array $cache = null;

	/**
	 * Default values.
	 *
	 * @since 1.3.0
	 * @return array{mode: string, links_new_tab: bool, links_nofollow: bool}
	 */
	public static function defaults(): array {
		return array(
			'mode'           => 'basic',
			'links_new_tab'  => true,
			'links_nofollow' => false,
		);
	}

	/**
	 * Stored settings merged over the defaults.
	 *
	 * @since 1.3.0
	 * @return array{mode: string, links_new_tab: bool, links_nofollow: bool}
	 */
	public static function get(): array {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION, array() );
			self::$cache = self::sanitize( is_array( $stored ) ? $stored : array() );
		}
		return self::$cache;
	}

	/**
	 * Sanitises a raw settings map, falling back to defaults per key.
	 *
	 * @since 1.3.0
	 * @param mixed $value Raw input.
	 * @return array{mode: string, links_new_tab: bool, links_nofollow: bool}
	 */
	public static function sanitize( $value ): array {
		$defaults = self::defaults();
		$input    = is_array( $value ) ? $value : array();

		$mode = is_string( $input['mode'] ?? null ) ? sanitize_key( $input['mode'] ) : $defaults['mode'];
		if ( ! in_array( $mode, self::MODES, true ) ) {
			$mode = $defaults['mode'];
		}

		return array(
			'mode'           => $mode,
			'links_new_tab'  => self::truthy( $input['links_new_tab'] ?? $defaults['links_new_tab'] ),
			'links_nofollow' => self::truthy( $input['links_nofollow'] ?? $defaults['links_nofollow'] ),
		);
	}

	/**
	 * Sanitises and stores the settings, flushing the render cache on change.
	 *
	 * @since 1.3.0
	 * @param mixed $value Raw input.
	 * @return array{mode: string, links_new_tab: bool, links_nofollow: bool}
	 */
	public static function save( $value ): array {
		$clean       = self::sanitize( $value );
		self::$cache = null;
		if ( update_option( self::OPTION, $clean ) ) {
			\FotoGrids\FotoGrids_Cache::flush_all();
		}
		return self::get();
	}

	/**
	 * Clears the per-request cache.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function reset_cache(): void {
		self::$cache = null;
	}

	/**
	 * Interprets booleans, numeric strings and 'true'/'false' strings.
	 *
	 * @since 1.3.0
	 * @param mixed $value Raw value.
	 * @return bool
	 */
	private static function truthy( $value ): bool {
		if ( is_bool( $value ) ) {
			return $value;
		}
		if ( is_string( $value ) ) {
			return in_array( strtolower( $value ), array( '1', 'true', 'yes', 'on' ), true );
		}
		return (bool) $value;
	}
}
