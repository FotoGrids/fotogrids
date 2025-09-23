<?php
namespace FotoGrids\REST\Album;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Album REST Routes Registration
 *
 * Handles registration of all album-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Album_Routes {
    
    /**
     * Register all album-related REST API routes
     *
     * Registers endpoints for album data retrieval for both public and admin use.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Single album endpoint
        register_rest_route( 'fotogrids/v1', '/album/(?P<id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Album\Album_Data', 'get_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Album\Album_Permissions', 'check_album_read' ),
            ),
        ) );
    }
}
