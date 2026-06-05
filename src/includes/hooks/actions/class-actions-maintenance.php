<?php
/**
 * Maintenance-tool action hooks.
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
 * Maintenance action hooks.
 */
final class Actions_Maintenance {

    /**
     * Fires after plugin options are reset by the maintenance tool.
     *
     * @since 1.0.0
     * @param string[] $resettable Option keys that were reset.
     * @param string[] $preserved  Option keys that were preserved.
     */
    public const OPTIONS_RESET = 'fotogrids/maintenance/options_reset';

    /**
     * Fires after FotoGrids custom tables are reinstalled.
     *
     * @since 1.0.0
     */
    public const TABLES_REINSTALLED = 'fotogrids/maintenance/tables_reinstalled';
}
