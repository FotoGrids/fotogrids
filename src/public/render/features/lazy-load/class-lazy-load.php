<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Lazy_Load;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Lazy Load feature module.
 *
 * When the gallery's `lazy_load` setting is true (the default), this module
 * writes `data-fg-lazy="1"` onto the gallery wrapper element.  The frontend
 * JS reads this attribute in `initializeLazyLoading()` to decide whether to
 * attach the IntersectionObserver enhancement layer for that gallery.
 *
 * The native `loading="lazy"` attribute on each `<img>` is handled separately
 * by Item_Renderer and is also conditioned on this same setting.
 *
 * @package FotoGrids\Render\Features\Lazy_Load
 * @since   1.0.0
 */
final class Lazy_Load implements Feature {

    public function id(): string {
        return 'fotogrids/lazy-load';
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
     * Active when lazy_load is enabled (true by default).
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function supports( Render_Context $render_context ): bool {
        $setting = $render_context->settings['lazy_load'] ?? true;
        return (bool) $setting;
    }

    /**
     * Writes data-fg-lazy="1" onto the gallery wrapper when lazy loading is on.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [ 'data-fg-lazy' => '1' ];
    }

    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    public function html_before( Render_Context $render_context ): string {
        return '';
    }

    public function html_appendix( Render_Context $render_context ): string {
        return '';
    }

    public function html_after( Render_Context $render_context ): string {
        return '';
    }

    /**
     * IntersectionObserver enhancement layer for native-lazy and data-src
     * lazy images. Ships from public/render/features/lazy-load/.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            js: [
                'fotogrids-lazy-load' => new Asset_Decl(
                    path:      '../../assets/js/lazy-load.js',
                    deps:      [ 'fotogrids-runtime' ],
                    in_footer: true,
                ),
            ]
        );
    }
}
