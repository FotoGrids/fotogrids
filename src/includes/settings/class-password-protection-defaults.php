<?php
/**
 * Password protection rules for seeding a new collection from the defaults.
 *
 * @package FotoGrids\Settings
 * @since   1.1.3
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Hooks\Filters_Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Password_Protection_Defaults
 *
 * Keeps a default password out of a new collection unless the defaults also
 * switch password protection on, matching the collection save path, which
 * clears the stored password whenever protection is turned off.
 *
 * @package FotoGrids\Settings
 * @since   1.1.3
 */
final class Password_Protection_Defaults {

	/**
	 * Register the seeding filter.
	 *
	 * @since  1.1.3
	 * @return void
	 */
	public static function init(): void {
		add_filter( Filters_Settings::DEFAULTS_SEED, array( __CLASS__, 'filter_seed' ) );
	}

	/**
	 * Drop the default password when the defaults leave protection off.
	 *
	 * @since  1.1.3
	 * @param  array<string, mixed> $values Setting key => saved default value.
	 * @return array<string, mixed>
	 */
	public static function filter_seed( $values ): array {
		$values = (array) $values;

		if ( ! rest_sanitize_boolean( $values['password_protect'] ?? false ) ) {
			unset( $values['password'] );
		}

		return $values;
	}
}
