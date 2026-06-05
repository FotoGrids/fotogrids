<?php
/**
 * Feature-gate filter hooks (Pro / layouts / custom JS).
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
 * Feature filter hooks.
 */
final class Filters_Features {

    /**
     * Per-feature gate: can a given Pro feature be used?
     *
     * @since 1.0.0
     * @param bool   $can_use      Default false in Free.
     * @param string $feature_name Feature identifier.
     */
    public const PRO_CAN_USE = 'fotogrids/features/pro/can_use';

    /**
     * Master "Pro is active" toggle.
     *
     * @since 1.0.0
     * @param bool $is_pro Default false in Free.
     */
    public const PRO_IS_ACTIVE = 'fotogrids/features/pro/is_active';

    /**
     * The list of layout modules available to galleries.
     *
     * Pro hooks here to register premium layouts (Carousel etc.).
     *
     * @since 1.0.0
     * @param array $layouts Layout slug => meta map.
     */
    public const LAYOUTS_AVAILABLE = 'fotogrids/features/layouts/available';

    /**
     * Master toggle for dynamic execution of user-supplied custom JS.
     *
     * @since 1.0.0
     * @param bool                                 $setting_value Default from settings.
     * @param \FotoGrids\Render\Api\Render_Context $render_context Render context.
     */
    public const CUSTOM_JS_ALLOW_DYNAMIC = 'fotogrids/features/custom_js/allow_dynamic_execution';
}
