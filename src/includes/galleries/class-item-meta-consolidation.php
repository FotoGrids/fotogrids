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
 * Earlier versions also wrote rows scoped to a single gallery
 * (`gallery_id` = the gallery's post ID), and the migration tool created
 * galleries whose items existed only as such rows. run() rebuilds those
 * galleries' item lists, merges every gallery-scoped row into the item's
 * single row, and deletes the gallery-scoped rows. It is idempotent.
 *
 * @since 1.1.4
 */
final class Item_Meta_Consolidation {

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * This class is part of the FotoGrids custom-table data layer. Every
	 * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
	 * -- a trusted identifier that WP placeholders cannot bind. All values
	 * are passed through $wpdb->prepare(). Custom tables have no core-API
	 * equivalent and no object-cache layer applies at this level.
	 * ---------------------------------------------------------------------
	 */
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
		self::restore_gallery_lists();
		self::merge_rows();
	}

	/**
	 * Rebuild the item list of galleries whose items exist only as table rows.
	 *
	 * Applies to galleries that have no `fotogrids_gallery_items` list and have
	 * never been saved from the gallery editor (no `_edit_last`), so a gallery
	 * a user emptied is left empty.
	 *
	 * @since  1.1.4
	 * @return void
	 */
	private static function restore_gallery_lists(): void {
		global $wpdb;
		$table = Item_Meta::table();

		$gallery_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT gallery_id FROM {$table} WHERE gallery_id > %d",
				Item_Meta::GALLERY_ID
			)
		);

		foreach ( (array) $gallery_ids as $gallery_id ) {
			$gallery_id = (int) $gallery_id;

			if ( 'fotogrids_gallery' !== get_post_type( $gallery_id ) ) {
				continue;
			}
			if ( metadata_exists( 'post', $gallery_id, 'fotogrids_gallery_items' ) ) {
				continue;
			}
			if ( metadata_exists( 'post', $gallery_id, '_edit_last' ) ) {
				continue;
			}

			$attachment_ids = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT attachment_id FROM {$table} WHERE gallery_id = %d ORDER BY position ASC, id ASC",
					$gallery_id
				)
			);

			$item_ids = array();
			foreach ( (array) $attachment_ids as $attachment_id ) {
				$attachment_id = (int) $attachment_id;
				if ( 'attachment' === get_post_type( $attachment_id ) && ! in_array( $attachment_id, $item_ids, true ) ) {
					$item_ids[] = $attachment_id;
				}
			}

			if ( ! empty( $item_ids ) ) {
				Gallery_Repository::set_item_ids( $gallery_id, $item_ids );
			}
		}
	}

	/**
	 * Merge every gallery-scoped row into its item's row and delete it.
	 *
	 * The item's existing row keeps its non-empty values; empty ones are filled
	 * from the most recently updated gallery-scoped row that has a value. An
	 * item with no row gets its most recent gallery-scoped row converted.
	 *
	 * @since  1.1.4
	 * @return void
	 */
	private static function merge_rows(): void {
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
