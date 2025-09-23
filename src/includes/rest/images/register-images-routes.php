<?php
namespace FotoGrids\REST\Images;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Images REST Routes Registration
 *
 * Handles registration of image-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Images_Routes {
    
    /**
     * Register all image-related REST API routes
     *
     * Registers endpoints for image querying and filtering.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Images query endpoint
        register_rest_route( 'fotogrids/v1', '/images', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Images\Images_Data', 'query_images' ),
                'args' => array(
                    'gallery' => array(
                        'sanitize_callback' => 'absint',
                    ),
                    'tag' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'person' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'location' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'limit' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                    'offset' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => '__return_true',
            ),
        ) );
    }
}
