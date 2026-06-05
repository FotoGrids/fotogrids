<?php
/**
 * Frontend gallery JS CustomEvent name constants
 * (sharing, password gate, album AJAX).
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
 * Gallery-level JS events.
 */
final class JsEvents_Gallery {

    /**
     * Fired on `document` when an item is shared.
     *
     * @since 1.0.0
     * @event-detail { galleryEl, itemId, network }
     */
    public const SHARE = 'fotogrids:share';

    /**
     * Fired on `document` when a password gate unlocks a gallery and its
     * inner HTML is replaced.
     *
     * @since 1.0.0
     * @event-detail { galleryEl }
     */
    public const GALLERY_UNLOCKED = 'fotogrids:gallery_unlocked';

    /**
     * Fired on `document` when an album item's click swaps the album in
     * place with the clicked child gallery.
     *
     * @since 1.0.0
     * @event-detail { albumEl, galleryEl, galleryId }
     */
    public const ALBUM_SWAPPED = 'fotogrids:album_swapped';

    /**
     * Fired on `document` when the album view is restored from a swapped
     * state (back button, "back to album" link).
     *
     * @since 1.0.0
     * @event-detail { albumEl }
     */
    public const ALBUM_RESTORED = 'fotogrids:album_restored';

    /**
     * Fired on `document` once the Filter UI has finished its initial
     * mount. Pro extensions hook here to attach extra filter pills.
     *
     * Note: this is the only `fotogrids/...` (slash-form) DOM event; every
     * other JS event uses the `fotogrids:` colon prefix. Treat the
     * inconsistency as pre-1.0 baggage and don't add new `fotogrids/...`
     * events.
     *
     * @since 1.0.0
     */
    public const FILTER_UI_READY = 'fotogrids/filters/ready';
}
