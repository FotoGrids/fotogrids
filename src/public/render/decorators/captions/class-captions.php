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

        // Vertical alignment + tinted overlay background only apply when the
        // caption is overlaid on the media. Top/bottom placements stack
        // vertically with no background, so emitting these vars would just
        // pollute the cascade.
        $overlay_align = '';
        $overlay_bg    = '';
        $overlay_bg_hv = '';
        if ( $caption_placement === 'overlay' ) {
            $vertical_alignment = $this->setting_scalar( $settings['caption_vertical_alignment'] ?? null, 'bottom' );
            $overlay_align      = $this->vertical_alignment_to_flex( $vertical_alignment );

            $overlay_color  = is_string( $settings['caption_overlay_color'] ?? null ) ? $settings['caption_overlay_color'] : 'rgba(0, 0, 0, 0.3)';
            $overlay_pct    = $this->resolve_opacity_pct( $settings['caption_overlay_opacity'] ?? null, 100 );
            $overlay_hv_pct = $this->resolve_opacity_pct( $settings['caption_overlay_hover_opacity'] ?? null, 50 );

            $overlay_bg    = $this->apply_opacity_pct_to_color( $overlay_color, $overlay_pct );
            $overlay_bg_hv = $this->apply_opacity_pct_to_color( $overlay_color, $overlay_hv_pct );
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

        if ( $overlay_align !== '' ) {
            $vars['--fg-caption-overlay-align'] = $overlay_align;
        }
        if ( $overlay_bg !== '' ) {
            $vars['--fg-caption-overlay-bg'] = $overlay_bg;
        }
        if ( $overlay_bg_hv !== '' ) {
            $vars['--fg-caption-overlay-bg-hover'] = $overlay_bg_hv;
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

    /**
     * Map the caption_vertical_alignment setting (top|middle|bottom) to a CSS
     * align-items value. Anything unrecognised falls back to flex-end so the
     * caption stays anchored to the bottom, matching the historical overlay.
     *
     * @since  1.0.0
     * @param  string $vertical_alignment 'top', 'middle', or 'bottom'.
     * @return string                     'flex-start', 'center', or 'flex-end'.
     */
    private function vertical_alignment_to_flex( string $vertical_alignment ): string {
        return match ( $vertical_alignment ) {
            'top'    => 'flex-start',
            'middle' => 'center',
            default  => 'flex-end',
        };
    }

    /**
     * Normalise an opacity setting stored on the admin's 0-100 % scale to a
     * 0.0-1.0 multiplier. Values outside the range are clamped; non-numeric
     * input falls back to the supplied default percentage.
     *
     * @since  1.0.0
     * @param  mixed $raw         Raw setting value (expected numeric 0-100).
     * @param  int   $default_pct Fallback percentage if $raw is not numeric.
     * @return float              Multiplier in the range 0.0-1.0.
     */
    private function resolve_opacity_pct( mixed $raw, int $default_pct ): float {
        $pct = is_numeric( $raw ) ? (float) $raw : (float) $default_pct;
        if ( $pct < 0 ) {
            $pct = 0;
        } elseif ( $pct > 100 ) {
            $pct = 100;
        }
        return $pct / 100;
    }

    /**
     * Compose an rgba() string by combining a CSS color (rgba/rgb/#hex with or
     * without alpha) with an opacity multiplier in the 0.0-1.0 range. The
     * source color's own alpha is multiplied by the supplied multiplier so a
     * semi-transparent picker colour at 50 % opacity stays semi-transparent.
     *
     * Unparseable input falls back to rgba(0, 0, 0, $multiplier * 0.3) so the
     * overlay still renders something rather than vanishing.
     *
     * @since  1.0.0
     * @param  string $color      Source CSS colour string.
     * @param  float  $multiplier Opacity multiplier (0.0-1.0).
     * @return string             rgba() string.
     */
    private function apply_opacity_pct_to_color( string $color, float $multiplier ): string {
        $color = trim( $color );
        $r = 0;
        $g = 0;
        $b = 0;
        $a = 0.3;

        if ( preg_match( '/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)\s*(?:[ ,\/]+([\d.]+%?))?\s*\)$/i', $color, $m ) ) {
            $r = (int) round( (float) $m[1] );
            $g = (int) round( (float) $m[2] );
            $b = (int) round( (float) $m[3] );
            if ( isset( $m[4] ) && $m[4] !== '' ) {
                $alpha_raw = $m[4];
                if ( str_ends_with( $alpha_raw, '%' ) ) {
                    $a = ( (float) rtrim( $alpha_raw, '%' ) ) / 100;
                } else {
                    $a = (float) $alpha_raw;
                }
            } else {
                $a = 1.0;
            }
        } elseif ( preg_match( '/^#([0-9a-f]{3,8})$/i', $color, $m ) ) {
            $hex = $m[1];
            $len = strlen( $hex );
            if ( $len === 3 || $len === 4 ) {
                $r = hexdec( str_repeat( $hex[0], 2 ) );
                $g = hexdec( str_repeat( $hex[1], 2 ) );
                $b = hexdec( str_repeat( $hex[2], 2 ) );
                $a = $len === 4 ? hexdec( str_repeat( $hex[3], 2 ) ) / 255 : 1.0;
            } elseif ( $len === 6 || $len === 8 ) {
                $r = hexdec( substr( $hex, 0, 2 ) );
                $g = hexdec( substr( $hex, 2, 2 ) );
                $b = hexdec( substr( $hex, 4, 2 ) );
                $a = $len === 8 ? hexdec( substr( $hex, 6, 2 ) ) / 255 : 1.0;
            }
        }

        if ( $a < 0 ) {
            $a = 0;
        } elseif ( $a > 1 ) {
            $a = 1;
        }

        $final_alpha = round( $a * $multiplier, 4 );

        return sprintf( 'rgba(%d, %d, %d, %s)', $r, $g, $b, rtrim( rtrim( (string) $final_alpha, '0' ), '.' ) ?: '0' );
    }
}
