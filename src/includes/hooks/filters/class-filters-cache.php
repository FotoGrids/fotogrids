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
}
