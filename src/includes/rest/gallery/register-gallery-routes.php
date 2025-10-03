<?php
namespace FotoGrids\REST\Gallery;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Gallery REST Routes Registration
 *
 * Handles registration of all gallery-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Gallery_Routes {
    
    /**
     * Register all gallery-related REST API routes
     *
     * Registers endpoints for gallery data retrieval, gallery listing,
     * and gallery item endpoints for both public and admin use.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Single gallery endpoint
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'preview' => array(
                        'default' => false,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
            ),
        ) );

        // Galleries list endpoint (for Gutenberg block)
        register_rest_route( 'fotogrids/v1', '/galleries', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_galleries_list' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
                'args' => array(
                    'per_page' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                    'page' => array(
                        'default' => 1,
                        'sanitize_callback' => 'absint',
                    ),
                    'search' => array(
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
        ) );

        // Gallery items endpoint (for Gutenberg block)
        register_rest_route( 'fotogrids/v1', '/galleries/(?P<id>\d+)/items', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_gallery_items_endpoint' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'limit' => array(
                        'default' => -1,
                        'sanitize_callback' => 'absint',
                    ),
                    'offset' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ) );
    }
}
