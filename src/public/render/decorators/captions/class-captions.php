<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Captions;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Font_Resolver;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Applies caption placement and alignment classes.
 *
 * @package FotoGrids\Render\Decorators\Captions
 * @since   1.0.0
 */
final class Captions implements Decorator {

    use Setting_Helpers;

    public function id(): string {
        return 'fotogrids/captions';
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
        return true;
    }

    public function decorate_items( array $collection_items, Render_Context $render_context ): array {
        return $collection_items;
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        $caption_placement = $this->setting_scalar( $render_context->settings['caption_placement'] ?? null, 'overlay' );

        return [
            'data-fg-caption' => sanitize_html_class( $caption_placement ),
        ];
    }

    public function style_vars( Render_Context $render_context ): array {
        $settings          = $render_context->settings;
        $caption_placement = $this->setting_scalar( $settings['caption_placement'] ?? null, 'overlay' );
        $caption_alignment = $this->setting_scalar( $settings['caption_alignment'] ?? null, 'left' );
        $caption_gap       = $settings['caption_gap'] ?? [];
        $media_align       = $caption_placement === 'top' ? 'flex-end' : 'stretch';

        if ( $caption_placement === 'overlay' ) {
            $gap_desktop = '0';
            $gap_tablet  = '0';
            $gap_mobile  = '0';
        } else {
            $gap_desktop = $this->resolve_responsive_value( $caption_gap, 'desktop', 'px', '8px' );
            $gap_tablet  = $this->resolve_responsive_value( $caption_gap, 'tablet',  'px', $gap_desktop );
            $gap_mobile  = $this->resolve_responsive_value( $caption_gap, 'mobile',  'px', $gap_tablet );
        }

        $title_font_size = $settings['caption_title_font_size'] ?? [];
        $desc_font_size  = $settings['caption_description_font_size'] ?? [];

        $vars = [
            '--fg-caption-align'       => $caption_alignment,
            '--fg-caption-media-align' => $media_align,
            '--fg-caption-gap'         => new Responsive_Var(
                desktop: $gap_desktop,
                tablet:  $gap_tablet,
                mobile:  $gap_mobile,
            ),
            '--fg-caption-title-font-size' => new Responsive_Var(
                desktop: $this->resolve_responsive_value( $title_font_size, 'desktop', 'px', '18px' ),
                tablet:  $this->resolve_responsive_value( $title_font_size, 'tablet',  'px', '16px' ),
                mobile:  $this->resolve_responsive_value( $title_font_size, 'mobile',  'px', '14px' ),
            ),
            '--fg-caption-desc-font-size'  => new Responsive_Var(
                desktop: $this->resolve_responsive_value( $desc_font_size, 'desktop', 'px', '14px' ),
                tablet:  $this->resolve_responsive_value( $desc_font_size, 'tablet',  'px', '12px' ),
                mobile:  $this->resolve_responsive_value( $desc_font_size, 'mobile',  'px', '12px' ),
            ),
        ];

        $title_color = is_string( $settings['caption_title_color'] ?? null ) ? $settings['caption_title_color'] : '';
        if ( $title_color !== '' ) {
            $vars['--fg-caption-title-color'] = $title_color;
        }

        $desc_color = is_string( $settings['caption_description_color'] ?? null ) ? $settings['caption_description_color'] : '';
        if ( $desc_color !== '' ) {
            $vars['--fg-caption-desc-color'] = $desc_color;
        }

        // Line-clamp vars are only emitted when the limit mode is 'lines'.
        // The CSS rule fires on the presence of the var, so omitting it means
        // no clamp is applied - no extra specificity or class toggling needed.
        $title_limit_mode = $this->setting_scalar( $settings['caption_limit_title_length'] ?? null, 'no' );
        if ( $title_limit_mode === 'lines' ) {
            $title_lines = $settings['caption_max_title_lines'] ?? [];
            $vars['--fg-caption-title-lines'] = new Responsive_Var(
                desktop: $this->responsive_line_count( $title_lines, 'desktop', 1 ),
                tablet:  $this->responsive_line_count( $title_lines, 'tablet',  1 ),
                mobile:  $this->responsive_line_count( $title_lines, 'mobile',  1 ),
            );
        }

        $desc_limit_mode = $this->setting_scalar( $settings['caption_limit_description_length'] ?? null, 'no' );
        if ( $desc_limit_mode === 'lines' ) {
            $desc_lines = $settings['caption_max_desc_lines'] ?? [];
            $vars['--fg-caption-desc-lines'] = new Responsive_Var(
                desktop: $this->responsive_line_count( $desc_lines, 'desktop', 2 ),
                tablet:  $this->responsive_line_count( $desc_lines, 'tablet',  2 ),
                mobile:  $this->responsive_line_count( $desc_lines, 'mobile',  2 ),
            );
        }

        $resolver     = Font_Resolver::instance();
        $font_family  = $resolver->resolve_font_family( $settings['caption_title_font_family'] ?? null, $render_context );
        $font_weight  = $resolver->resolve_font_weight( $settings['caption_title_font_weight'] ?? null, $render_context );

        if ( $font_family !== '' ) {
            $vars['--fg-caption-title-font-family'] = $font_family;
        }

        if ( $font_weight !== '' ) {
            $vars['--fg-caption-title-font-weight'] = $font_weight;
        }

        return $vars;
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                'fotogrids-captions' => new Asset_Decl(
                    path: 'decorators/captions/captions.css'
                ),
            ]
        );
    }

    /**
     * Reads an integer line count from a responsive setting for one breakpoint.
     *
     * The setting is stored as a plain integer per breakpoint (no unit object),
     * so this helper reads and validates without going through normalize_unit_value.
     * Returns the count as a bare integer string (e.g. '2') for use as a CSS
     * custom-property value consumed by -webkit-line-clamp.
     *
     * @since  1.0.0
     * @param  mixed  $raw_responsive Breakpoint-keyed array, or null/non-array.
     * @param  string $breakpoint     'desktop', 'tablet', or 'mobile'.
     * @param  int    $default        Fallback line count.
     * @return string                 Plain integer string, e.g. '1', '2'.
     */
    private function responsive_line_count( mixed $raw_responsive, string $breakpoint, int $default ): string {
        if ( ! is_array( $raw_responsive ) ) {
            return (string) $default;
        }

        $raw = $raw_responsive[ $breakpoint ] ?? null;
        $n   = is_numeric( $raw ) && (int) $raw > 0 ? (int) $raw : $default;

        return (string) $n;
    }
}
