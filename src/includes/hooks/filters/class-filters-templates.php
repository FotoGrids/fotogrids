<?php
/**
 * Templates-module filter hooks.
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
 * Templates filter hooks.
 */
final class Filters_Templates {

    /**
     * Component ID of the "Save as Template" metabox button.
     *
     * Pro returns its component ID here; Free leaves it null and the shell
     * renders the upgrade CTA.
     *
     * @since 1.0.0
     * @param string|null $component_id Component ID or null.
     * @param \WP_Post    $post         Current post.
     */
    public const SAVE_AS_TEMPLATE_BUTTON = 'fotogrids/templates/save_as_template_button';
}
