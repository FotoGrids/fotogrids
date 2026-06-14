<?php
declare(strict_types=1);

namespace FotoGrids\Render\Layouts;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Masonry layout module.
 *
 * Capabilities:
 *   - uses_columns      : --fg-cols / --fg-col-min / --fg-col-max,
 *                         plus data-fg-columns-mode.
 *   - uses_item_spacing : --fg-gap.
 *
 * Reads the masonry-specific settings layout_masonry_order
 * ('row' | 'column') and exposes data-fg-masonry-order on the wrapper so
 * the CSS can pick the right column-flow direction.
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Masonry implements Layout {

    public function id(): string {
        return 'fotogrids/masonry';
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

    public function layout_key(): string {
        return 'masonry';
    }

    public function supports( Render_Context $render_context ): bool {
        return $render_context->layout->layout_id === 'masonry';
    }

    public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
        $items_html = '';
        foreach ( $render_context->items as $item_view ) {
            $hidden_view = $item_view->with( [
                'classes' => array_merge( $item_view->classes, [ 'fg-item-hidden' ] ),
            ] );
            $items_html .= $item_renderer->render( $hidden_view, $render_context );
        }

        return '<div class="fg-masonry-track" data-fg-items-root="true">' . $items_html . '</div>';
    }

    public function structural_classes( Render_Context $render_context ): array {
        return [];
    }

    /**
     * @since   1.0.0
     * @return  array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        $order = $render_context->settings['layout_masonry_order'] ?? 'row';
        $order = in_array( $order, [ 'row', 'column' ], true ) ? $order : 'row';

        return [
            'data-fg-masonry-order' => $order,
        ];
    }

    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                'fotogrids-render-base'    => new Asset_Decl( path: 'base/collection-base.css' ),
                'fotogrids-layout-masonry' => new Asset_Decl( path: 'layouts/masonry/masonry.css' ),
            ],
            js: [
                'fotogrids-layout-masonry' => new Asset_Decl(
                    path:      '../../assets/js/layout-masonry.js',
                    deps:      [ 'fotogrids-runtime' ],
                    in_footer: true,
                ),
            ]
        );
    }

    public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
        return \FotoGrids\Image_Size_Manager::SLUG_MASONRY;
    }

    /**
     * Masonry stacks items at a fixed column width with variable heights, so
     * it requires the proportional fotogrids_masonry derivative. A cropped
     * or square user-picked size would flatten the column rhythm and defeat
     * the layout — the preference is mandatory.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function requires_thumbnail_size( Render_Context $render_context ): bool {
        return true;
    }

    public function capabilities(): array {
        return [
            'uses_columns'      => true,
            'uses_item_spacing' => true,
        ];
    }
}
