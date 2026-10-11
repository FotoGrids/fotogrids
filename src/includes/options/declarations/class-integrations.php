<?php
/**
 * Options for the page-builder integrations.
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
 * Integrations
 *
 * Registered for the integrations; no screen writes it yet.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Integrations extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_integration_settings' => self::RESET,
		);
	}
}
