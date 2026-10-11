<?php
/**
 * Options behind Plugin Settings > Defaults.
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
 * Collection_Defaults
 *
 * The saved defaults new galleries and albums are seeded from.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Collection_Defaults extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_album_defaults'   => self::RESET,
			'fotogrids_gallery_defaults' => self::RESET,
		);
	}
}
