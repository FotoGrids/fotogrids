<?php
/**
 * SEO-settings filter hooks.
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
 * SEO filter hooks.
 */
final class Filters_Seo {

    /**
     * Default SEO settings.
     *
     * @since 1.0.0
     * @param array $defaults Default settings array.
     */
    public const DEFAULTS = 'fotogrids/seo/defaults';

    /**
     * Resolved SEO settings (defaults + saved options).
     *
     * @since 1.0.0
     * @param array $settings Resolved settings.
     */
    public const SETTINGS = 'fotogrids/seo/settings';

    /**
     * Sanitised SEO settings input.
     *
     * @since 1.0.0
     * @param array $sanitized Sanitised input.
     * @param array $input     Raw input.
     */
    public const SANITIZE = 'fotogrids/seo/sanitize';

    /**
     * Resolved SEO settings for a given collection.
     *
     * @since 1.0.0
     * @param array $resolved      Resolved settings.
     * @param int   $collection_id Collection ID.
     */
    public const RESOLVED = 'fotogrids/seo/resolved';
}
