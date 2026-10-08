<?php
/**
 * Repair of list settings stored as a single value.
 *
 * @package FotoGrids\Migrations
 * @since   1.2.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

use FotoGrids\Collection_Defaults;
use FotoGrids\Settings\Collection_Defaults_Seeder;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Restores list-valued collection settings that were stored as one plain
 * string, and decodes list values held as JSON text in the saved defaults.
 *
 * A list setting is any setting whose default is a non-empty list. Its admin
 * control always saves a JSON array, so a stored value that is not one is
 * replaced with the default. Runs on upgrade and after an import, which can
 * carry values exported by an earlier version.
 *
 * @since 1.2.0
 */
final class List_Setting_Repair {

	/**
	 * Run the repair.
	 *
	 * @since  1.2.0
	 * @return void
	 */
	public static function run(): void {
		$defaults = self::list_defaults();

		if ( array() === $defaults ) {
			return;
		}

		$repaired  = self::repair_collections( $defaults );
		$repaired += self::repair_saved_defaults( $defaults );

		if ( $repaired > 0 ) {
			\FotoGrids\FotoGrids_Cache::flush_all();
		}
	}

	/**
	 * Collection defaults whose value is a non-empty list.
	 *
	 * @since  1.2.0
	 * @return array<string, array<int, mixed>>
	 */
	private static function list_defaults(): array {
		$defaults = array_merge(
			Collection_Defaults::get_base_defaults(),
			Collection_Defaults::get_gallery_defaults(),
			Collection_Defaults::get_album_defaults()
		);

		return array_filter(
			$defaults,
			static function ( $value ): bool {
				return is_array( $value ) && array() !== $value && wp_is_numeric_array( $value );
			}
		);
	}

	/**
	 * Whether a stored value holds a list.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Stored value.
	 * @return bool
	 */
	private static function is_list_value( $value ): bool {
		if ( is_array( $value ) ) {
			return true;
		}

		return is_string( $value ) && is_array( json_decode( $value, true ) );
	}

	/**
	 * Replace non-list values in gallery and album post meta.
	 *
	 * @since  1.2.0
	 * @param  array<string, array<int, mixed>> $defaults List defaults keyed by setting.
	 * @return int Number of values replaced.
	 */
	private static function repair_collections( array $defaults ): int {
		global $wpdb;

		$repaired = 0;
		foreach ( $defaults as $key => $default ) {
			$meta_key = 'fotogrids_' . $key;

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time scan across all collections.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT pm.post_id, pm.meta_value
					FROM {$wpdb->postmeta} pm
					INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					WHERE p.post_type IN ( 'fotogrids_gallery', 'fotogrids_album' )
					AND pm.meta_key = %s
					AND pm.meta_value <> ''",
					$meta_key
				)
			);

			foreach ( (array) $rows as $row ) {
				if ( self::is_list_value( $row->meta_value ) ) {
					continue;
				}

				if ( update_post_meta( (int) $row->post_id, $meta_key, wp_json_encode( $default ), $row->meta_value ) ) {
					++$repaired;
				}
			}
		}

		return $repaired;
	}

	/**
	 * Store list values in the saved defaults option as arrays.
	 *
	 * @since  1.2.0
	 * @param  array<string, array<int, mixed>> $defaults List defaults keyed by setting.
	 * @return int Number of values changed.
	 */
	private static function repair_saved_defaults( array $defaults ): int {
		$saved = get_option( Collection_Defaults_Seeder::OPTION, array() );

		if ( ! is_array( $saved ) ) {
			return 0;
		}

		$changed = 0;
		foreach ( array_intersect_key( $saved, $defaults ) as $key => $value ) {
			if ( is_array( $value ) ) {
				continue;
			}

			$decoded = is_string( $value ) ? json_decode( $value, true ) : null;
			if ( is_array( $decoded ) ) {
				$saved[ $key ] = $decoded;
			} else {
				unset( $saved[ $key ] );
			}
			++$changed;
		}

		if ( $changed > 0 ) {
			update_option( Collection_Defaults_Seeder::OPTION, $saved );
		}

		return $changed;
	}
}
