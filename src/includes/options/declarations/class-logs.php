<?php
/**
 * Options holding the plugin's logs.
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
 * Logs
 *
 * Errors captured for System Info and the Import / Export and Migration
 * logs.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Logs extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_error_log'         => self::KEEP,
			'fotogrids_import_export_log' => self::KEEP,
			'fotogrids_migration_log'     => self::KEEP,
		);
	}
}
