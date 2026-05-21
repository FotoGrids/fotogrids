<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Loading_Icon;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Loading Icon feature module.
 *
 * Responsible for:
 *
 * 1. Emitting window.fotogridsLoadingIcon = { name, svg, animate } as a
 *    plain inline <script> in the page body, immediately after the first
 *    gallery wrapper (via html_after). This runs synchronously as the
 *    browser parses the page — before any images finish loading from cache
 *    and before DOMContentLoaded — so the global is always available when
 *    the per-gallery animate calls immediately follow in the same script.
 *
 *    `animate` is a raw WAAPI function (pre-built from loading-icons-waapi.json
 *    at build time). It accepts an SVG element and returns an array of
 *    Animation / rAF-cancel handles.
 *
 *    The same global is also registered via wp_add_inline_script (footer)
 *    for JS-built surfaces that need it after the page load — lightbox
 *    spinner, AJAX-loaded album items.
 *
 * 2. Writing data-fg-loading-icon="{icon_name}" on the gallery wrapper so
 *    JS can read which icon is active if needed.
 *
 * 3. Providing the --fg-loader-color CSS variable so gallery owners can tint
 *    the spinner via settings.
 *
 * 4. Starting WAAPI animations on all loader SVGs inside each gallery via
 *    an inline <script> in html_after, scoped to that gallery's instance ID.
 *    loading-icon.js (footer) handles state: it cancels animations and sets
 *    data-fg-media-state="loaded" when images settle.
 *
 * __FG_ID__ placeholder
 * ----------------------
 * The icon SVGs use __FG_ID__ as a placeholder for unique ID suffixes so
 * gradient / clipPath IDs don't collide across items. Item_Renderer replaces
 * it per item; the global svg template leaves it raw so JS can replace it
 * when injecting dynamically (lightbox spinner, AJAX items).
 *
 * @package FotoGrids\Render\Features\Loading_Icon
 * @since   1.0.0
 */
final class Loading_Icon implements Feature {

    /**
     * Default icon name when no setting is configured.
     *
     * @since 1.0.0
     */
    private const DEFAULT_ICON = '12-dots';

    /**
     * Whether wp_add_inline_script has been scheduled for the footer.
     *
     * @since 1.0.0
     * @var bool
     */
    private static bool $footer_scheduled = false;

    /**
     * Distinct icon names used by galleries on this page, in encounter order.
     *
     * Populated by assets() as each gallery is rendered. The footer action
     * reads this to build the full icons map.
     *
     * @since 1.0.0
     * @var array<string, true>
     */
    private static array $icon_names_seen = [];

    // -------------------------------------------------------------------------
    // Feature contract
    // -------------------------------------------------------------------------

