<?php
/**
 * Options the setup wizard records.
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
 * Setup_Wizard
 *
 * The wizard's answers, which a reset keeps.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Setup_Wizard extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_settings_mode' => self::KEEP,
			'fotogrids_user_persona'  => self::KEEP,
		);
	}
}
