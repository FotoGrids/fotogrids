<?php
namespace FotoGrids\REST\Maintenance;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Registers the Maintenance REST routes under fotogrids/v1/admin/maintenance.
 *
 * Three endpoints, all gated on `manage_fotogrids`:
 *  - POST   /admin/maintenance/reset-options
 *  - POST   /admin/maintenance/reinstall-tables
 *  - GET    /admin/maintenance/debug-channels
 *  - POST   /admin/maintenance/debug-channels
 *
 * @since 1.0.0
 */
class Register_Maintenance_Routes {

    /**
     * Register all Maintenance routes. Called from
     * \FotoGrids\REST::register_routes() on rest_api_init.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register(): void {
        register_rest_route(
            'fotogrids/v1',
            '/admin/maintenance/reset-options',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( '\FotoGrids\REST\Maintenance\Maintenance_Data', 'reset_options' ),
                    'permission_callback' => array( '\FotoGrids\REST\Maintenance\Maintenance_Permissions', 'check_manage_fotogrids' ),
                ),
            )
        );

        register_rest_route(
            'fotogrids/v1',
            '/admin/maintenance/reinstall-tables',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( '\FotoGrids\REST\Maintenance\Maintenance_Data', 'reinstall_tables' ),
                    'permission_callback' => array( '\FotoGrids\REST\Maintenance\Maintenance_Permissions', 'check_manage_fotogrids' ),
                ),
            )
        );

        register_rest_route(
            'fotogrids/v1',
            '/admin/maintenance/debug-channels',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( '\FotoGrids\REST\Maintenance\Maintenance_Data', 'get_debug_channels' ),
                    'permission_callback' => array( '\FotoGrids\REST\Maintenance\Maintenance_Permissions', 'check_manage_fotogrids' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( '\FotoGrids\REST\Maintenance\Maintenance_Data', 'save_debug_channels' ),
                    'permission_callback' => array( '\FotoGrids\REST\Maintenance\Maintenance_Permissions', 'check_manage_fotogrids' ),
                    'args'                => array(
                        'channels' => array(
                            'required' => false,
                            'default'  => array(),
                            'sanitize_callback' => function ( $value ) {
                                if ( ! is_array( $value ) ) {
                                    return array();
                                }
                                return array_values( array_map( 'sanitize_key', $value ) );
                            },
                        ),
                    ),
                ),
            )
        );
    }
}
