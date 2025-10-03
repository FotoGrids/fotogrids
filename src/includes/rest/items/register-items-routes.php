<?php
namespace FotoGrids\REST\Items;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Items REST Routes Registration
 *
 * Handles registration of item-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Items_Routes {
    
    /**
     * Register all item-related REST API routes
     *
     * Registers endpoints for item querying and filtering.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Items query endpoint
        register_rest_route( 'fotogrids/v1', '/items', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Items\Items_Data', 'query_items' ),
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
