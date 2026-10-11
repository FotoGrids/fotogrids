<?php
/**
 * Options behind Plugin Settings > Watermark.
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
 * Watermark
 *
 * The watermark configuration and the hash derived from it, which is
 * recomputed on the next read.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Watermark extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_watermark_config_hash' => self::RESET,
			'fotogrids_watermark_settings'    => self::RESET,
		);
	}
}
