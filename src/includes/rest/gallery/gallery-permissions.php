<?php
namespace FotoGrids\REST\Gallery;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Gallery Permissions Handler
 *
 * Handles permission checks for gallery-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Gallery_Permissions {
    
    /**
     * Permission check for reading galleries
     *
     * Determines if the current user has permission to read gallery data.
     * Currently allows public access for all published galleries.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object
     * @return bool True if access is allowed, false otherwise
     */
    public static function check_gallery_read( $request ) {
        return true;
    }
}
