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
    
    /**
     * Check if user can edit posts
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_edit_posts( $request ) {
        return current_user_can( 'edit_posts' );
    }
    
    /**
     * Check if user can manage license
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_license_manage( $request ) {
        return current_user_can( 'manage_fotogrids_settings' );
    }

    /**
     * Check if user has the manage_fotogrids capability (required for plugin-level settings
     * like media configuration and maintenance tools).
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request Request object
     * @return bool
     */
    public static function check_manage_fotogrids( $request ) {
        return current_user_can( 'manage_fotogrids' );
    }

    /**
     * Check if the user can manage plugin settings (general / advanced).
     *
     * Mirrors the capability gating the Settings page menu and the legacy
     * options.php save path used.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request Request object
     * @return bool
     */
    public static function check_manage_settings( $request ) {
        return current_user_can( 'manage_fotogrids_settings' );
    }
}
