<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Pagination\Load_More;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Features\Pagination\Pagination_Common;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Load-more pagination.
 *
 * Active when:
 *   - pagination_type   === 'paginated'
 *   - pagination_method === 'load_more'
 *
 * Renders a button after the layout (via html_after). Client-side, the
 * button click calls FotoGrids.modules.pagination.goToPage(gEl, next, {
 * mode: 'append' }). The button hides itself when has_more is false.
 *
 * Reads:
 *   - load_more_button_text         (string)
 *   - load_more_button_full_width   (bool)
 *   - load_more_button_alignment    (left | center | right)
 *
 * @package FotoGrids\Render\Features\Pagination\Load_More
 * @since   1.0.0
 */
final class Load_More implements Feature {

    use Pagination_Common;

    /** @var array<int, string> Allowed alignment values from the JSON schema. */
    private const ALLOWED_ALIGNMENTS = [ 'left', 'center', 'right' ];

    public function id(): string {
        return 'fotogrids/pagination/load-more';
    }

    public function origin(): string {
        return 'fotogrids';
    }

    public function replaces(): ?string {
        return null;
    }

    public function extends_id(): ?string {
        return null;
    }

    public function supports( Render_Context $render_context ): bool {
        if ( ! $this->pagination_supports( $render_context ) ) {
            return false;
        }

        return ( $render_context->settings['pagination_method'] ?? '' ) === 'load_more';
    }

    public function html_before( Render_Context $render_context ): string {
        return '';
    }

    /**
     * Renders the load-more button + status region.
     *
     * Uses html_appendix (NOT html_after) so the bar lives INSIDE the
     * gallery wrapper. html_after places content as a sibling, but the
     * JS reads the bar via `galleryEl.querySelector(...)` which only
     * descends into the wrapper.
     *
     * @since 1.0.0
     */
    public function html_appendix( Render_Context $render_context ): string {
        $label    = $this->resolve_button_text( $render_context );
        $is_full  = (bool) ( $render_context->settings['load_more_button_full_width'] ?? false );
        $align    = $this->resolve_alignment( $render_context );

        $wrapper_classes = [ 'fg-pagination', 'fg-pagination--load-more' ];
        if ( $is_full ) {
            $wrapper_classes[] = 'fg-pagination--full-width';
        } else {
            $wrapper_classes[] = 'fg-pagination--align-' . $align;
        }

        // Button carries both .fg-pagination__btn (base look from shared
        // pagination.css) and .fg-pagination__load-more (structural hook for
        // full-width + any load-more-only theming).
        return sprintf(
            '<div class="%s" data-fg-pagination-role="load-more">'
            . '<button type="button" class="fg-pagination__btn fg-pagination__load-more"'
            . ' data-fg-pagination-trigger="load-more">%s</button>'
            . '<div class="fg-pagination__status" role="status" aria-live="polite"></div>'
            . '</div>',
            esc_attr( implode( ' ', $wrapper_classes ) ),
            esc_html( $label )
        );
    }

    public function html_after( Render_Context $render_context ): string {
        return '';
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return $this->common_wrapper_attrs( $render_context, 'load_more' );
    }

    public function style_vars( Render_Context $render_context ): array {
        // All styling vars live on the trait now — both Load More and
        // Page Buttons share the same `pagination_buttons_subtabs` →
        // Styling tab in pagination.json, so the resolution sits in
        // Pagination_Common::common_style_vars().
        return $this->common_style_vars( $render_context );
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        $common = $this->common_assets();

        return new Module_Assets(
            css: array_merge( $common->css, [
                'fotogrids-pagination-load-more' => new Asset_Decl(
                    path:      'features/pagination/load-more/load-more.css',
                    in_footer: false,
                ),
            ] ),
            js: array_merge( $common->js, [
                'fotogrids-pagination-load-more' => new Asset_Decl(
                    path:      '../../assets/js/load-more.js',
                    deps:      [ 'fotogrids-pagination-core' ],
                    in_footer: true,
                ),
            ] )
        );
    }

    // -------------------------------------------------------------------------
    // Setting resolution
    // -------------------------------------------------------------------------

    private function resolve_button_text( Render_Context $render_context ): string {
        $raw = $render_context->settings['load_more_button_text'] ?? '';
        $raw = is_string( $raw ) ? trim( $raw ) : '';

        return $raw !== '' ? $raw : __( 'Load More', 'fotogrids' );
    }

    private function resolve_alignment( Render_Context $render_context ): string {
        $value = $render_context->settings['load_more_button_alignment'] ?? 'center';

        return in_array( $value, self::ALLOWED_ALIGNMENTS, true )
            ? (string) $value
            : 'center';
    }
}
