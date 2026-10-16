<?php
/**
 * Options earlier versions named that nothing reads or writes now.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Options\Declarations;

use FotoGrids\Options\Abstract_Option_Declaration;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Retired
 *
 * A reset still keeps the licence options, and clears the settings options
 * that earlier versions registered without writing and the defaults option
 * earlier versions shared between galleries and albums.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Retired extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_gallery_defaults'            => self::RESET,
			'fotogrids_integration_settings'        => self::RESET,
			'fotogrids_license_data'                => self::KEEP,
			'fotogrids_license_key'                 => self::KEEP,
			'fotogrids_license_last_check_time'     => self::KEEP,
			'fotogrids_license_last_valid_response' => self::KEEP,
			'fotogrids_license_secret'              => self::KEEP,
			'fotogrids_permission_settings'         => self::RESET,
		);
	}
}
