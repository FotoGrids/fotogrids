<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Spacing;

use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Applies wrapper-level margin and padding to the gallery/album element.
 *
 * Reads two responsive four-sided settings — `margin` and `padding` — declared
 * in `collection-settings/layout.json`, and emits them as the `--fg-margin` and
 * `--fg-padding` CSS custom properties scoped to the gallery wrapper.
 *
 * The actual rules that read these variables live in `base/collection-base.css`
 * gated by `[data-fg-spacing]` so we only paint when the decorator is active.
 * That avoids forcing `margin: 0 0 0 0` over a theme's defaults when the user
 * hasn't configured spacing.
 *
 * @package FotoGrids\Render\Decorators\Spacing
 * @since   1.0.0
 */
final class Spacing implements Decorator {

    use Setting_Helpers;

    public function id(): string {
        return 'fotogrids/spacing';
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
        return $this->has_any_value( $render_context->settings['margin'] ?? null )
            || $this->has_any_value( $render_context->settings['padding'] ?? null );
    }

    public function decorate_items( array $collection_items, Render_Context $render_context ): array {
        return $collection_items;
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [
            'data-fg-spacing' => '1',
        ];
    }

    public function style_vars( Render_Context $render_context ): array {
        $settings = $render_context->settings;
        $margin   = $settings['margin']  ?? [];
        $padding  = $settings['padding'] ?? [];

        $vars = [];

        if ( $this->has_any_value( $margin ) ) {
            $vars['--fg-margin'] = new Responsive_Var(
                desktop: $this->resolve_four_sided_value( $margin, 'desktop', 'px' ),
                tablet:  $this->resolve_four_sided_value( $margin, 'tablet',  'px' ),
                mobile:  $this->resolve_four_sided_value( $margin, 'mobile',  'px' ),
            );
        }

        if ( $this->has_any_value( $padding ) ) {
            $vars['--fg-padding'] = new Responsive_Var(
                desktop: $this->resolve_four_sided_value( $padding, 'desktop', 'px' ),
                tablet:  $this->resolve_four_sided_value( $padding, 'tablet',  'px' ),
                mobile:  $this->resolve_four_sided_value( $padding, 'mobile',  'px' ),
            );
        }

        return $vars;
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets();
    }

    /**
     * True when at least one breakpoint of a responsive four-sided setting has a non-zero side.
     *
     * @since 1.0.0
     * @param mixed $responsive Raw responsive setting value.
     * @return bool
     */
    private function has_any_value( mixed $responsive ): bool {
        if ( ! is_array( $responsive ) ) {
            return false;
        }

        foreach ( [ 'desktop', 'tablet', 'mobile' ] as $breakpoint ) {
            if ( $this->breakpoint_has_value( $responsive[ $breakpoint ] ?? null ) ) {
                return true;
            }
        }

        return false;
    }
}
