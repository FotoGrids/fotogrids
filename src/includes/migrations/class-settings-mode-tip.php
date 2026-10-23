<?php
/**
 * Flag for the settings mode tip shown after an upgrade.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

use FotoGrids\Settings\Settings_Mode;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Settings_Mode_Tip
 *
 * Sets `Settings_Mode::TIP_OPTION` on a site that was already installed.
 * A fresh install runs its migrations during activation, before
 * `fotogrids_version` is first stored, and is left alone.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */
final class Settings_Mode_Tip implements Migration {

	/**
	 * Identifier recorded once the migration has run.
	 *
	 * @since  1.3.0
	 * @return string
	 */
	public static function id(): string {
		return '0005-settings-mode-tip';
	}

	/**
	 * Apply the migration.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function run(): void {
		if ( ! self::applies_to( get_option( 'fotogrids_version', '' ) ) ) {
			return;
		}

		update_option( Settings_Mode::TIP_OPTION, '1' );
	}

	/**
	 * Whether the site had the plugin installed before this migration ran.
	 *
	 * @since  1.3.0
	 * @param  mixed $stored_version Stored `fotogrids_version` value.
	 * @return bool
	 */
	public static function applies_to( $stored_version ): bool {
		return is_string( $stored_version ) && '' !== $stored_version;
	}
}
