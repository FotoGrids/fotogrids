<?php
/**
 * Options behind Plugin Settings > Permissions Manager.
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
 * Permissions
 *
 * A reset keeps the visibility mode and the role capabilities the tab edits.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Permissions extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_unauthorised_settings_visibility' => self::KEEP,
		);
	}
}
