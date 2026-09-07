<?php
/**
 * Render-cache decision filter hooks.
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
 * Cache filter hooks.
 */
final class Filters_Cache {

	/**
	 * Whether a render should be cached at all.
	 *
	 * @since 1.0.0
	 * @param bool  $should_cache Default true.
	 * @param array $settings     Collection settings.
	 * @param int   $gallery_id   Gallery ID.
	 */
	public const SHOULD_CACHE = 'fotogrids/cache/should_cache';

	/**
	 * Cache bucket identifier for partitioning the cache (e.g. by locale).
	 *
	 * @since 1.0.0
	 * @param string $bucket     Default 'default'.
	 * @param array  $settings   Collection settings.
	 * @param int    $gallery_id Gallery ID.
	 */
	public const BUCKET = 'fotogrids/cache/bucket';

	/**
	 * Whether to ask host, page-builder and CDN caches not to store the page
	 * a collection is rendering on.
	 *
	 * Distinct from {@see SHOULD_CACHE}, which governs the FotoGrids render
	 * cache - the one cache the plugin owns. This filter governs the caches it
	 * does not: returning true makes the renderer define `DONOTCACHEPAGE` and
	 * send a `Cache-Control: no-store` response, which those layers are free
	 * to honor or ignore.
	 *
	 * The value passed in is resolved from the collection's settings: true
	 * only when random sorting is set to run on the server, where a stored
	 * page would defeat the setting. Returning true unconditionally makes
	 * every page holding such a collection uncacheable.
	 *
	 * @since 1.0.0
	 * @param bool  $bypass     Resolved value (true for server-side random sort).
	 * @param array $settings   Collection settings.
	 * @param int   $gallery_id Gallery ID.
	 */
	public const BYPASS_PAGE_CACHE = 'fotogrids/cache/bypass_page_cache';
}
