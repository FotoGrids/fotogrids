<?php
/**
 * Gallery / album lifecycle action hooks.
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
 * Gallery action hooks.
 */
final class Actions_Gallery {

    /**
     * Fires after a gallery's item order is changed.
     *
     * @since 1.0.0
     * @param int   $gallery_id Gallery ID.
     * @param int[] $item_order Ordered attachment IDs.
     */
    public const REORDERED = 'fotogrids/actions/gallery/reordered';

    /**
     * Fires after a gallery's settings are saved from the metabox.
     *
     * @since 1.0.0
     * @param int $post_id Gallery post ID.
     */
    public const SETTINGS_SAVED = 'fotogrids/actions/gallery/settings/saved';

    /**
     * Fires after a gallery (or album) post is deleted.
     *
     * @since 1.0.0
     * @param int $post_id Deleted post ID.
     */
    public const DELETED = 'fotogrids/actions/gallery/deleted';

    /**
     * Fires after a gallery is imported via the Import/Export tool.
     *
     * @since 1.0.0
     * @param int $new_id New (local) gallery ID.
     * @param int $old_id Original gallery ID from the import payload.
     */
    public const IMPORTED = 'fotogrids/actions/gallery/imported';

    /**
     * Fires after a share is tracked.
     *
     * @since 1.0.0
     * @param string $object_type One of 'gallery' | 'album' | 'item'.
     * @param int    $object_id   The object ID.
     * @param string $network     Share network identifier (e.g. 'facebook').
     */
    public const SHARE_TRACKED = 'fotogrids/actions/share/tracked';
}
