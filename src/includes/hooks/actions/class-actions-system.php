<?php
/**
 * System lifecycle, module-loader, and tool-registry action hooks.
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
 * Plugin-level action hooks.
 */
final class Actions_System {

    /**
     * Fires once after FotoGrids tables and default options have been created.
     *
     * @since 1.0.0
     */
    public const ACTIVATE = 'fotogrids/system/activate';

    /**
     * Fires during module registration. Module providers (incl. Pro) hook
     * here to register their module classes with the loader.
     *
     * @since 1.0.0
     */
    public const MODULES_REGISTER = 'fotogrids/modules/register';

    /**
     * Fires during tool registration. Tool providers hook here to register
     * their Tool classes with the tools registry.
     *
     * @since 1.0.0
     */
    public const TOOLS_INIT = 'fotogrids/tools/init';
}
