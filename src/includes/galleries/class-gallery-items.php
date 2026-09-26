<?php
/**
 * Write-side operations for a gallery's items.
 *
 * @package FotoGrids\Galleries
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Galleries;

use FotoGrids\Hooks\Actions_Gallery;
use FotoGrids\Hooks\Actions_Item;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Mutating operations on a gallery's item set.
 *
 * A gallery's items and their order are the `fotogrids_gallery_items` post
 * meta list. Per-item data is shared across galleries and lives in Item_Meta,
 * so adding, removing or reordering items never touches it.
 *
 * Each method fires its corresponding `Actions_Item::*` / `Actions_Gallery::*`
 * action on success so listeners (statistics, cache invalidation, search
 * indexers, etc.) don't have to wrap individual call sites.
 *
 * @since 1.0.0
 */
final class Gallery_Items {

	/**
	 * Add an attachment to the end of a gallery.
	 *
	 * Fires `Actions_Item::ADDED` on success.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id    Gallery post ID.
	 * @param int $attachment_id Attachment ID.
	 * @return bool True on success; false when the gallery or attachment does
	 *              not exist or the attachment is already in the gallery.
	 */
	public static function add( int $gallery_id, int $attachment_id ): bool {
		if ( ! Gallery_Repository::get( $gallery_id ) ) {
			return false;
		}
		if ( ! get_post( $attachment_id ) ) {
			return false;
		}

		$item_ids = Gallery_Repository::get_item_ids( $gallery_id );
		if ( in_array( $attachment_id, $item_ids, true ) ) {
			return false;
		}

		$item_ids[] = $attachment_id;
		Gallery_Repository::set_item_ids( $gallery_id, $item_ids );

		do_action( Actions_Item::ADDED, $attachment_id, $gallery_id );

		return true;
	}

	/**
	 * Remove an attachment from a gallery.
	 *
	 * Fires `Actions_Item::REMOVED` on success.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id    Gallery post ID.
	 * @param int $attachment_id Attachment ID.
	 * @return bool True on success; false when the attachment is not in the gallery.
	 */
	public static function remove( int $gallery_id, int $attachment_id ): bool {
		$item_ids = Gallery_Repository::get_item_ids( $gallery_id );

		$key = array_search( $attachment_id, $item_ids, true );
		if ( false === $key ) {
			return false;
		}

		unset( $item_ids[ $key ] );
		Gallery_Repository::set_item_ids( $gallery_id, array_values( $item_ids ) );

		do_action( Actions_Item::REMOVED, $attachment_id, $gallery_id );

		return true;
	}

	/**
	 * Reorder a gallery's items.
	 *
	 * Items named in `$item_order` move to the front in that order; items in
	 * the gallery but missing from `$item_order` keep their relative order
	 * after them. IDs not in the gallery are ignored. Fires
	 * `Actions_Gallery::REORDERED`.
	 *
	 * @since 1.0.0
	 * @param int               $gallery_id Gallery post ID.
	 * @param array<int|string> $item_order Item IDs in the new display order.
	 * @return bool Always true.
	 */
	public static function reorder( int $gallery_id, array $item_order ): bool {
		$current = Gallery_Repository::get_item_ids( $gallery_id );

		$ordered = array();
		foreach ( $item_order as $item_id ) {
			$item_id = (int) $item_id;
			if ( in_array( $item_id, $current, true ) && ! in_array( $item_id, $ordered, true ) ) {
				$ordered[] = $item_id;
			}
		}
		foreach ( $current as $item_id ) {
			if ( ! in_array( $item_id, $ordered, true ) ) {
				$ordered[] = $item_id;
			}
		}

		Gallery_Repository::set_item_ids( $gallery_id, $ordered );

		do_action( Actions_Gallery::REORDERED, $gallery_id, $ordered );

		return true;
	}
}
