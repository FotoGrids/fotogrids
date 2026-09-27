<?php
/**
 * Item-level domain action hooks (per-attachment lifecycle inside a gallery).
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Item action hooks.
 */
final class Actions_Item {

	/**
	 * Fires after an attachment is added to a gallery.
	 *
	 * @since 1.0.0
	 * @param int          $attachment_id  Attachment ID added.
	 * @param int          $gallery_id     Gallery ID.
	 * @param array|string $meta_or_source Data passed to the deprecated `$meta`
	 *                                     argument of Gallery_Items::add(), or
	 *                                     the embed source identifier.
	 */
	public const ADDED = 'fotogrids/actions/item/added';

	/**
	 * Fires after an attachment is removed from a gallery.
	 *
	 * @since 1.0.0
	 * @param int $attachment_id Attachment ID removed.
	 * @param int $gallery_id    Gallery ID.
	 */
	public const REMOVED = 'fotogrids/actions/item/removed';

	/**
	 * Fires after an item's row in `fotogrids_item_meta` is written.
	 *
	 * @since 1.0.0
	 * @param int   $attachment_id Attachment ID.
	 * @param int   $gallery_id    Always 0; item data is shared by every gallery.
	 * @param array $fields        The fields written, column => value.
	 */
	public const META_UPDATED = 'fotogrids/actions/item/meta/updated';
}
