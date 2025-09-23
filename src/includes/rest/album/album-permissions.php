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
}
