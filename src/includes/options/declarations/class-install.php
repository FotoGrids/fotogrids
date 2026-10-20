<?php
/**
 * Options recording the plugin's installation.
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
 * Install
 *
 * Written on activation and upgrade, and kept by a reset.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Install extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_activated_time'       => self::KEEP,
			'fotogrids_caps_version'         => self::KEEP,
			'fotogrids_completed_migrations' => self::KEEP,
			'fotogrids_db_version'           => self::KEEP,
			'fotogrids_deactivated_time'     => self::KEEP,
			'fotogrids_migration_lock'       => self::KEEP,
			'fotogrids_site_id'              => self::KEEP,
			'fotogrids_version'              => self::KEEP,
		);
	}
}
