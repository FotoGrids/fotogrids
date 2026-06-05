<?php
/**
 * Shared page-builder preview-toggle helper.
 *
 * @package FotoGrids\Modules\PageBuilders
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Single source of truth for the two editor-only preview toggles every
 * page-builder host exposes:
 *
 *   - `click_behavior` — when false, item click handlers are
 *     neutralised in the editor preview (so users can keep clicking
 *     items to select the widget instead of triggering the lightbox
 *     or a real link). Default: `false`.
 *   - `pagination` — when false, pagination chrome still renders so
 *     the layout matches the published page, but the host swallows
 *     pagination-button clicks via a capture-phase listener so all
 *     items remain visible during editing. Default: `false`.
 *
 * Both attributes are persisted by each builder under the same name
 * (no-camelCase / no-host-specific-prefix) so users see identical UI
 * affordances across Gutenberg, Elementor, Divi, Bricks, etc. The
 * attribute names exposed here are the canonical form; if a host's
 * native serialisation requires camelCase (e.g. Gutenberg's
 * `block.json`) the host is responsible for the local conversion.
 *
 * Default change history: pagination flipped from `true` to `false` on
 * 2026-06-04 because in practice users want to see all items while
 * editing — pagination chrome that hides items behind a "next" button
 * makes it harder to verify the gallery's contents at a glance.
 *
 * @since 1.0.0
 */
final class Preview_Options {

    /**
     * Canonical attribute key for the click-behavior toggle.
     *
     * @var string
     */
    public const ATTR_CLICK_BEHAVIOR = 'preview_click_behavior';

    /**
     * Canonical attribute key for the pagination toggle.
     *
     * @var string
     */
    public const ATTR_PAGINATION = 'preview_pagination';

    /**
     * Default values for new widgets / blocks.
     *
     * @since 1.0.0
     * @return array{preview_click_behavior: bool, preview_pagination: bool}
     */
    public static function defaults(): array {
        return [
            self::ATTR_CLICK_BEHAVIOR => false,
            self::ATTR_PAGINATION     => false,
        ];
    }

    /**
     * Normalise an arbitrary host-supplied input map into the canonical
     * `{click_behavior, pagination}` shape consumed by the REST
     * `/preview/{kind}/{id}` endpoint and the in-process preview
     * renderer.
     *
     * Accepts either canonical keys (`preview_click_behavior`,
     * `preview_pagination`) or the shorthand REST keys
     * (`click_behavior`, `pagination`). Missing keys take the helper's
     * default. Non-boolean inputs are coerced via PHP truthiness so an
     * Elementor switcher's `'yes'`/`''` string values work without per-
     * host normalisation.
     *
     * @since 1.0.0
     * @param array<string, mixed> $input Raw host-supplied values.
     * @return array{click_behavior: bool, pagination: bool}
     */
    public static function normalise( array $input ): array {
        $defaults = self::defaults();

        $click = $input[ self::ATTR_CLICK_BEHAVIOR ] ?? $input['click_behavior'] ?? $defaults[ self::ATTR_CLICK_BEHAVIOR ];
        $pag   = $input[ self::ATTR_PAGINATION ]     ?? $input['pagination']     ?? $defaults[ self::ATTR_PAGINATION ];

        return [
            'click_behavior' => (bool) $click,
            'pagination'     => (bool) $pag,
        ];
    }
}
