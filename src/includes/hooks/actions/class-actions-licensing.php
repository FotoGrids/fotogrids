<?php
/**
 * Licensing-provider action hooks.
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
 * Licensing action hooks.
 */
final class Actions_Licensing {

    /**
     * Fires after the Freemius bootstrap loads its singleton instance.
     *
     * @since 1.0.0
     * @param \FotoGrids\Licensing\Freemius_Bootstrap $instance Bootstrap instance.
     */
    public const FREEMIUS_LOADED = 'fotogrids/licensing/freemius_loaded';
}
