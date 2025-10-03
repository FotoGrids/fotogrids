<?php
namespace FotoGrids\REST\Stats;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Statistics REST Routes Registration
 *
 * Handles registration of all statistics-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Stats_Routes {
    
    /**
     * Register all statistics-related REST API routes
     *
     * Registers endpoints for view and share tracking.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // View tracking endpoint
        register_rest_route( 'fotogrids/v1', '/stats/view', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Stats\Stats_Data', 'increment_view' ),
                'args' => array(
                    'object_type' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                        'validate_callback' => function( $param ) {
                            return in_array( $param, array( 'gallery', 'album', 'item' ) );
                        },
                    ),
                    'object_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Stats\Stats_Permissions', 'check_stats' ),
            ),
        ) );
        
        // Share tracking endpoint
        register_rest_route( 'fotogrids/v1', '/stats/share', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Stats\Stats_Data', 'increment_share' ),
                'args' => array(
                    'object_type' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                        'validate_callback' => function( $param ) {
                            return in_array( $param, array( 'gallery', 'album', 'item' ) );
                        },
                    ),
                    'object_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'network' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                        'validate_callback' => function( $param ) {
                            return in_array( $param, array( 'facebook', 'twitter', 'pinterest', 'email', 'copy' ) );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Stats\Stats_Permissions', 'check_stats' ),
            ),
        ) );
    }
}
