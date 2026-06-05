<?php
/**
 * Harvest permission definitions from the Tools registry.
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
 * Walks the Tools_Registry and registers a Permission_Definition for every
 * tool's `get_capability()`. New tools therefore appear in the Permissions
 * matrix automatically - no JSX edit, no PHP edit.
 *
 * If two tools declare the same capability, the first one wins and a debug
 * log line records the collision.
 *
 * @since 1.0.0
 */
final class Tool_Harvester {

    /**
     * Run the harvest. Called once from Permission_Registry::boot().
     */
    public static function harvest(): void {
        if ( ! class_exists( '\FotoGrids\Tools\Tools_Registry' ) ) {
            return;
        }

        $tools = \FotoGrids\Tools\Tools_Registry::get_all();
        foreach ( $tools as $entry ) {
            $tool = $entry['tool'] ?? null;
            if ( ! $tool || ! is_object( $tool ) ) {
                continue;
            }

            $cap = method_exists( $tool, 'get_capability' ) ? (string) $tool->get_capability() : 'manage_fotogrids';
            if ( $cap === '' || $cap === 'manage_fotogrids' ) {
                // Tools that don't declare a custom cap are folded under the
                // master 'manage_fotogrids' which Core_Permissions already
                // registered. Nothing to add here.
                continue;
            }

            if ( Permission_Registry::get( $cap ) !== null ) {
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log( sprintf(
                        'FotoGrids Permissions: tool "%s" duplicates already-registered capability "%s" - skipping.',
                        $tool->get_id(),
                        $cap
                    ) );
                }
                continue;
            }

            $tier        = method_exists( $tool, 'get_tier_required' ) ? (string) $tool->get_tier_required() : 'free';
            $label       = method_exists( $tool, 'get_name' ) ? (string) $tool->get_name() : $cap;
            $description = method_exists( $tool, 'get_description' )
                ? (string) $tool->get_description()
                : sprintf( /* translators: %s: tool name */ __( 'Access the %s tool.', 'fotogrids' ), $label );

            Permission_Registry::register( new Permission_Definition( [
                'key'                 => $cap,
                'label'               => $label,
                'description'         => $description,
                'group'               => 'tools',
                'panel'               => 'advanced',
                'default_lowest_role' => 'administrator',
                'tier'                => $tier,
            ] ) );
        }
    }
}
