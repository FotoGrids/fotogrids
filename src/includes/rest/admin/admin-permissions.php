<?php
namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Admin Permissions Class
 *
 * Handles permissions for admin-specific REST API endpoints.
 *
 * @since 1.0.0
 */
class Admin_Permissions {
    
    /**
     * Check if user can manage galleries and albums
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_admin_manage( $request ) {
        return current_user_can( 'edit_posts' ) && current_user_can( 'upload_files' );
    }
    
    /**
     * Check if user can edit specific gallery
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_gallery_edit( $request ) {
        $gallery_id = $request->get_param( 'id' );
        
        if ( ! $gallery_id ) {
            return false;
        }
        
        $gallery = get_post( $gallery_id );
        
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return false;
        }
        
        return current_user_can( 'edit_post', $gallery_id );
    }
    
    /**
     * Check if user can edit specific album
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_album_edit( $request ) {
        $album_id = $request->get_param( 'id' );
        
        if ( ! $album_id ) {
            return false;
        }
        
        $album = get_post( $album_id );
        
        if ( ! $album || $album->post_type !== 'fotogrids_album' ) {
            return false;
        }
        
        return current_user_can( 'edit_post', $album_id );
    }
}
