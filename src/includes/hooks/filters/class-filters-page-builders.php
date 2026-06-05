<?php
/**
 * Page-builders filter hooks.
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
 * Filters used by the Page Builders module and its per-builder
 * sub-modules (Gutenberg, Elementor, Divi, Bricks, …).
 *
 * Each builder sub-module hooks these from its own boot file — Free's
 * core never knows about a specific builder.
 */
final class Filters_Page_Builders {

    /**
     * Whether the current page has FotoGrids content and therefore needs
     * the always-on frontend bootstrap (runtime localize handle +
     * errors stylesheet). Per-render module CSS/JS is owned by
     * Asset_Resolver and ships independently of this gate.
     *
     * Default detection scans `$post->post_content` for FotoGrids
     * shortcodes and Gutenberg blocks. Page-builder sub-modules whose
     * widget tree lives outside `post_content` (Elementor's
     * `_elementor_data`, Divi's `_et_pb_*` meta, Bricks' `_bricks_*`
     * meta, …) hook this filter to opt the page in.
     *
     * @since 1.0.0
     * @param bool          $detected Whether content was already detected.
     * @param \WP_Post|null $post     Current post (may be null on
     *                                theme-builder parts).
     */
    public const HAS_CONTENT = 'fotogrids/page_builders/has_content';

    /**
     * Lets Pro and third parties mutate (or add fields to) a picker
     * item before it's returned by the shared `/picker/items` REST
     * endpoint. Common use: append a Pro Stats "Views" column.
     *
     * @since 1.0.0
     * @param array[] $items Picker items.
     * @param string  $type  'gallery' | 'album'.
     */
    public const PICKER_ITEMS = 'fotogrids/page_builders/picker/items';
}
