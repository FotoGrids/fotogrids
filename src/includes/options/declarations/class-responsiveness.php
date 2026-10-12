<?php
/**
 * Options behind Plugin Settings > Responsiveness.
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
 * Responsiveness
 *
 * The breakpoints and device detection.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Responsiveness extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_general_settings' => self::RESET,
		);
	}
}
