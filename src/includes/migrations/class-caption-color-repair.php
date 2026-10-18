<?php
/**
 * Repair of caption colours stored with the white defaults of 1.2.0 and earlier.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

use FotoGrids\Post_Types;
use FotoGrids\Settings\Collection_Defaults_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Clears caption title and description colours that still hold the white
 * defaults shipped up to 1.2.0.
 *
 * Those defaults were saved into every collection the editor saved, so they
 * cannot be told apart from a chosen white. Cleared, a colour follows the
 * caption placement: white over the image, the theme's text colour above or
 * below it. Runs on upgrade and after an import.
 *
 * @since 1.3.0
 */
final class Caption_Color_Repair {

	/**
	 * Setting keys and the default each one held up to 1.2.0.
	 *
	 * @since 1.3.0
	 * @var array<string, string>
	 */
	const OLD_DEFAULTS = array(
		'caption_title_color'       => 'rgba(255,255,255,1)',
		'caption_description_color' => 'rgba(255,255,255,0.7)',
	);

	/**
	 * Run the repair.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function run(): void {
		$cleared  = self::repair_collections();
		$cleared += self::repair_saved_defaults();

		if ( $cleared > 0 ) {
			\FotoGrids\FotoGrids_Cache::flush_all();
		}
	}

	/**
	 * Whether a stored value is the old default for its setting.
	 *
	 * @since  1.3.0
	 * @param  string $key   Setting key.
	 * @param  mixed  $value Stored value.
	 * @return bool
	 */
	public static function is_old_default( string $key, $value ): bool {
		if ( ! isset( self::OLD_DEFAULTS[ $key ] ) || ! is_string( $value ) ) {
			return false;
		}

		return strtolower( (string) preg_replace( '/\s+/', '', $value ) ) === self::OLD_DEFAULTS[ $key ];
	}

	/**
	 * Clear old defaults in gallery and album post meta.
	 *
	 * @since  1.3.0
	 * @return int Number of values cleared.
	 */
	private static function repair_collections(): int {
		global $wpdb;

		$cleared = 0;
		foreach ( array_keys( self::OLD_DEFAULTS ) as $key ) {
			$meta_key = 'fotogrids_' . $key;

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time scan across all collections.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT pm.post_id, pm.meta_value
					FROM {$wpdb->postmeta} pm
					INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					WHERE p.post_type IN ( %s, %s )
					AND pm.meta_key = %s
					AND pm.meta_value <> ''",
					Post_Types::GALLERY,
					Post_Types::ALBUM,
					$meta_key
				)
			);

			foreach ( (array) $rows as $row ) {
				if ( ! self::is_old_default( $key, $row->meta_value ) ) {
					continue;
				}

				if ( update_post_meta( (int) $row->post_id, $meta_key, '', $row->meta_value ) ) {
					++$cleared;
				}
			}
		}

		return $cleared;
	}

	/**
	 * Remove old defaults from each type's saved defaults.
	 *
	 * @since  1.3.0
	 * @return int Number of values removed.
	 */
	private static function repair_saved_defaults(): int {
		$cleared = 0;

		foreach ( Collection_Defaults_Store::all() as $type => $saved ) {
			$type_cleared = 0;

			foreach ( array_keys( self::OLD_DEFAULTS ) as $key ) {
				if ( array_key_exists( $key, $saved ) && self::is_old_default( $key, $saved[ $key ] ) ) {
					unset( $saved[ $key ] );
					++$type_cleared;
				}
			}

			if ( $type_cleared > 0 ) {
				Collection_Defaults_Store::replace( $type, $saved );
				$cleared += $type_cleared;
			}
		}

		return $cleared;
	}
}
