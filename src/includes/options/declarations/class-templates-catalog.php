<?php
/**
 * Options the template library keeps.
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
 * Templates_Catalog
 *
 * Bookkeeping for the remote catalog cache.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Templates_Catalog extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_remote_catalog_meta' => self::KEEP,
		);
	}
}
