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
use FotoGrids\Post_Types;
use FotoGrids\Settings\Collection_Defaults_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Restores list-valued collection settings that were stored as one plain
 * string, and decodes list values held as JSON text in the saved defaults.
 *
 * A list setting is any setting whose default is a non-empty list. Its admin
 * control always saves a JSON array, so a stored value that is not one is
 * replaced with the default. Runs once on upgrade; after an import,
 * `repair_imported()` repairs what the import wrote.
 *
 * @since 1.2.0
 */
final class List_Setting_Repair implements Migration {

	/**
	 * Identifier recorded once the repair has run.
	 *
	 * @since  1.3.0
	 * @return string
	 */
	public static function id(): string {
		return '0003-list-setting-repair';
	}

	/**
	 * Run the repair.
	 *
	 * @since  1.2.0
	 * @return void
	 */
	public static function run(): void {
		self::repair( null );
	}

	/**
	 * Repair the collections an import wrote, and the saved defaults.
	 *
	 * @since  1.3.0
	 * @param  array<int, int> $post_ids Gallery and album IDs the import created or matched.
	 * @return void
	 */
	public static function repair_imported( array $post_ids ): void {
		self::repair( array_values( array_unique( array_filter( array_map( 'intval', $post_ids ) ) ) ) );
	}

	/**
	 * Repair collection post meta and the saved defaults.
	 *
	 * @since  1.3.0
	 * @param  array<int, int>|null $post_ids Collections to repair; null for all of them.
	 * @return void
	 */
	private static function repair( ?array $post_ids ): void {
		$defaults = self::list_defaults();

		if ( array() === $defaults ) {
			return;
		}

		$repaired  = array() === $post_ids ? 0 : self::repair_collections( $defaults, $post_ids );
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
	 * @param  array<int, int>|null             $post_ids Collections to repair; null for all of them.
	 * @return int Number of values replaced.
	 */
	private static function repair_collections( array $defaults, ?array $post_ids ): int {
		global $wpdb;

		$only = null === $post_ids ? '' : ' AND pm.post_id IN (' . implode( ',', array_fill( 0, count( $post_ids ), '%d' ) ) . ')';

		$repaired = 0;
		foreach ( $defaults as $key => $default ) {
			$meta_key = 'fotogrids_' . $key;

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Scan across collections; $only is a generated list of %d tokens, one per entry in $post_ids.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT pm.post_id, pm.meta_value
					FROM {$wpdb->postmeta} pm
					INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					WHERE p.post_type IN ( %s, %s )
					AND pm.meta_key = %s
					AND pm.meta_value <> ''{$only}",
					array_merge( array( Post_Types::GALLERY, Post_Types::ALBUM, $meta_key ), $post_ids ?? array() )
				)
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

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
	 * Store list values in each type's saved defaults as arrays.
	 *
	 * @since  1.2.0
	 * @param  array<string, array<int, mixed>> $defaults List defaults keyed by setting.
	 * @return int Number of values changed.
	 */
	private static function repair_saved_defaults( array $defaults ): int {
		$changed = 0;

		foreach ( Collection_Defaults_Store::all() as $type => $saved ) {
			$type_changed = 0;

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
				++$type_changed;
			}

			if ( $type_changed > 0 ) {
				Collection_Defaults_Store::replace( $type, $saved );
				$changed += $type_changed;
			}
		}

		return $changed;
	}
}
