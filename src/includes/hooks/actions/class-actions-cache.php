<?php
/**
 * Render-cache lifecycle action hooks.
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
 * Cache action hooks.
 */
final class Actions_Cache {

    /**
     * Fires on a render-cache hit.
     *
     * @since 1.0.0
     * @param int    $gallery_id Gallery ID.
     * @param string $cache_key  Cache key.
     */
    public const HIT = 'fotogrids/cache/hit';

    /**
     * Fires after a render result is written to the cache.
     *
     * @since 1.0.0
     * @param int    $gallery_id Gallery ID.
     * @param string $cache_key  Cache key.
     */
    public const WRITTEN = 'fotogrids/cache/written';

    /**
     * Fires after the render cache is flushed for a single gallery.
     *
     * @since 1.0.0
     * @param int $gallery_id Gallery ID.
     */
    public const FLUSHED_FOR_GALLERY = 'fotogrids/cache/flushed_for_gallery';

    /**
     * Fires after the entire render cache is flushed.
     *
     * @since 1.0.0
     */
    public const FLUSHED_ALL = 'fotogrids/cache/flushed_all';

    /**
     * Fires after expired cache entries are purged.
     *
     * @since 1.0.0
     * @param int $deleted Count of purged rows.
     */
    public const PURGED_EXPIRED = 'fotogrids/cache/purged_expired';
}
