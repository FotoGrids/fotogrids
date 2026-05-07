<?php
namespace FotoGrids\Modules;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Module Loader
 *
 * Loads and initializes FotoGrids modules from the explicit registry.
 * No file discovery; all modules are registered in config/modules.php.
 *
 * @since 1.0.0
 */
class ModuleLoader {

    /**
     * Loaded module instances.
     *
     * @var ModuleInterface[]
     */
    private array $modules = [];

    /**
     * Initialize the loader and bootstrap all registered modules.
     */
    public function init(): void {
        $registry = $this->get_registry();

        foreach ( $registry as $module_class ) {
            if ( ! is_string( $module_class ) ) {
                continue;
            }
            if ( ! class_exists( $module_class ) ) {
                $this->load_module_file( $module_class );
            }
            if ( ! is_subclass_of( $module_class, ModuleInterface::class ) ) {
                continue;
            }

            $module = new $module_class();

            if ( ! $module->is_active() ) {
                continue;
            }

            if ( ! $this->dependencies_met( $module ) ) {
                continue;
            }

            $this->modules[ $module->get_id() ] = $module;
            $module->init();
        }
    }

    /**
     * Get the module registry from config.
     *
     * @return string[] Array of module class names.
     */
    private function get_registry(): array {
        $config_path = FOTOGRIDS_PLUGIN_DIR . 'config/modules.php';

        if ( ! file_exists( $config_path ) ) {
            return [];
        }

        $registry = require $config_path;

        return is_array( $registry ) ? $registry : [];
    }

    /**
     * Check whether all dependencies of a module are loaded.
     *
     * @param ModuleInterface $module Module to check.
     * @return bool True if all dependencies are satisfied.
     */
    private function dependencies_met( ModuleInterface $module ): bool {
        $deps = $module->get_dependencies();

        foreach ( $deps as $dep_id ) {
            if ( ! isset( $this->modules[ $dep_id ] ) ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Load module file from class name (PSR-4 style under includes/modules/).
     *
     * @param string $class_name Fully qualified class name.
     */
    private function load_module_file( string $class_name ): void {
        if ( ! is_string( $class_name ) || strpos( $class_name, 'FotoGrids\\Modules\\' ) !== 0 ) {
            return;
        }

        $relative = str_replace( 'FotoGrids\\Modules\\', '', $class_name );
        $relative = str_replace( '\\', '/', $relative ) . '.php';
        $path     = FOTOGRIDS_PLUGIN_DIR . 'includes/modules/' . $relative;

        if ( file_exists( $path ) ) {
            require_once $path;
        }
    }

    /**
     * Get a loaded module by ID.
     *
     * @param string $id Module ID.
     * @return ModuleInterface|null Module instance or null.
     */
    public function get_module( string $id ): ?ModuleInterface {
        return $this->modules[ $id ] ?? null;
    }

    /**
     * Get all loaded modules.
     *
     * @return ModuleInterface[]
     */
    public function get_modules(): array {
        return $this->modules;
    }
}
