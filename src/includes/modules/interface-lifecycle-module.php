<?php
/**
 * Lifecycle module interface.
 *
 * @package FotoGrids\Modules
 * @since   1.0.0
 */

namespace FotoGrids\Modules;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Optional contract for modules that own persistent state (custom tables,
 * options, scheduled events) and need to participate in the plugin's
 * activation / deactivation / uninstall lifecycle.
 *
 * The activator iterates registered modules implementing this interface
 * instead of hard-coding every table, so a (Pro) module can ship its own
 * table creation and cleanup with the feature rather than editing the core
 * activator. Modules that need none of this simply do not implement it.
 *
 * @since 1.0.0
 */
interface Lifecycle_Module_Interface extends Module_Interface {

    /**
     * Run on plugin activation: create tables, seed options, schedule events.
     *
     * Must be idempotent - activation can run more than once.
     *
     * @since 1.0.0
     * @return void
     */
    public function on_activate(): void;

    /**
     * Run on plugin deactivation: clear scheduled events. Do NOT drop data
     * here - deactivation is reversible.
     *
     * @since 1.0.0
     * @return void
     */
    public function on_deactivate(): void;

    /**
     * Run on plugin uninstall: drop tables and delete options the module owns.
     *
     * @since 1.0.0
     * @return void
     */
    public function on_uninstall(): void;
}
