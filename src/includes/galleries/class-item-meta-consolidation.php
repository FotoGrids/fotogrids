<?php
/**
 * One-time consolidation of fotogrids_item_meta into one row per item.
 *
 * @package FotoGrids\Galleries
 * @since   1.1.4
 */

declare(strict_types=1);

namespace FotoGrids\Galleries;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Brings existing data in line with the Item_Meta convention.
 *
 * @since 1.1.4
 */
final class Item_Meta_Consolidation {

    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

	/**
	 * Columns merged from gallery-scoped rows into the item's row.
	 *
	 * @since 1.1.4
	 */
	private const MERGED_FIELDS = array(
		'credit',
		'external_url',
		'link_target',
		'exif_data',
		'custom_data',
	);

	/**
	 * Number of items merged per query batch.
	 *
	 * @since 1.1.4
	 */
	private const BATCH_SIZE = 500;

	/**
	 * Run the consolidation.
	 *
	 * @since  1.1.4
	 * @return void
	 */
	public static function run(): void {
		$restored = self::restore_gallery_lists();
		$merged   = self::merge_rows();

		if ( $restored + $merged > 0 ) {
			\FotoGrids\FotoGrids_Cache::flush_all();
		}
	}

	/**
	 * Rebuild the item list of galleries whose items exist only as table rows.
	 *
	 * @since  1.1.4
	 * @return int Number of galleries whose list was rebuilt.
	 */
	private static function restore_gallery_lists(): int {
		global $wpdb;
		$table = Item_Meta::table();

		$gallery_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT gallery_id FROM {$table} WHERE gallery_id > %d",
				Item_Meta::GALLERY_ID
			)
		);

		$restored = 0;
		foreach ( (array) $gallery_ids as $gallery_id ) {
			$attachment_ids = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT attachment_id FROM {$table} WHERE gallery_id = %d ORDER BY position ASC, id ASC",
					(int) $gallery_id
				)
			);

			if ( self::restore_list( (int) $gallery_id, (array) $attachment_ids ) ) {
				++$restored;
			}
		}

		return $restored;
	}

	/**
	 * Give a gallery an item list built from gallery-scoped rows.
	 *
	 * Skips galleries that already have a list or were saved in the editor.
	 *
	 * @since  1.1.4
	 * @param  int             $gallery_id     Gallery post ID.
	 * @param  array<int, int> $attachment_ids Attachment IDs in display order.
	 * @return bool True when the list was written.
	 */
	public static function restore_list( int $gallery_id, array $attachment_ids ): bool {
		if ( 'fotogrids_gallery' !== get_post_type( $gallery_id ) ) {
			return false;
		}
		if ( metadata_exists( 'post', $gallery_id, 'fotogrids_gallery_items' ) ) {
			return false;
		}
		if ( metadata_exists( 'post', $gallery_id, '_edit_last' ) ) {
			return false;
		}

		$item_ids = array();
		foreach ( $attachment_ids as $attachment_id ) {
			$attachment_id = (int) $attachment_id;
			if ( 'attachment' === get_post_type( $attachment_id ) && ! in_array( $attachment_id, $item_ids, true ) ) {
				$item_ids[] = $attachment_id;
			}
		}

		if ( empty( $item_ids ) ) {
			return false;
		}

		Gallery_Repository::set_item_ids( $gallery_id, $item_ids );

		return true;
	}

	/**
	 * Merge every gallery-scoped row into its item's row and delete it.
	 *
	 * @since  1.1.4
	 * @return int Number of items whose rows were merged.
	 */
	private static function merge_rows(): int {
		global $wpdb;
		$table = Item_Meta::table();

		$seen = array();

		do {
			$attachment_ids = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT DISTINCT attachment_id FROM {$table} WHERE gallery_id IS NULL OR gallery_id <> %d LIMIT %d",
					Item_Meta::GALLERY_ID,
					self::BATCH_SIZE
				)
			);

			$progressed = false;
			foreach ( (array) $attachment_ids as $attachment_id ) {
				$attachment_id = (int) $attachment_id;
				if ( isset( $seen[ $attachment_id ] ) ) {
					continue;
				}
				$seen[ $attachment_id ] = true;
				$progressed             = true;
				self::merge_item( $attachment_id );
			}
		} while ( $progressed );

		return count( $seen );
	}

	/**
	 * Collapse all of one item's rows into a single row.
	 *
	 * @since  1.1.4
	 * @param  int $attachment_id Attachment ID.
	 * @return void
	 */
	private static function merge_item( int $attachment_id ): void {
		global $wpdb;
		$table = Item_Meta::table();

		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE attachment_id = %d", $attachment_id ),
			ARRAY_A
		);
		if ( empty( $rows ) ) {
			return;
		}

		$item_row   = null;
		$other_rows = array();
		foreach ( $rows as $row ) {
			$is_item_row = null !== $row['gallery_id'] && Item_Meta::GALLERY_ID === (int) $row['gallery_id'];
			if ( $is_item_row && ( null === $item_row || (int) $row['id'] < (int) $item_row['id'] ) ) {
				if ( null !== $item_row ) {
					$other_rows[] = $item_row;
				}
				$item_row = $row;
			} else {
				$other_rows[] = $row;
			}
		}

		usort(
			$other_rows,
			static function ( array $a, array $b ): int {
				$by_date = strcmp( (string) $b['updated_at'], (string) $a['updated_at'] );
				return 0 !== $by_date ? $by_date : (int) $b['id'] - (int) $a['id'];
			}
		);

		$keep = $item_row ?? array_shift( $other_rows );

		$data = array();
		foreach ( self::MERGED_FIELDS as $field ) {
			if ( self::has_value( $field, $keep[ $field ] ?? null ) ) {
				continue;
			}
			foreach ( $other_rows as $row ) {
				if ( self::has_value( $field, $row[ $field ] ?? null ) ) {
					$data[ $field ] = $row[ $field ];
					break;
				}
			}
		}
		if ( null === $item_row ) {
			$data['gallery_id'] = Item_Meta::GALLERY_ID;
		}

		if ( ! empty( $data ) ) {
			$wpdb->update( $table, $data, array( 'id' => (int) $keep['id'] ), null, array( '%d' ) );
		}

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table} WHERE attachment_id = %d AND id <> %d",
				$attachment_id,
				(int) $keep['id']
			)
		);
	}

	/**
	 * Whether a column value counts as set.
	 *
	 * @since  1.1.4
	 * @param  string $field Column name.
	 * @param  mixed  $value Column value.
	 * @return bool
	 */
	private static function has_value( string $field, $value ): bool {
		if ( null === $value || '' === $value ) {
			return false;
		}

		return 'link_target' !== $field || 'global' !== $value;
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
