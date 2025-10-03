<?php
namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Admin Data Class
 *
 * Handles data operations for admin-specific REST API endpoints.
 *
 * @since 1.0.0
 */
class Admin_Data {
    
    /**
     * Add galleries to album
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function add_galleries_to_album( $request ) {
        $album_id = $request->get_param( 'id' );
        $gallery_ids = $request->get_param( 'gallery_ids' );
        
        if ( empty( $gallery_ids ) || ! is_array( $gallery_ids ) ) {
            return new \WP_Error(
                'invalid_gallery_ids',
                __( 'Invalid gallery IDs provided.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }
        
        $added = array();
        $errors = array();
        
        foreach ( $gallery_ids as $gallery_id ) {
            $result = \FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, $album_id );
            
            if ( $result ) {
                $added[] = $gallery_id;
            } else {
                $errors[] = $gallery_id;
            }
        }
        
        return rest_ensure_response( array(
            'success' => true,
            'added' => $added,
            'errors' => $errors,
            'message' => sprintf(
                _n( 
                    '%d gallery added to album.', 
                    '%d galleries added to album.', 
                    count( $added ), 
                    'fotogrids' 
                ),
                count( $added )
            )
        ) );
    }
    
    /**
     * Remove gallery from album
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function remove_gallery_from_album( $request ) {
        $album_id = $request->get_param( 'id' );
        $gallery_id = $request->get_param( 'gallery_id' );
        
        $result = \FotoGrids\Gallery_Album_Relations::remove_gallery_from_album( $gallery_id, $album_id );
        
        if ( $result ) {
            return rest_ensure_response( array(
                'success' => true,
                'message' => __( 'Gallery removed from album.', 'fotogrids' )
            ) );
        } else {
            return new \WP_Error(
                'removal_failed',
                __( 'Failed to remove gallery from album.', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }
    }
    
    /**
     * Reorder galleries in album
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function reorder_galleries_in_album( $request ) {
        $album_id = $request->get_param( 'id' );
        $gallery_ids = $request->get_param( 'gallery_ids' );
        
        if ( empty( $gallery_ids ) || ! is_array( $gallery_ids ) ) {
            return new \WP_Error(
                'invalid_gallery_ids',
                __( 'Invalid gallery IDs provided.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }
        
        $result = \FotoGrids\Gallery_Album_Relations::reorder_galleries_in_album( $album_id, $gallery_ids );
        
        if ( $result ) {
            return rest_ensure_response( array(
                'success' => true,
                'message' => __( 'Gallery order updated.', 'fotogrids' )
            ) );
        } else {
            return new \WP_Error(
                'reorder_failed',
                __( 'Failed to reorder galleries.', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }
    }
    
    /**
     * Add albums to gallery
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function add_albums_to_gallery( $request ) {
        $gallery_id = $request->get_param( 'id' );
        $album_ids = $request->get_param( 'album_ids' );
        
        if ( empty( $album_ids ) || ! is_array( $album_ids ) ) {
            return new \WP_Error(
                'invalid_album_ids',
                __( 'Invalid album IDs provided.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }
        
        $added = array();
        $errors = array();
        
        foreach ( $album_ids as $album_id ) {
            $result = \FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, $album_id );
            
            if ( $result ) {
                $added[] = $album_id;
            } else {
                $errors[] = $album_id;
            }
        }
        
        return rest_ensure_response( array(
            'success' => true,
            'added' => $added,
            'errors' => $errors,
            'message' => sprintf(
                _n( 
                    'Gallery added to %d album.', 
                    'Gallery added to %d albums.', 
                    count( $added ), 
                    'fotogrids' 
                ),
                count( $added )
            )
        ) );
    }
    
    /**
     * Remove album from gallery
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function remove_album_from_gallery( $request ) {
        $gallery_id = $request->get_param( 'id' );
        $album_id = $request->get_param( 'album_id' );
        
        $result = \FotoGrids\Gallery_Album_Relations::remove_gallery_from_album( $gallery_id, $album_id );
        
        if ( $result ) {
            return rest_ensure_response( array(
                'success' => true,
                'message' => __( 'Gallery removed from album.', 'fotogrids' )
            ) );
        } else {
            return new \WP_Error(
                'removal_failed',
                __( 'Failed to remove gallery from album.', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }
    }
}
