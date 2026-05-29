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
 * Single Item layout module.
 *
 * Renders one item from the gallery as a full-width hero. The item is
 * picked by the active sorter (Context_Builder slices the sorted ID list
 * to length 1 for this layout), so:
 *
 *   - sort=manual  -> the first manually-ordered item
 *   - sort=random  -> a different random item per request
 *   - sort=date    -> the earliest/latest by date
 *   - sort=title   -> the first by title order
 *
 * The image renders at fotogrids_full size (also enforced upstream) so
 * the <picture> srcset has full-resolution candidates available for
 * high-DPI displays. All standard decorators (Lightbox, Sharing, hover
 * effects, etc.) still apply.
 *
 * Opt-in capabilities:
 *   - enforces_item_box : --fg-item-aspect-ratio / --fg-item-fit /
 *                         data-fg-natural-ratio (when ratio = None)
 *   - lightbox_extends  : data-fg-lightbox-extended + total-items +
 *                         render-url + nonce, when click=lightbox and
 *                         the user picked lightbox_scope=gallery
 *
 * Opt-out capabilities:
 *   - paginates : false (only one item is ever rendered)
 *   - filters   : false (nothing meaningful to filter a single image)
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Single_Item implements Layout {

    public function id(): string {
        return 'fotogrids/single-item';
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
        return 'single-item';
    }

    public function supports( Render_Context $render_context ): bool {
        return $render_context->layout->layout_id === 'single-item';
    }

    public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
        $items_html = '';
        foreach ( $render_context->items as $item_view ) {
            $items_html .= $item_renderer->render( $item_view, $render_context );
        }

        return '<div class="fg-single-item-track">' . $items_html . '</div>';
    }

    public function structural_classes( Render_Context $render_context ): array {
        return [];
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [];
    }

    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                'fotogrids-render-base'        => new Asset_Decl( path: 'base/collection-base.css' ),
                'fotogrids-layout-single-item' => new Asset_Decl( path: 'layouts/single-item/single-item.css' ),
            ]
        );
    }

    public function capabilities(): array {
        return [
            'enforces_item_box' => true,
            'lightbox_extends'  => true,
            'paginates'         => false,
            'filters'           => false,
        ];
    }
}
