<?php
namespace FotoGrids\REST\Metadata;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Metadata Permissions Handler
 *
 * Handles permission checks for metadata-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Metadata_Permissions {
    
    /**
     * Permission check for edit_posts capability
     *
     * Verifies that the current user has the 'edit_posts' capability,
     * which is required for accessing metadata management endpoints.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object
     * @return bool True if user can edit posts, false otherwise
     */
    public static function check_edit_posts( $request ) {
        return current_user_can( 'edit_posts' );
    }
}
