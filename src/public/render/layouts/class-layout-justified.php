<?php
declare(strict_types=1);

namespace FotoGrids\Render\Layouts;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Justified layout module.
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Justified implements Layout {

    public function id(): string {
        return 'fotogrids/justified';
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
        return 'justified';
    }

    public function supports( Render_Context $render_context ): bool {
        return $render_context->layout->layout_id === 'justified';
    }

    public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
        $items_html = '';
        foreach ( $render_context->items as $item_view ) {
            $items_html .= $item_renderer->render( $item_view, $render_context );
        }

        return '<div class="fg-justified-track">' . $items_html . '</div>';
    }

    public function structural_classes( Render_Context $render_context ): array {
        return [];
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [ 'data-fg-layout' => 'justified' ];
    }

    public function style_vars( Render_Context $render_context ): array {
        $responsive_spacing = $render_context->layout->responsive_spacing;

        return [
            '--fg-gap' => new Responsive_Var(
                desktop: $this->to_unit_value( $responsive_spacing['desktop'] ?? [ 'value' => 10, 'unit' => 'px' ], 'px' ),
                tablet:  $this->to_unit_value( $responsive_spacing['tablet']  ?? [ 'value' => 8,  'unit' => 'px' ], 'px' ),
                mobile:  $this->to_unit_value( $responsive_spacing['mobile']  ?? [ 'value' => 5,  'unit' => 'px' ], 'px' ),
            ),
        ];
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                'fotogrids-render-base'      => new Asset_Decl( path: 'base/collection-base.css' ),
                'fotogrids-layout-justified' => new Asset_Decl( path: 'layouts/justified/justified.css' ),
            ]
        );
    }

    private function to_unit_value( mixed $raw_value, string $default_unit ): string {
        if ( is_array( $raw_value ) ) {
            $value = $raw_value['value'] ?? 0;
            $unit  = $raw_value['unit']  ?? $default_unit;
            return (string) $value . $unit;
        }

        return (string) $raw_value . $default_unit;
    }
}
