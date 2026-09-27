<?php
/**
 * Per-item data stored in the fotogrids_item_meta table.
 *
 * @package FotoGrids\Galleries
 * @since   1.1.4
 */

declare(strict_types=1);

namespace FotoGrids\Galleries;

use FotoGrids\Hooks\Actions_Item;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Reads and writes the one `fotogrids_item_meta` row each item has.
 *
 * @since 1.1.4
 */
final class Item_Meta {

    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

	/**
	 * The `gallery_id` value every item row carries.
	 *
	 * @since 1.1.4
	 */
	public const GALLERY_ID = 0;

	/**
	 * Columns save() accepts.
	 *
	 * @since 1.1.4
	 */
	public const FIELDS = array(
		'item_type',
		'caption',
		'description',
		'credit',
		'location',
		'external_url',
		'link_target',
		'exif_data',
		'custom_data',
	);

	/**
	 * Full name of the item meta table.
	 *
	 * @since  1.1.4
	 * @return string
	 */
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'fotogrids_item_meta';
	}

	/**
	 * Fetch the row for one item.
	 *
	 * @since  1.1.4
	 * @param  int $attachment_id Attachment ID.
	 * @return array<string, mixed>|null Row as an associative array, or null when the item has none.
	 */
	public static function get( int $attachment_id ): ?array {
		global $wpdb;
		$table = self::table();

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE attachment_id = %d AND gallery_id = %d ORDER BY id ASC LIMIT 1",
				$attachment_id,
				self::GALLERY_ID
			),
			ARRAY_A
		);

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Fetch the rows for several items in one query.
	 *
	 * @since  1.1.4
	 * @param  array<int, int> $attachment_ids Attachment IDs.
	 * @return array<int, array<string, mixed>> Rows keyed by attachment ID; items without a row are absent.
	 */
	public static function get_many( array $attachment_ids ): array {
		$attachment_ids = array_values( array_unique( array_filter( array_map( 'intval', $attachment_ids ) ) ) );
		if ( empty( $attachment_ids ) ) {
			return array();
		}

		global $wpdb;
		$table        = self::table();
		$placeholders = implode( ',', array_fill( 0, count( $attachment_ids ), '%d' ) );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE gallery_id = %d AND attachment_id IN ({$placeholders}) ORDER BY id ASC",
				array_merge( array( self::GALLERY_ID ), $attachment_ids )
			),
			ARRAY_A
		);

		$by_id = array();
		foreach ( (array) $rows as $row ) {
			$aid = (int) $row['attachment_id'];
			if ( ! isset( $by_id[ $aid ] ) ) {
				$by_id[ $aid ] = $row;
			}
		}

		return $by_id;
	}

	/**
	 * Create or update an item's row with the given fields.
	 *
	 * @since  1.1.4
	 * @param  int                  $attachment_id Attachment ID.
	 * @param  array<string, mixed> $fields        Column => value.
	 * @return bool True when the row was written.
	 */
	public static function save( int $attachment_id, array $fields ): bool {
		if ( $attachment_id <= 0 ) {
			return false;
		}

		$data = array();
		foreach ( self::FIELDS as $field ) {
			if ( ! array_key_exists( $field, $fields ) ) {
				continue;
			}
			$value = $fields[ $field ];
			if ( is_array( $value ) ) {
				$value = wp_json_encode( $value );
			}
			$data[ $field ] = null === $value ? null : (string) $value;
		}

		if ( empty( $data ) ) {
			return false;
		}

		global $wpdb;
		$table              = self::table();
		$now                = current_time( 'mysql', true );
		$data['updated_at'] = $now;

		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE attachment_id = %d AND gallery_id = %d ORDER BY id ASC LIMIT 1",
				$attachment_id,
				self::GALLERY_ID
			)
		);

		if ( $existing_id > 0 ) {
			$result = $wpdb->update( $table, $data, array( 'id' => $existing_id ), null, array( '%d' ) );
		} else {
			$data['attachment_id'] = $attachment_id;
			$data['gallery_id']    = self::GALLERY_ID;
			$data['created_at']    = $now;
			$result                = $wpdb->insert( $table, $data );
		}

		if ( false === $result ) {
			return false;
		}

		do_action( Actions_Item::META_UPDATED, $attachment_id, $fields );

		return true;
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
