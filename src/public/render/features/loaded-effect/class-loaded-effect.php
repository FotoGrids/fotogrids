<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Loaded_Effect;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Loaded Effect feature module.
 *
 * Controls the reveal animation played on each gallery item when its image
 * finishes loading (i.e. when data-fg-media-state flips from "loading" to
 * "loaded"). The loading-icon SCSS handles hiding the image while it loads;
 * this feature drives the entrance animation that follows.
 *
 * Each effect is a small self-contained CSS file in:
 *   features/loaded-effect/effects/<effect-id>.css
 *
 * The selected effect ID is written as data-fg-loaded-effect on the gallery
 * wrapper so CSS selectors can scope cleanly without class name collisions.
 *
 * Supported effects
 * -----------------
 *   none  — image appears instantly with no transition.
 *   fade  — image fades in (opacity 0 → 1). This is the default.
 *   rise  — image fades in while sliding up from a few pixels below.
 *   drop  — image fades in while sliding down from a few pixels above.
 *   zoom  — image fades in while scaling up from 95 %.
 *   blur  — image fades in while deblurring (blur 4px → 0).
 *
 * @package FotoGrids\Render\Features\Loaded_Effect
 * @since   1.0.0
 */
final class Loaded_Effect implements Feature {

    /**
     * Default effect when no setting is configured.
     *
     * @since 1.0.0
     */
    private const DEFAULT_EFFECT = 'fade';

    /**
     * @var array<int, string>
     */
    private const SUPPORTED_EFFECTS = [
        'none',
        'fade',
        'rise',
        'drop',
        'zoom',
        'blur',
    ];

    // -------------------------------------------------------------------------
    // Feature contract
    // -------------------------------------------------------------------------

    public function id(): string {
        return 'fotogrids/loaded-effect';
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

    /**
     * Always active — every gallery has a loaded effect (even if "none").
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function supports( Render_Context $render_context ): bool {
        return true;
    }

    /**
     * No extra markup appended inside the gallery wrapper.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    public function html_appendix( Render_Context $render_context ): string {
        return '';
    }

    /**
     * No per-gallery inline script needed.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    public function html_after( Render_Context $render_context ): string {
        return '';
    }

    /**
     * Writes data-fg-loaded-effect onto the gallery wrapper.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [
            'data-fg-loaded-effect' => $this->resolve_effect( $render_context ),
        ];
    }

    /**
     * No CSS custom properties needed — effects are CSS-only.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string>
     */
    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    /**
     * Enqueues the base stylesheet and the per-effect stylesheet.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        $effect = $this->resolve_effect( $render_context );

        $css_assets = [
            'fotogrids-loaded-effect-base' => new Asset_Decl(
                path: 'features/loaded-effect/effects/base.css',
            ),
        ];

        if ( $effect !== 'none' ) {
            $css_assets[ 'fotogrids-loaded-effect-' . $effect ] = new Asset_Decl(
                path: 'features/loaded-effect/effects/' . $effect . '.css',
            );
        }

        return new Module_Assets( css: $css_assets );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolves and validates the effect ID from settings.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    private function resolve_effect( Render_Context $render_context ): string {
        $effect = $render_context->settings['loaded_effect'] ?? '';

        if ( ! is_string( $effect ) || $effect === '' ) {
            return self::DEFAULT_EFFECT;
        }

        return in_array( $effect, self::SUPPORTED_EFFECTS, true ) ? $effect : self::DEFAULT_EFFECT;
    }
}
