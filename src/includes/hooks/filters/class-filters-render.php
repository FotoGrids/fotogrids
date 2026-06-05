<?php
/**
 * Render-pipeline filter hooks (non-variant; the flat/typed/scoped variants
 * dispatched through {@see \FotoGrids\Render\Internal\Hooks} are not declared
 * here — see that helper for the suffix list).
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Render filter hooks.
 */
final class Filters_Render {

    /**
     * Resolved breakpoint config used by the render pipeline.
     *
     * @since 1.0.0
     * @param array $config Breakpoint config.
     */
    public const BREAKPOINT_CONFIG = 'fotogrids/render/breakpoint_config';

    /**
     * Resolved font family used for a render.
     *
     * @since 1.0.0
     * @param string                               $filtered   Default empty.
     * @param string                               $normalized Normalised request value.
     * @param \FotoGrids\Render\Api\Render_Context $render     Render context.
     */
    public const FONT_RESOLVE_FAMILY = 'fotogrids/render/font/resolve_family';

    /**
     * Resolved font weight used for a render.
     *
     * @since 1.0.0
     * @param string                               $filtered   Default empty.
     * @param string                               $normalized Normalised request value.
     * @param \FotoGrids\Render\Api\Render_Context $render     Render context.
     */
    public const FONT_RESOLVE_WEIGHT = 'fotogrids/render/font/resolve_weight';

    /**
     * Assumed viewport width used by the Justified layout snap resolver when
     * the real viewport width is unavailable server-side.
     *
     * @since 1.0.0
     * @param array $resolved Assumed-width map.
     */
    public const JUSTIFIED_ASSUMED_WIDTH = 'fotogrids/render/justified/assumed_width';

    /**
     * Layout capability map merged with the layout's own self-declared map.
     *
     * @since 1.0.0
     * @param array<string,bool>                   $capabilities Capability map.
     * @param string                               $layout_slug  Layout slug.
     * @param \FotoGrids\Render\Api\Render_Context $render       Render context.
     */
    public const LAYOUT_CAPABILITIES = 'fotogrids/render/layout/capabilities';

    /**
     * Wrapper-composition adapters for a layout.
     *
     * @since 1.0.0
     * @param array $adapters Adapter map.
     */
    public const LAYOUT_ADAPTERS = 'fotogrids/render/layout/adapters';

    /**
     * CSS custom properties contributed by a layout's wrapper.
     *
     * @since 1.0.0
     * @param array $style_vars Style variable map.
     */
    public const LAYOUT_STYLE_VARS = 'fotogrids/render/layout/style_vars';

    /**
     * `data-fg-*` wrapper attributes contributed by a layout's wrapper.
     *
     * @since 1.0.0
     * @param array $wrapper_data_attrs Attribute map.
     */
    public const LAYOUT_WRAPPER_ATTRS = 'fotogrids/render/layout/wrapper_attrs';

    /**
     * Final `<script>` HTML output for the custom-JS feature.
     *
     * @since 1.0.0
     * @param string                               $script_html    Script HTML.
     * @param \FotoGrids\Render\Api\Render_Context $render_context Render context.
     */
    public const CUSTOM_JS_OUTPUT = 'fotogrids/render/custom_js/output';

    /**
     * Sanitised custom-JS string before output.
     *
     * @since 1.0.0
     * @param string                               $sanitized      Sanitised JS.
     * @param string                               $raw            Raw JS as saved.
     * @param \FotoGrids\Render\Api\Render_Context $render_context Render context.
     */
    public const CUSTOM_JS_SANITIZE = 'fotogrids/render/custom_js/sanitize';

    /**
     * HTML attribute map for every `<a>` an item-wrapping decorator emits
     * (Lightbox, Direct_Link, External_Link, Album_To_View_Page,
     * Album_To_Gallery_Ajax). Lets host environments (page-builder
     * sub-modules, themes) inject or remove attributes — e.g. to suppress
     * a host builder's global lightbox that would otherwise hijack clicks
     * on our anchors — without the renderer needing to know which host is
     * mounting it. Dispatched through {@see \FotoGrids\Render\Internal\Hooks::apply_filter}
     * so flat/typed/scoped variants are available; call sites pass the
     * {@see ANCHOR_ATTRS_SUFFIX} bare suffix.
     *
     * @since 1.0.0
     * @param array<string,string>                 $attrs  Anchor attribute map.
     * @param \FotoGrids\Render\Api\Render_Context $render Render context.
     */
    public const ANCHOR_ATTRS = 'fotogrids/render/anchor_attrs';

    /**
     * Bare-suffix form of {@see ANCHOR_ATTRS} for passing to
     * {@see \FotoGrids\Render\Internal\Hooks::apply_filter}, which
     * prepends `fotogrids/render/` itself when fanning out variants.
     *
     * @since 1.0.0
     */
    public const ANCHOR_ATTRS_SUFFIX = 'anchor_attrs';

    /**
     * Whether the renderer should inline-print its enqueued CSS and JS
     * handles immediately after registering them, instead of trusting
     * `wp_head` / `wp_footer` to do it.
     *
     * Default is `true` when WordPress has already passed `wp_head` /
     * `admin_head` at flush time (the classic "shortcode rendered inside
     * the_content after wp_head") — in that case the styles need to be
     * inlined or they'd never appear. Hosts that render galleries outside
     * the normal page lifecycle (page-builder editor previews, custom
     * REST/AJAX surfaces that emit HTML without `wp_footer`) hook this
     * filter to return `true` unconditionally so the renderer always
     * emits its assets inline.
     *
     * @since 1.0.0
     * @param bool $should_inline Resolved value (default derived from
     *                            `did_action('wp_head')` / `did_action('admin_head')`).
     */
    public const SHOULD_INLINE_ASSETS = 'fotogrids/render/should_inline_assets';
}
