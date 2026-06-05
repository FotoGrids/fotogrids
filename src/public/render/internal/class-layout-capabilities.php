<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Hooks\Filters_Render;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Helper around the active layout's capabilities() map.
 *
 * Cross-cutting features (pagination chrome, Filter_Ui, etc.) ask "does
 * the active layout support this capability?" via this helper instead of
 * hardcoding layout-ID lists. The helper:
 *
 *   - Resolves the active layout via Module_Registry::active_modules().
 *   - Reads the layout's capabilities() map.
 *   - Treats missing keys as TRUE (permissive default — layouts that
 *     return [] opt into every capability, which is what Grid / Masonry
 *     / Justified want).
 *
 * Adding a new capability is a four-step process: document the key in
 * the Layout interface phpdoc, return it from the layouts that opt out,
 * call `Layout_Capabilities::supports($ctx, 'your_key')` from the
 * consumer, and (optionally) expose it through a filter hook.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Layout_Capabilities {

    /**
     * Does the active layout support the named capability?
     *
     * Returns true if no layout is active (defensive default — keeps the
     * pipeline behaving the same way it did before capabilities existed).
     *
     * @since   1.0.0
     * @param   Render_Context $render_context
     * @param   string         $capability_key Known keys: 'paginates', 'filters'.
     * @return  bool
     */
    public static function supports( Render_Context $render_context, string $capability_key ): bool {
        $active_layout = self::active_layout( $render_context );
        if ( $active_layout === null ) {
            return true;
        }

        $capabilities = self::resolve_capabilities( $active_layout, $render_context );

        // Permissive default: a layout that doesn't mention a capability
        // gets to keep doing it. Only an explicit false opts out.
        return ( $capabilities[ $capability_key ] ?? true ) !== false;
    }

    /**
     * Returns the resolved capabilities map for an explicitly-known
     * layout module (skips Module_Registry lookup — used by the wrapper
     * composer which has already selected the active layout).
     *
     * Applies the `fotogrids/render/layout/capabilities` filter so the
     * caller sees the same map third-party callbacks see.
     *
     * @since   1.0.0
     * @param   Layout         $layout
     * @param   Render_Context $render_context
     * @return  array<string, bool>
     */
    public static function for_layout( Layout $layout, Render_Context $render_context ): array {
        return self::resolve_capabilities( $layout, $render_context );
    }

    /**
     * Is a specific capability flagged on for the explicitly-given layout?
     *
     * Mirrors the default rules from supports(): missing key = true.
     *
     * @since   1.0.0
     * @param   Layout         $layout
     * @param   Render_Context $render_context
     * @param   string         $capability_key
     * @return  bool
     */
    public static function layout_supports( Layout $layout, Render_Context $render_context, string $capability_key ): bool {
        $capabilities = self::resolve_capabilities( $layout, $render_context );
        return ( $capabilities[ $capability_key ] ?? true ) !== false;
    }

    /**
     * Resolves the active layout's capability map for this render and
     * applies the `fotogrids/render/layout/capabilities` filter so Pro
     * and third-party plugins can override a layout's capabilities
     * without subclassing it.
     *
     * Filter contract:
     *   apply_filters(
     *       'fotogrids/render/layout/capabilities',
     *       array<string, bool> $capabilities,   // The layout's own map.
     *       string              $layout_id,       // e.g. 'fotogrids/grid'.
     *       Render_Context      $render_context,
     *       Layout              $layout           // The layout module.
     *   ): array<string, bool>
     *
     * Callbacks must return an array; a non-array return value is
     * discarded and the original layout map is used (defensive — we
     * never want a misbehaving hook to silently break pagination).
     *
     * @since   1.0.0
     * @param   Layout         $layout
     * @param   Render_Context $render_context
     * @return  array<string, bool>
     */
    private static function resolve_capabilities( Layout $layout, Render_Context $render_context ): array {
        $capabilities = $layout->capabilities();

        /**
         * Filter the active layout's capability map.
         *
         * @since 1.0.0
         * @param array<string, bool> $capabilities
         * @param string              $layout_id
         * @param Render_Context      $render_context
         * @param Layout              $layout
         */
        $filtered = apply_filters(
            Filters_Render::LAYOUT_CAPABILITIES,
            $capabilities,
            $layout->id(),
            $render_context,
            $layout
        );

        return is_array( $filtered ) ? $filtered : $capabilities;
    }

    /**
     * Resolves the active layout module for this render context.
     *
     * `Module_Registry::active_modules('layouts', $ctx)` returns layouts
     * sorted by origin precedence + registration index. Only one is
     * actually rendered (Render_Controller picks the first), so reading
     * `[0]` here matches the rendering behavior.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context
     * @return  Layout|null
     */
    private static function active_layout( Render_Context $render_context ): ?Layout {
        $layouts = Module_Registry::active_modules( 'layouts', $render_context );
        $first   = $layouts[0] ?? null;

        return $first instanceof Layout ? $first : null;
    }
}
