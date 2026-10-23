<?php
/**
 * Options recording what the admin has been shown.
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
 * Admin_Prompts
 *
 * Notice dismissals and review-prompt counts, which a reset keeps.
 *
 * @package FotoGrids\Options\Declarations
 * @since   1.3.0
 */
final class Admin_Prompts extends Abstract_Option_Declaration {

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string>
	 */
	public static function options(): array {
		return array(
			'fotogrids_notice_bar_dismissed' => self::KEEP,
			'fotogrids_review_stats'         => self::KEEP,
			'fotogrids_settings_mode_tip'    => self::KEEP,
		);
	}
}
