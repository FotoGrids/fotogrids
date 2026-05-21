<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Captions;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Decorator;
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

        return [
            '--fg-caption-align'       => $caption_alignment,
            '--fg-caption-media-align' => $media_align,
            '--fg-caption-gap'         => new Responsive_Var(
                desktop: $gap_desktop,
                tablet:  $gap_tablet,
                mobile:  $gap_mobile,
            ),
        ];
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
}
