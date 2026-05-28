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
 * Grid layout module.
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Grid implements Layout {

    public function id(): string {
        return 'fotogrids/grid';
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
        return 'grid';
    }

    public function supports( Render_Context $render_context ): bool {
        return $render_context->layout->layout_id === 'grid';
    }

    public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
        $items_html = '';
        foreach ( $render_context->items as $item_view ) {
            $items_html .= $item_renderer->render( $item_view, $render_context );
        }

        // data-fg-items-root marks this element as the container that
        // pagination-core.js can append/replace items inside.
        return '<div class="fg-grid-track" data-fg-items-root="true">' . $items_html . '</div>';
    }

    public function structural_classes( Render_Context $render_context ): array {
        return [];
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [
            'data-fg-layout'       => 'grid',
            'data-fg-columns-mode' => $render_context->layout->columns_mode->value,
        ];
    }

    public function style_vars( Render_Context $render_context ): array {
        $default_settings = function_exists( 'fotogrids_get_default_gallery_settings' )
            ? fotogrids_get_default_gallery_settings()
            : [];

        $responsive_columns = $render_context->layout->responsive_columns;
        $responsive_spacing = $render_context->layout->responsive_spacing;
        $auto_range         = $render_context->layout->columns_auto_range;
        $default_columns    = is_array( $default_settings['columns'] ?? null )     ? $default_settings['columns']      : [];
        $default_spacing    = is_array( $default_settings['item_spacing'] ?? null ) ? $default_settings['item_spacing'] : [];
        $default_auto_range = is_array( $default_settings['columns_auto_range'] ?? null ) ? $default_settings['columns_auto_range'] : [];

        $style_vars = [
            '--fg-gap' => new Responsive_Var(
                desktop: $this->resolve_spacing_value( $responsive_spacing, 'desktop', $default_spacing ),
                tablet:  $this->resolve_spacing_value( $responsive_spacing, 'tablet',  $default_spacing ),
                mobile:  $this->resolve_spacing_value( $responsive_spacing, 'mobile',  $default_spacing ),
            ),
        ];

        if ( $render_context->layout->columns_mode->value === 'fixed' ) {
            $style_vars['--fg-cols'] = new Responsive_Var(
                desktop: $this->resolve_column_count( $responsive_columns, 'desktop', $default_columns ),
                tablet:  $this->resolve_column_count( $responsive_columns, 'tablet',  $default_columns ),
                mobile:  $this->resolve_column_count( $responsive_columns, 'mobile',  $default_columns ),
            );

            return $style_vars;
        }

        $desktop_auto = $this->resolve_auto_range(
            is_array( $auto_range['desktop'] ?? null ) ? $auto_range['desktop'] : [],
            is_array( $default_auto_range['desktop'] ?? null ) ? $default_auto_range['desktop'] : []
        );
        $tablet_auto = $this->resolve_auto_range(
            is_array( $auto_range['tablet'] ?? null ) ? $auto_range['tablet'] : [],
            is_array( $default_auto_range['tablet'] ?? null ) ? $default_auto_range['tablet'] : []
        );
        $mobile_auto = $this->resolve_auto_range(
            is_array( $auto_range['mobile'] ?? null ) ? $auto_range['mobile'] : [],
            is_array( $default_auto_range['mobile'] ?? null ) ? $default_auto_range['mobile'] : []
        );

        $style_vars['--fg-col-min'] = new Responsive_Var(
            desktop: $desktop_auto['min'],
            tablet:  $tablet_auto['min'],
            mobile:  $mobile_auto['min'],
        );
        $style_vars['--fg-col-max'] = new Responsive_Var(
            desktop: $desktop_auto['max'],
            tablet:  $tablet_auto['max'],
            mobile:  $mobile_auto['max'],
        );

        return $style_vars;
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                'fotogrids-render-base' => new Asset_Decl(
                    path: 'base/collection-base.css'
                ),
                'fotogrids-layout-grid' => new Asset_Decl(
                    path: 'layouts/grid/grid.css'
                ),
            ]
        );
    }

    private function to_unit_value( mixed $raw_value, string $default_unit ): string {
        if ( $raw_value === null || $raw_value === '' ) {
            return '';
        }

        if ( is_array( $raw_value ) ) {
            if ( ! isset( $raw_value['value'] ) || $raw_value['value'] === '' ) {
                return '';
            }
            $value = $raw_value['value'];
            $unit  = $raw_value['unit'] ?? $default_unit;
            return (string) $value . $unit;
        }

        return (string) $raw_value . $default_unit;
    }

    /**
     * @param  array<string, mixed> $range
     * @param  array<string, mixed> $fallback
     * @return array{min: string, max: string}
     */
    private function resolve_auto_range( array $range, array $fallback ): array {
        return [
            'min' => $this->to_unit_value( $range['min'] ?? ( $fallback['min'] ?? '' ), 'px' ),
            'max' => $this->to_unit_value( $range['max'] ?? ( $fallback['max'] ?? '' ), 'px' ),
        ];
    }

    /**
     * @param  array<string, mixed> $responsive_spacing
     * @param  string               $breakpoint
     * @param  array<string, mixed> $default_spacing
     * @return string
     */
    private function resolve_spacing_value( array $responsive_spacing, string $breakpoint, array $default_spacing ): string {
        $raw_spacing = $responsive_spacing[ $breakpoint ] ?? ( $default_spacing[ $breakpoint ] ?? '' );
        return $this->to_unit_value( $raw_spacing, 'px' );
    }

    /**
     * @param  array<string, mixed> $responsive_columns
     * @param  string               $breakpoint
     * @param  array<string, mixed> $default_columns
     * @return string
     */
    private function resolve_column_count( array $responsive_columns, string $breakpoint, array $default_columns ): string {
        $column_value = $responsive_columns[ $breakpoint ] ?? ( $default_columns[ $breakpoint ] ?? '' );
        if ( $column_value === '' || $column_value === null ) {
            return '';
        }
        return (string) absint( $column_value );
    }
}
