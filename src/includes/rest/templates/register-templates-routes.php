<?php
namespace FotoGrids\REST\Templates;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Templates REST Routes Registration
 *
 * Handles registration of template-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Templates_Routes {
    
    /**
     * Register all template-related REST API routes
     *
     * Registers endpoints for template listing.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Templates endpoint
        register_rest_route( 'fotogrids/v1', '/templates', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Templates\Templates_Data', 'get_templates' ),
                'permission_callback' => '__return_true',
            ),
        ) );
    }
}
