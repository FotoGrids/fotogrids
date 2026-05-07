<?php
namespace FotoGrids\REST\Metadata;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Metadata REST Routes Registration
 *
 * Handles registration of metadata-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Metadata_Routes {

    /**
     * Register all metadata-related REST API routes
     *
     * Registers endpoints for tags, people, locations, and item metadata.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Tags endpoints
        register_rest_route( 'fotogrids/v1', '/metadata/tags', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'get_metadata_tags' ),
                'args' => array(
                    'search' => array(
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'limit' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'create_metadata_tag' ),
                'args' => array(
                    'name' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // People endpoints
        register_rest_route( 'fotogrids/v1', '/metadata/people', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'get_metadata_people' ),
                'args' => array(
                    'search' => array(
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'limit' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'create_metadata_person' ),
                'args' => array(
                    'name' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Locations endpoints
        register_rest_route( 'fotogrids/v1', '/metadata/locations', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'get_metadata_locations' ),
                'args' => array(
                    'search' => array(
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'limit' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'create_metadata_location' ),
                'args' => array(
                    'name' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'latitude' => array(
                        'default' => null,
                        'sanitize_callback' => 'floatval',
                    ),
                    'longitude' => array(
                        'default' => null,
                        'sanitize_callback' => 'floatval',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Item metadata endpoint
        register_rest_route( 'fotogrids/v1', '/metadata/item/(?P<id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'get_item_metadata' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Metadata\Metadata_Data', 'save_item_metadata' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                    ),
                    'tags' => array(
                        'default' => array(),
                        'type' => 'array',
                        'items' => array( 'type' => 'string' ),
                    ),
                    'people' => array(
                        'default' => array(),
                        'type' => 'array',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'name' => array( 'type' => 'string' ),
                                'details' => array( 'type' => 'string' ),
                            ),
                        ),
                    ),
                    'locations' => array(
                        'default' => array(),
                        'type' => 'array',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'name' => array( 'type' => 'string' ),
                                'latitude' => array( 'type' => 'number' ),
                                'longitude' => array( 'type' => 'number' ),
                            ),
                        ),
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_edit_posts' ),
            ),
        ) );
    }
}
