<?php
namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Admin REST Routes Registration
 *
 * Handles registration of all admin-specific REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Admin_Routes {
    
    /**
     * Register all admin-specific REST API routes
     *
     * Registers endpoints for managing gallery-album relationships.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        
        // Album management routes
        
        // Add galleries to album: POST /admin/albums/{id}/galleries
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'add_galleries_to_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'gallery_ids' => array(
                        'required' => true,
                        'validate_callback' => function( $param ) {
                            return is_array( $param ) && ! empty( $param );
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'absint', $param );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_album_edit' ),
            ),
        ) );
        
        // Remove gallery from album: DELETE /admin/albums/{id}/galleries/{gallery_id}
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries/(?P<gallery_id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::DELETABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'remove_gallery_from_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'gallery_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_album_edit' ),
            ),
        ) );
        
        // Reorder galleries in album: POST /admin/albums/{id}/galleries/reorder
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries/reorder', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'reorder_galleries_in_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'gallery_ids' => array(
                        'required' => true,
                        'validate_callback' => function( $param ) {
                            return is_array( $param ) && ! empty( $param );
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'absint', $param );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_album_edit' ),
            ),
        ) );
        
        // Gallery management routes
        
        // Add albums to gallery: POST /admin/galleries/{id}/albums
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/albums', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'add_albums_to_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'album_ids' => array(
                        'required' => true,
                        'validate_callback' => function( $param ) {
                            return is_array( $param ) && ! empty( $param );
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'absint', $param );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_gallery_edit' ),
            ),
        ) );
        
        // Remove album from gallery: DELETE /admin/galleries/{id}/albums/{album_id}
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/albums/(?P<album_id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::DELETABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'remove_album_from_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'album_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_gallery_edit' ),
            ),
        ) );
    }
}
