<?php
/**
 * Album lifecycle action hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Album action hooks.
 */
final class Actions_Album {

	/**
	 * Fires after a gallery is added to an album.
	 *
	 * @since 1.3.0
	 * @param int $gallery_id Gallery ID.
	 * @param int $album_id   Album ID.
	 */
	public const GALLERY_ADDED = 'fotogrids/actions/album/gallery/added';

	/**
	 * Fires after a gallery is removed from an album.
	 *
	 * @since 1.3.0
	 * @param int $gallery_id Gallery ID.
	 * @param int $album_id   Album ID.
	 */
	public const GALLERY_REMOVED = 'fotogrids/actions/album/gallery/removed';

	/**
	 * Fires after an album's galleries are reordered.
	 *
	 * @since 1.3.0
	 * @param int   $album_id    Album ID.
	 * @param int[] $gallery_ids Gallery IDs in their new order.
	 */
	public const REORDERED = 'fotogrids/actions/album/reordered';

	/**
	 * Fires after an album's settings are saved from the album editor.
	 *
	 * @since 1.3.0
	 * @param int $album_id Album ID.
	 */
	public const SETTINGS_SAVED = 'fotogrids/actions/album/settings/saved';
}
