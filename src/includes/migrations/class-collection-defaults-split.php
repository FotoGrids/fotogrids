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
 * Copies the map in `fotogrids_gallery_defaults` to every collection type
 * with no defaults of its own, then deletes that option. The option is kept
 * when the copy cannot be written, and the move stays pending.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */
final class Collection_Defaults_Split implements Migration {

	const LEGACY_OPTION = 'fotogrids_gallery_defaults';

	/**
	 * Identifier recorded once the move has run.
	 *
	 * @since  1.3.0
	 * @return string
	 */
	public static function id(): string {
		return '0002-collection-defaults-split';
	}

	/**
	 * Run the move.
	 *
	 * @since  1.3.0
	 * @return void
	 * @throws \RuntimeException When the copy could not be written.
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
				throw new \RuntimeException( 'The collection defaults could not be written.' );
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
