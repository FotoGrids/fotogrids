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
 * Opt-in capabilities:
 *   - uses_columns      : --fg-cols + data-fg-columns-mode
 *   - uses_item_spacing : --fg-gap
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
            $items_html .= $item_renderer->render( $item_view, $render_context );
        }

        return '<div class="fg-masonry-track">' . $items_html . '</div>';
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
                'fotogrids-render-base'    => new Asset_Decl( path: 'base/collection-base.css' ),
                'fotogrids-layout-masonry' => new Asset_Decl( path: 'layouts/masonry/masonry.css' ),
            ]
        );
    }

    public function capabilities(): array {
        return [
            'uses_columns'      => true,
            'uses_item_spacing' => true,
        ];
    }
}
