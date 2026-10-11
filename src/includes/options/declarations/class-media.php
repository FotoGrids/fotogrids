<?php
/**
 * Options behind Plugin Settings > Media.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Options\Declarations;

use FotoGrids\Image_Size_Manager;
use FotoGrids\Options\Abstract_Option_Declaration;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Media
 *
 * The plugin's image sizes. A reset keeps the custom sizes registered for
 * individual galleries and albums.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Media extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_custom_sizes'   => self::KEEP,
			'fotogrids_media_settings' => self::RESET,
		);
	}

	/**
	 * Reseed the image sizes activation writes.
	 *
	 * @since  1.3.0
	 * @param  array<int, string> $cleared Options the reset deleted.
	 * @return void
	 */
	public static function after_reset( array $cleared ): void {
		if ( ! in_array( 'fotogrids_media_settings', $cleared, true ) ) {
			return;
		}

		update_option( 'fotogrids_media_settings', Image_Size_Manager::get_plugin_size_defaults(), false );
	}
}
