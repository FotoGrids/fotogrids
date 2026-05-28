<?php
namespace FotoGrids\REST\Album;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Album Permissions Handler
 *
 * Handles permission checks for album-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Album_Permissions {
    
    /**
     * Permission check for reading albums
     *
     * Determines if the current user has permission to read album data.
     * Currently allows public access for all published albums.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object
     * @return bool True if access is allowed, false otherwise
     */
    public static function check_album_read( $request ) {
        return true;
    }

    /**
     * Permission check for writing an album's featured gallery.
     *
     * Mirrors WP's `edit_post` cap for the specific album ID.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return bool|\WP_Error
     */
    public static function check_featured_gallery_write( $request ) {
        $album_id = absint( $request['id'] );
        if ( $album_id <= 0 ) {
            return new \WP_Error(
                'fotogrids_invalid_album',
                __( 'Invalid album ID.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }
        if ( ! current_user_can( 'edit_post', $album_id ) ) {
            return new \WP_Error(
                'fotogrids_forbidden',
                __( 'You do not have permission to edit this album.', 'fotogrids' ),
                array( 'status' => 403 )
            );
        }
        return true;
    }
}
