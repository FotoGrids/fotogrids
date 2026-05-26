<?php
namespace FotoGrids\REST\Metadata;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Library REST Routes Registration.
 *
 * Registers the routes that power the FotoGrids → Library admin page.
 * All write operations are gated behind manage_fotogrids_library via
 * Metadata_Permissions::check_manage_library().
 *
 * @since 1.0.0
 */
class Register_Library_Routes {

    /**
     * Register all library-related REST API routes.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        $manage_cb = array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_manage_library' );
        $read_cb   = array( '\FotoGrids\REST\Metadata\Metadata_Permissions', 'check_read_library' );

        // GET /library/types - list registered entity types.
        register_rest_route( 'fotogrids/v1', '/library/types', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'get_types' ),
                'permission_callback' => $read_cb,
            ),
        ) );

        // List + create on /library/{type}.
        register_rest_route( 'fotogrids/v1', '/library/(?P<type>[a-z0-9_-]+)', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'get_library' ),
                'permission_callback' => $read_cb,
                'args' => array(
                    'type'        => array( 'required' => true,  'sanitize_callback' => 'sanitize_key' ),
                    'search'      => array( 'default'  => '',    'sanitize_callback' => 'sanitize_text_field' ),
                    'page'        => array( 'default'  => 1,     'sanitize_callback' => 'absint' ),
                    'per_page'    => array( 'default'  => 50,    'sanitize_callback' => 'absint' ),
                    'orderby'     => array( 'default'  => 'name','sanitize_callback' => 'sanitize_key' ),
                    'order'       => array( 'default'  => 'asc', 'sanitize_callback' => 'sanitize_key' ),
                    'unused_only' => array( 'default'  => false, 'sanitize_callback' => 'rest_sanitize_boolean' ),
                ),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'create_entity' ),
                'permission_callback' => $manage_cb,
                'args' => array(
                    'type'      => array( 'required' => true, 'sanitize_callback' => 'sanitize_key' ),
                    'name'      => array( 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
                    'latitude'  => array( 'default'  => null, 'sanitize_callback' => null ),
                    'longitude' => array( 'default'  => null, 'sanitize_callback' => null ),
                    'details'   => array( 'default'  => '',   'sanitize_callback' => 'sanitize_text_field' ),
                ),
            ),
            // Bulk delete also lives on the collection URL.
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'bulk_delete' ),
                'permission_callback' => $manage_cb,
                'args' => array(
                    'type' => array( 'required' => true, 'sanitize_callback' => 'sanitize_key' ),
                    'ids'  => array(
                        'required' => true,
                        'type'     => 'array',
                        'items'    => array( 'type' => 'integer' ),
                    ),
                ),
            ),
        ) );

        // Single-item update / delete.
        register_rest_route( 'fotogrids/v1', '/library/(?P<type>[a-z0-9_-]+)/(?P<id>\d+)', array(
            array(
                'methods'             => array( 'PATCH', 'PUT' ),
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'update_entity' ),
                'permission_callback' => $manage_cb,
                'args' => array(
                    'type'      => array( 'required' => true, 'sanitize_callback' => 'sanitize_key' ),
                    'id'        => array( 'required' => true, 'sanitize_callback' => 'absint' ),
                    'name'      => array( 'sanitize_callback' => 'sanitize_text_field' ),
                    'latitude'  => array( 'sanitize_callback' => null ),
                    'longitude' => array( 'sanitize_callback' => null ),
                    'details'   => array( 'sanitize_callback' => 'sanitize_text_field' ),
                ),
            ),
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'delete_entity' ),
                'permission_callback' => $manage_cb,
                'args' => array(
                    'type' => array( 'required' => true, 'sanitize_callback' => 'sanitize_key' ),
                    'id'   => array( 'required' => true, 'sanitize_callback' => 'absint' ),
                ),
            ),
        ) );

        // Merge sources into target.
        register_rest_route( 'fotogrids/v1', '/library/(?P<type>[a-z0-9_-]+)/merge', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'merge' ),
                'permission_callback' => $manage_cb,
                'args' => array(
                    'type'       => array( 'required' => true, 'sanitize_callback' => 'sanitize_key' ),
                    'target_id'  => array( 'required' => true, 'sanitize_callback' => 'absint' ),
                    'source_ids' => array(
                        'required' => true,
                        'type'     => 'array',
                        'items'    => array( 'type' => 'integer' ),
                    ),
                ),
            ),
        ) );

        // Recalculate usage counts.
        register_rest_route( 'fotogrids/v1', '/library/(?P<type>[a-z0-9_-]+)/recalculate', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Metadata\Library_Data', 'recalculate' ),
                'permission_callback' => $manage_cb,
                'args' => array(
                    'type' => array( 'required' => true, 'sanitize_callback' => 'sanitize_key' ),
                ),
            ),
        ) );
    }
}
