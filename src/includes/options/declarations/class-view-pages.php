<?php
/**
 * Options behind Plugin Settings > View Pages.
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
 * View_Pages
 *
 * The view-page configuration and the rewrite signature derived from it,
 * which is rebuilt on the next load.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class View_Pages extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_view_rewrite_version' => self::RESET,
			'fotogrids_view_settings'        => self::RESET,
		);
	}
}
