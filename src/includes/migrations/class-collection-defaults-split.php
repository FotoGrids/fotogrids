<?php
/**
 * Move of the shared collection defaults into one map per collection type.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

use FotoGrids\Settings\Collection_Defaults_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Collection_Defaults_Split
 *
 * Versions before 1.3.0 kept Gallery Defaults and Album Defaults in one map,
 * the `fotogrids_gallery_defaults` option, so each subtab showed and applied
 * the other's values. That map is copied to every collection type that has
 * no defaults of its own yet, so each type keeps what it showed and applied
 * before, and the old option is then deleted. The old option is kept when
 * the copy could not be written, so the next run can retry it.
 *
 * Runs on upgrade, and from `Collection_Defaults_Store::all()` whenever the
 * new option does not exist yet.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */
final class Collection_Defaults_Split {

	const LEGACY_OPTION = 'fotogrids_gallery_defaults';

	/**
	 * Run the move.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function run(): void {
		$legacy = self::read_legacy();

		if ( null === $legacy ) {
			return;
		}

		$stored  = get_option( Collection_Defaults_Store::OPTION, null );
		$current = is_array( $stored ) ? $stored : array();
		$changed = ! is_array( $stored );

		foreach ( Collection_Defaults_Store::TYPES as $type ) {
			if ( isset( $current[ $type ] ) && is_array( $current[ $type ] ) ) {
				continue;
			}

			$current[ $type ] = $legacy;
			$changed          = true;
		}

		if ( $changed ) {
			update_option( Collection_Defaults_Store::OPTION, $current );

			if ( wp_json_encode( get_option( Collection_Defaults_Store::OPTION ) ) !== wp_json_encode( $current ) ) {
				return;
			}
		}

		delete_option( self::LEGACY_OPTION );
	}

	/**
	 * The stored legacy map, read past the filters that keep its name working.
	 *
	 * @since  1.3.0
	 * @return array<string, mixed>|null Null when the option does not exist.
	 */
	private static function read_legacy(): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Reads the stored row; get_option() is filtered to the replacement option.
		$raw = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1",
				self::LEGACY_OPTION
			)
		);

		if ( null === $raw ) {
			return null;
		}

		$value = maybe_unserialize( $raw );

		return is_array( $value ) ? $value : array();
	}
}
