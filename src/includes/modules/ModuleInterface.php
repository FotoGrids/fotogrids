<?php
namespace FotoGrids\Modules;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Module Interface
 *
 * All FotoGrids modules must implement this interface.
 * Modules are coarse-grained units that organize functionality;
 * they may wrap existing code and delegate to legacy classes.
 *
 * @since 1.0.0
 */
interface ModuleInterface {

    /**
     * Get unique module identifier.
     *
     * @return string Unique ID (e.g. 'metaboxes', 'templates').
     */
    public function get_id(): string;

    /**
     * Get human-readable module name.
     *
     * @return string Display name.
     */
    public function get_name(): string;

    /**
     * Check whether the module should be active.
     *
     * @return bool True if the module should run.
     */
    public function is_active(): bool;

    /**
     * Initialize the module. Register hooks, enqueue assets, etc.
     */
    public function init(): void;

    /**
     * Get IDs of modules this module depends on.
     *
     * @return string[] Module IDs.
     */
    public function get_dependencies(): array;
}
