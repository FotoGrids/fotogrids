<?php
/**
 * Render-pipeline action hooks.
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
 * Render action hooks.
 */
final class Actions_Render {

    /**
     * Fires once during plugin boot so render modules can register
     * themselves with the Module_Registry.
     *
     * @since 1.0.0
     */
    public const REGISTER_MODULES = 'fotogrids/render/register_modules';

    /**
     * Fires after a render completes, used to flush late assets that would
     * normally land in `wp_footer` (admin preview, REST renders).
     *
     * @since 1.0.0
     * @param \FotoGrids\Render\Api\Render_Context $render Render context.
     */
    public const LATE_ASSETS = 'fotogrids/render/late_assets';
}
