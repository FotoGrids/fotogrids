<?php
/**
 * Modules REST - manifest endpoint.
 *
 * @package FotoGrids\Modules
 * @since   1.0.0
 */

namespace FotoGrids\Modules;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Registers GET /fotogrids/v1/admin/modules, returning the manifest of all
 * modules the current user can access.
 *
 * Each entry carries a pre-computed access_state ('editable' / 'teaser' /
 * 'locked') resolved from the module's tier_required and the current user's
 * license - the same vocabulary the Tools manifest and collection-settings
 * catalog use. This lets the admin UI, docs tooling, and launch dashboard
 * read feature inventory from one source of truth.
 *
 * @since 1.0.0
 */
class Modules_Rest {

    /**
     * Hook route registration onto rest_api_init.
     *
     * @since 1.0.0
     * @return void
     */
    public static function init(): void {
        add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
    }

    /**
     * Register REST routes.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register_routes(): void {
        register_rest_route(
            'fotogrids/v1',
            '/admin/modules',
            [
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'get_manifest' ],
                'permission_callback' => [ __CLASS__, 'check_permission' ],
            ]
        );
    }

    /**
     * Permission: any user who can manage FotoGrids. Individual module
     * visibility is filtered inside the manifest builder by capability.
     *
     * @since 1.0.0
     * @return bool
     */
    public static function check_permission(): bool {
        return current_user_can( 'manage_fotogrids' );
    }

    /**
     * Return the module manifest for the current user.
     *
     * @since 1.0.0
     * @return \WP_REST_Response
     */
    public static function get_manifest(): \WP_REST_Response {
        return new \WP_REST_Response( Module_Registry::get_manifest_for_user(), 200 );
    }
}