    public function id(): string {
        return 'fotogrids/loading-icon';
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
     * Always active — every gallery shows a loader while images are fetched.
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
     * Emits a tiny inline <script> immediately after each gallery wrapper.
     *
     * This script pushes the gallery instance ID onto window.fgAnimQueue —
     * a plain array that the footer global script drains immediately when it
     * is defined. This bridges the timing gap: the queue is populated
     * synchronously as the browser parses the page body (before images load
     * from cache), and the footer script processes it as soon as it runs.
     *
     * The script contains no JS operators that wptexturize could mangle
     * (no &&, <, >, & outside of strings) — just an array push with a
     * JSON-encoded string argument.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    public function html_after( Render_Context $render_context ): string {
        $instance_id = $render_context->meta->instance_id;
        $id_json     = wp_json_encode( $instance_id );

        // Intentionally minimal — no operators, no symbols wptexturize touches.
        return '<script>'
            . 'window.fgAnimQueue=window.fgAnimQueue||[];'
            . 'window.fgAnimQueue.push(' . $id_json . ');'
            . '</script>';
    }

    /**
     * Writes data-fg-loading-icon onto the gallery wrapper.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [
            'data-fg-loading-icon' => $this->resolve_icon_name( $render_context ),
        ];
    }

    /**
     * Provides --fg-loader-color from the loading_icon_color setting.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string>
     */
    public function style_vars( Render_Context $render_context ): array {
        $color = $render_context->settings['loading_icon_color'] ?? '';

        if ( ! is_string( $color ) || $color === '' ) {
            return [];
        }

        return [
            '--fg-loader-color' => $color,
        ];
    }

    /**
     * Declares the loading-icon JS and CSS assets and schedules the footer
     * global for JS-built surfaces (lightbox spinner, AJAX album items).
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        // Accumulate distinct icon names; footer action reads this later.
        $icon_name = $this->resolve_icon_name( $render_context );
        self::$icon_names_seen[ $icon_name ] = true;

        $this->maybe_schedule_footer_global();

        return new Module_Assets(
            css: [
                'fotogrids-loading-icon' => new Asset_Decl(
                    path:      '../../assets/css/loading-icon-styles.css',
                    in_footer: false,
                ),
            ],
            js: [
                'fotogrids-loading-icon' => new Asset_Decl(
                    path:      '../../assets/js/loading-icon.js',
                    deps:      [],
                    in_footer: true,
                ),
            ]
        );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolves the icon name from settings, falling back to the default.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    private function resolve_icon_name( Render_Context $render_context ): string {
        $icon = $render_context->settings['loading_icon'] ?? '';
        return ( is_string( $icon ) && $icon !== '' ) ? $icon : self::DEFAULT_ICON;
    }

    /**
     * Builds JS that defines window.fotogridsLoadingIcons — a map of all icon
     * names used on this page, each with its svg template and WAAPI animate fn.
     *
     * Also sets window.fotogridsLoadingIcon to the first / default icon for
     * backwards compatibility with lightbox.js which reads that single-icon form.
     *
     * @since   1.0.0
     * @param   array<string, true> $icon_names_seen Distinct icon names to include.
     * @return  string Raw JS (no <script> tags).
     */
    private static function build_global_js( array $icon_names_seen ): string {
        $entries = [];
        $first   = null;

        foreach ( array_keys( $icon_names_seen ) as $icon_name ) {
            $svg        = fotogrids_get_loading_icon_svg( $icon_name, '' );
            $animate_fn = fotogrids_get_loading_icon_animate_fn( $icon_name );
            if ( $animate_fn === '' ) {
                $animate_fn = 'function animate(){return [];}';
            }

            $entries[] = sprintf(
                '%s:{svg:%s,animate:%s}',
                wp_json_encode( $icon_name ),
                wp_json_encode( $svg ),
                $animate_fn
            );

            if ( $first === null ) {
                $first = $icon_name;
            }
        }

        $map_js = 'window.fotogridsLoadingIcons={' . implode( ',', $entries ) . '};';

        // Keep window.fotogridsLoadingIcon pointing at the first icon for
        // lightbox.js and other callers that use the single-icon API.
        $default_js = '';
        if ( $first !== null ) {
            $svg        = fotogrids_get_loading_icon_svg( $first, '' );
            $animate_fn = fotogrids_get_loading_icon_animate_fn( $first );
            if ( $animate_fn === '' ) {
                $animate_fn = 'function animate(){return [];}';
            }
            $default_js = sprintf(
                'window.fotogridsLoadingIcon={name:%s,svg:%s,animate:%s};',
                wp_json_encode( $first ),
                wp_json_encode( $svg ),
                $animate_fn
            );
        }

        return $map_js . $default_js;
    }

    /**
     * Schedules the footer global + queue drainer via wp_add_inline_script.
     *
     * wp_add_inline_script bypasses the_content filters (wptexturize etc.) so
     * the full animate function — which contains &&, <, > — is emitted safely.
     *
     * The script:
     *  1. Defines window.fotogridsLoadingIcon = { name, svg, animate }.
     *  2. Drains window.fgAnimQueue: for each queued gallery instance ID,
     *     finds its loader SVGs and calls animate() on each, storing handles
     *     in window.fgLoaderHandles for loading-icon.js to cancel on load.
     *
     * The queue is populated by the tiny per-gallery inline scripts in
     * html_after() as the page body is parsed, so every gallery is processed
     * in order as soon as this footer script runs.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  void
     */
    private function maybe_schedule_footer_global(): void {
        if ( self::$footer_scheduled ) {
            return;
        }

        self::$footer_scheduled = true;

        // Drain JS: looks up each gallery's icon by data-fg-loading-icon,
        // finds the right animate fn in the per-icon map, and starts animations.
        $drain_js = '(function(){'
            . 'var icons=window.fotogridsLoadingIcons||{};'
            . 'var q=window.fgAnimQueue||[];'
            . 'if(!window.fgLoaderHandles)window.fgLoaderHandles=new WeakMap();'
            . 'for(var i=0;i<q.length;i++){'
            .   'var g=document.getElementById(q[i]);'
            .   'if(!g)continue;'
            .   'var iconName=g.getAttribute("data-fg-loading-icon")||"";'
            .   'var icon=icons[iconName]||icons[Object.keys(icons)[0]];'
            .   'if(!icon||typeof icon.animate!=="function")continue;'
            .   'g.querySelectorAll(".fg-item-loader svg").forEach(function(svg){'
            .     'var item=svg.closest(".fg-item");'
            .     'if(!item)return;'
            .     'try{'
            .       'var h=icon.animate(svg);'
            .       'window.fgLoaderHandles.set(item,Array.isArray(h)?h:[]);'
            .     '}catch(e){}'
            .   '});'
            . '}'
            . '})();';

        add_action(
            'wp_footer',
            static function () use ( $drain_js ): void {
                // Build global_js here, at footer time, after all galleries
                // have called assets() and populated $icon_names_seen.
                $global_js = self::build_global_js( self::$icon_names_seen );
                $inline    = $global_js . $drain_js;
                wp_add_inline_script( 'fotogrids-loading-icon', $inline, 'before' );
            },
            10
        );
    }

    /**
     * Resets per-request static state for tests.
     *
     * @since   1.0.0
     * @return  void
     */
    public static function reset_for_tests(): void {
        self::$footer_scheduled = false;
        self::$icon_names_seen  = [];
    }
}
