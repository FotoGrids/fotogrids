<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Pagination;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Internal\Layout_Capabilities;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Shared behaviour for the three pagination sibling modules.
 *
 * Holds:
 *  - page-size resolution (responsive `items_per_page` shape → int),
 *  - "should this gallery actually paginate" check,
 *  - preload flag resolution,
 *  - the canonical wrapper data-attrs every method writes,
 *  - the standard assets() declaration (each method JS depends on
 *    `fotogrids-pagination-core` which depends on `fotogrids-runtime`).
 *
 * Used as a trait, not a base class, because the modules implement
 * `Feature` directly and PHP doesn't let us inherit from an interface.
 *
 * @package FotoGrids\Render\Features\Pagination
 * @since   1.0.0
 */
trait Pagination_Common {

    /**
     * Shared gating predicate.
     *
     * Returns false for albums and when pagination_type !== 'paginated'.
     * Each module then adds its own `pagination_method` check on top of
     * this.
     *
     * @since 1.0.0
     */
    protected function pagination_supports( Render_Context $render_context ): bool {
        if ( $render_context->meta->collection_kind === Collection_Kind::ALBUM ) {
            return false;
        }

        // Ask the active layout whether it wants pagination chrome around
        // it. Layouts like Single Item, Image Viewer, Slider, and Carousel
        // return capabilities()['paginates'] = false because they render
        // a single item (or handle navigation inside themselves). Layouts
        // that don't care (Grid, Masonry, Justified) return [], which the
        // helper treats as permissive default true.
        if ( ! Layout_Capabilities::supports( $render_context, 'paginates' ) ) {
            return false;
        }

        $type = $render_context->settings['pagination_type'] ?? 'show_all';
        if ( $type !== 'paginated' ) {
            return false;
        }

        // If total items <= page size, nothing to paginate.
        return Page_Size_Resolver::should_paginate(
            (int) ( $render_context->meta->total_item_count ?? count( $render_context->items ) ),
            Page_Size_Resolver::resolve_page_size( $render_context->settings, $render_context )
        );
    }

    /**
     * Delegates to Page_Size_Resolver::resolve_page_size().
     *
     * Kept as a static method on the trait for API ergonomics inside the
     * module classes; calls the shared resolver under the hood so the
     * module classes and Context_Builder agree on the answer.
     *
     * @since 1.0.0
     * @param array<string, mixed> $settings
     */
    public static function resolve_page_size( array $settings, ?Render_Context $render_context = null ): int {
        return Page_Size_Resolver::resolve_page_size( $settings, $render_context );
    }

    /**
     * Delegates to Page_Size_Resolver::should_paginate().
     *
     * @since 1.0.0
     */
    public static function should_paginate( int $total_items, int $page_size ): bool {
        return Page_Size_Resolver::should_paginate( $total_items, $page_size );
    }

    /**
     * Whether preloading the next page is enabled.
     *
     * Pro-gated: setting lives in Free but the toggle is tier_required:
     * pro_starter, so unlicensed sites get false even if the value is true.
     *
     * @since 1.0.0
     */
    protected function preload_enabled( Render_Context $render_context ): bool {
        if ( empty( $render_context->settings['preload_next_page'] ) ) {
            return false;
        }

        // TODO: also check License_Manager::feature_enabled( 'preload_next_page' )
        // so the toggle doesn't activate on unlicensed sites even if the
        // value is somehow saved as true.
        return true;
    }

    /**
     * Canonical wrapper data-attrs every pagination method emits.
     *
     * Each method's wrapper_data_attrs() should call this and merge its
     * own attrs on top.
     *
     * @since 1.0.0
     * @return array<string, string>
     */
    protected function common_wrapper_attrs( Render_Context $render_context, string $method ): array {
        $page_size   = self::resolve_page_size( $render_context->settings, $render_context );
        $total       = (int) ( $render_context->meta->total_item_count ?? count( $render_context->items ) );
        $total_pages = (int) ceil( $total / $page_size );
        $current     = (int) ( $render_context->meta->requested_page ?? 1 );

        // The REST URL + nonce for the JS to fetch additional pages.
        // Mirrors how Album_To_Gallery_Ajax wires its <a> triggers — same
        // endpoint, same nonce action ('wp_rest'). Written on the gallery
        // wrapper itself so pagination-core.js can read it via
        // `galleryEl.dataset.fgRenderUrl` / `dataset.fgRenderNonce`.
        $attrs = [
            'data-fg-paginated'           => 'true',
            'data-fg-pagination-method'   => $method,
            'data-fg-page-size'           => (string) $page_size,
            'data-fg-page-current'        => (string) $current,
            'data-fg-page-total'          => (string) $total_pages,
            // Authoritative total item count for the filtered+sorted
            // sequence. Used by the lightbox to size its sparse slide
            // cache correctly without estimating from
            // total_pages * page_size (which over-counts when the last
            // page is partial — a 49-item gallery with page_size=8
            // would estimate 56).
            'data-fg-total-items'         => (string) $total,
            'data-fg-pagination-preload'  => $this->preload_enabled( $render_context ) ? 'true' : 'false',
            'data-fg-render-url'          => esc_url( rest_url( 'fotogrids/v1/gallery/render' ) ),
            'data-fg-render-nonce'        => esc_attr( wp_create_nonce( 'wp_rest' ) ),
        ];

        // Random sort seed — pagination-core.js sends this back with
        // every paginated request so paginated/filtered draws share the
        // same shuffle permutation. Only emitted when sort is random;
        // otherwise it's irrelevant and bloats the attribute list.
        if ( ( $render_context->settings['default_sort_order'] ?? '' ) === 'random'
            && $render_context->meta->random_seed !== null
        ) {
            $attrs['data-fg-random-seed'] = (string) $render_context->meta->random_seed;
        }

        return $attrs;
    }

    /**
     * Standard assets declaration shared by all three method modules.
     *
     * Each method module returns this plus its own per-method CSS/JS file
     * on top.
     *
     * The shared CSS (pagination.css) holds the base button look, the
     * sr-only status region, and the loading/disabled states — all three
     * method modules pull it in automatically. See pagination.css for the
     * full list of selectors and theming hooks.
     *
     * @since 1.0.0
     */
    protected function common_assets(): Module_Assets {
        return new Module_Assets(
            css: [
                'fotogrids-pagination' => new Asset_Decl(
                    path:      'features/pagination/pagination.css',
                    in_footer: false,
                ),
            ],
            js:  [
                'fotogrids-pagination-core' => new Asset_Decl(
                    path:      '../../assets/js/pagination-core.js',
                    deps:      [ 'fotogrids-runtime' ],
                    in_footer: true,
                ),
            ]
        );
    }
}
