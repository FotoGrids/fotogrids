<?php
/**
 * Abstract module base.
 *
 * @package FotoGrids\Modules
 * @since   1.0.0
 */

namespace FotoGrids\Modules;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Provides sensible defaults for Module_Interface so concrete modules only
 * implement the methods that differ - typically get_id(), get_name(), and
 * init(). Mirrors the ergonomics of Abstract_Tool.
 *
 * @since 1.0.0
 */
abstract class Abstract_Module implements Module_Interface {

    /**
     * {@inheritdoc}
     */
    public function get_description(): string {
        return '';
    }

    /**
     * {@inheritdoc}
     */
    public function get_tier_required(): string {
        return 'free';
    }

    /**
     * {@inheritdoc}
     */
    public function get_capability(): string {
        return 'manage_fotogrids';
    }

    /**
     * {@inheritdoc}
     *
     * Defaults to the three runtime contexts. Override to narrow - e.g. an
     * admin-only module returns [ 'admin' ].
     */
    public function get_contexts(): array {
        return [ 'admin', 'frontend', 'rest' ];
    }

    /**
     * {@inheritdoc}
     */
    public function get_dependencies(): array {
        return [];
    }

    /**
     * {@inheritdoc}
     */
    public function is_active(): bool {
        return true;
    }

    /**
     * {@inheritdoc}
     *
     * No-op by default. Override in modules that surface admin UI to guard the
     * relevant screen(s) and enqueue their co-located assets. Modules with no
     * admin assets (frontend-only, REST-only) leave this as-is.
     */
    public function enqueue_assets( string $hook ): void {
        // No-op. Override in concrete modules that have admin assets.
    }

    /**
     * Build an absolute URL to a built asset inside this module's folder.
     *
     * Convenience for concrete modules. Given a class in
     * FotoGrids\Modules\<Name>\... and a relative path, returns
     * FOTOGRIDS_PLUGIN_URL . 'includes/modules/<Name>/' . $relative for Free
     * modules, or the Pro plugin URL for Pro modules. Mirrors how Tools point
     * get_script_url() at their co-located assets.
     *
     * @since 1.0.0
     * @param string $relative Path relative to the module folder, e.g.
     *                         'assets/templates-metabox.js'.
     * @return string Absolute URL.
     */
    protected function module_asset_url( string $relative ): string {
        $class = static::class;

        // Pro modules live under the Pro plugin; resolve against its URL.
        if ( str_starts_with( $class, 'FotoGrids_Pro\\Modules\\' ) && defined( 'FOTOGRIDS_PRO_PLUGIN_URL' ) ) {
            $name = $this->module_dir_from_class( $class, 'FotoGrids_Pro\\Modules\\' );
            return FOTOGRIDS_PRO_PLUGIN_URL . 'modules/' . $name . '/' . ltrim( $relative, '/' );
        }

        $name = $this->module_dir_from_class( $class, 'FotoGrids\\Modules\\' );
        return FOTOGRIDS_PLUGIN_URL . 'includes/modules/' . $name . '/' . ltrim( $relative, '/' );
    }

    /**
     * Extract the module directory name (the segment after the namespace
     * prefix, before the class) from a fully-qualified class name.
     *
     * @since 1.0.0
     * @param string $class  Fully-qualified class name.
     * @param string $prefix Namespace prefix to strip.
     * @return string Module directory name, e.g. 'Templates'.
     */
    private function module_dir_from_class( string $class, string $prefix ): string {
        $rest  = substr( $class, strlen( $prefix ) );
        $parts = explode( '\\', $rest );
        return $parts[0] ?? '';
    }

    /**
     * {@inheritdoc}
     *
     * No-op by default. Override to register hooks, REST routes, cron, assets.
     */
    public function init(): void {
        // No-op. Override in concrete modules.
    }
}
