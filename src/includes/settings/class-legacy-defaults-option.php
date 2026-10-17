<?php
/**
 * The deprecated `fotogrids_gallery_defaults` option name.
 *
 * @package FotoGrids\Settings
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Migrations\Collection_Defaults_Split;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Legacy_Defaults_Option
 *
 * Keeps code that reads or writes `fotogrids_gallery_defaults` working, with a
 * deprecation notice: reading it returns the gallery defaults, and writing it
 * replaces them. The option row itself is never written.
 *
 * @package FotoGrids\Settings
 * @since   1.3.0
 */
final class Legacy_Defaults_Option {

	/**
	 * Hook the option name.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function register(): void {
		add_filter( 'pre_option_' . Collection_Defaults_Split::LEGACY_OPTION, array( __CLASS__, 'read' ) );
		add_filter( 'pre_update_option_' . Collection_Defaults_Split::LEGACY_OPTION, array( __CLASS__, 'write' ), 10, 2 );
	}

	/**
	 * Answer a read of the deprecated option with the gallery defaults.
	 *
	 * @since  1.3.0
	 * @param  mixed $pre Value short-circuiting the read, or false.
	 * @return mixed The gallery defaults, or false when no defaults are stored.
	 */
	public static function read( $pre ) {
		if ( false !== $pre ) {
			return $pre;
		}

		$gallery = Collection_Defaults_Store::get( 'gallery' );

		if ( null === get_option( Collection_Defaults_Store::OPTION, null ) ) {
			return false;
		}

		self::deprecated( 'get_option' );

		return $gallery;
	}

	/**
	 * Store a write to the deprecated option as the gallery defaults.
	 *
	 * @since  1.3.0
	 * @param  mixed $value     Value being written.
	 * @param  mixed $old_value Value read before the write.
	 * @return mixed The old value, so the deprecated row is not written.
	 */
	public static function write( $value, $old_value ) {
		self::deprecated( 'update_option' );

		Collection_Defaults_Store::replace(
			'gallery',
			Plugin_Settings_Store::sanitize_collection_defaults( $value, 'gallery' )
		);

		return $old_value;
	}

	/**
	 * Raise the deprecation notice.
	 *
	 * @since  1.3.0
	 * @param  string $function_name Option function that was called.
	 * @return void
	 */
	private static function deprecated( string $function_name ): void {
		_deprecated_argument(
			esc_html( $function_name ),
			'1.3.0',
			sprintf(
				/* translators: 1: Deprecated option name. 2: Replacement option name. */
				esc_html__( 'The %1$s option is deprecated. Use the gallery entry of %2$s instead.', 'fotogrids' ),
				esc_html( Collection_Defaults_Split::LEGACY_OPTION ),
				esc_html( Collection_Defaults_Store::OPTION )
			)
		);
	}
}
