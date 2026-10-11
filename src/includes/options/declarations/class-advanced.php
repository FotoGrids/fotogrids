<?php
/**
 * Options behind Plugin Settings > Advanced.
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
 * Advanced
 *
 * The toggles on the Advanced tab. A reset keeps the four privacy choices:
 * usage data, product emails, Google Fonts and FotoGrids news.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Advanced extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_allow_google_fonts'         => self::KEEP,
			'fotogrids_allow_news_updates'         => self::KEEP,
			'fotogrids_autosave'                   => self::RESET,
			'fotogrids_marketing_allowed'          => self::KEEP,
			'fotogrids_preserve_data_on_uninstall' => self::RESET,
			'fotogrids_share_statistics'           => self::KEEP,
		);
	}
}
