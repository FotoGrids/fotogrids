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
	 * @param int                  $gallery_id    Gallery post ID.
	 * @param int                  $attachment_id Attachment ID.
	 * @param array<string, mixed> $meta          Deprecated since 1.1.4. Use Item_Meta::save().
	 * @return bool True on success; false when the gallery or attachment does
	 *              not exist or the attachment is already in the gallery.
	 */
	public static function add( int $gallery_id, int $attachment_id, array $meta = array() ): bool {
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

		if ( ! empty( $meta ) ) {
			_deprecated_argument(
				__METHOD__,
				'1.1.4',
				/* translators: %s: Method name. */
				sprintf( esc_html__( 'Use %s instead.', 'fotogrids' ), 'FotoGrids\\Galleries\\Item_Meta::save()' )
			);
			Item_Meta::save( $attachment_id, $meta );
		}

		do_action( Actions_Item::ADDED, $attachment_id, $gallery_id, $meta );

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
	 * Update an item's data.
	 *
	 * @since      1.0.0
	 * @deprecated 1.1.4 Use Item_Meta::save(). Item data is shared by every gallery.
	 * @param int                  $gallery_id    Unused.
	 * @param int                  $attachment_id Attachment ID.
	 * @param array<string, mixed> $meta          Fields to write.
	 * @return bool True on success.
	 */
	public static function update_meta( int $gallery_id, int $attachment_id, array $meta ): bool { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- Kept for the deprecated signature.
		_deprecated_function( __METHOD__, '1.1.4', 'FotoGrids\\Galleries\\Item_Meta::save()' );

		return Item_Meta::save( $attachment_id, $meta );
	}

	/**
	 * Reorder a gallery's items.
	 *
	 * Items missing from `$item_order` keep their relative order after it.
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
