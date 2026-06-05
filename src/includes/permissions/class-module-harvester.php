<?php
/**
 * Harvest permission definitions from the Module registry.
 *
 * @package FotoGrids\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Permissions;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Walks the Module_Registry and registers a Permission_Definition for every
 * module's `get_capability()`. Same shape as Tool_Harvester.
 *
 * @since 1.0.0
 */
final class Module_Harvester {

    /**
     * Run the harvest. Called once from Permission_Registry::boot().
     */
    public static function harvest(): void {
        if ( ! class_exists( '\FotoGrids\Modules\Module_Registry' ) ) {
            return;
        }

        $modules = \FotoGrids\Modules\Module_Registry::get_all();
        foreach ( $modules as $entry ) {
            $module = $entry['module'] ?? null;
            if ( ! $module || ! is_object( $module ) ) {
                continue;
            }

            $cap = method_exists( $module, 'get_capability' ) ? (string) $module->get_capability() : 'manage_fotogrids';
            if ( $cap === '' || $cap === 'manage_fotogrids' ) {
                continue;
            }

            if ( Permission_Registry::get( $cap ) !== null ) {
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log( sprintf(
                        'FotoGrids Permissions: module "%s" duplicates already-registered capability "%s" - skipping.',
                        $module->get_id(),
                        $cap
                    ) );
                }
                continue;
            }

            $tier        = method_exists( $module, 'get_tier_required' ) ? (string) $module->get_tier_required() : 'free';
            $label       = method_exists( $module, 'get_name' ) ? (string) $module->get_name() : $cap;
            $description = method_exists( $module, 'get_description' )
                ? (string) $module->get_description()
                : sprintf( /* translators: %s: module name */ __( 'Access the %s module.', 'fotogrids' ), $label );

            Permission_Registry::register( new Permission_Definition( [
                'key'                 => $cap,
                'label'               => $label,
                'description'         => $description,
                'group'               => 'modules',
                'panel'               => 'advanced',
                'default_lowest_role' => 'administrator',
                'tier'                => $tier,
            ] ) );
        }
    }
}
