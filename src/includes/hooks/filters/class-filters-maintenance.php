<?php
/**
 * Maintenance-tool filter hooks.
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
 * Maintenance filter hooks.
 */
final class Filters_Maintenance {

    /**
     * Option keys preserved through an options reset.
     *
     * @since 1.0.0
     * @param string[] $defaults Preserved keys.
     */
    public const RESET_OPTIONS_PRESERVE_KEYS = 'fotogrids/maintenance/reset_options/preserve_keys';
}
