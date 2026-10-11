<?php
/**
 * Options behind Plugin Settings > Maintenance > Debug Log.
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
 * Debug_Log
 *
 * The debug channels switched on.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Debug_Log extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_debug_channels' => self::RESET,
		);
	}
}
