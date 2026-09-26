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
	 * @param int         $attachment_id Attachment ID added.
	 * @param int         $gallery_id    Gallery ID.
	 * @param string|null $source        Embed source identifier; passed only
	 *                                   by the embed REST endpoint.
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
	 * Item data is shared by every gallery the item belongs to, so the action
	 * carries no gallery ID.
	 *
	 * @since 1.0.0
	 * @param int   $attachment_id Attachment ID.
	 * @param array $fields        The fields written, column => value.
	 */
	public const META_UPDATED = 'fotogrids/actions/item/meta/updated';
}
