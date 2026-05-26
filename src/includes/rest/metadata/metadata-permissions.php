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

    /**
     * Permission check for library management endpoints.
     *
     * Curating the site-wide tag / person / location library is a destructive
     * operation (renames affect every linked item, deletes cascade to item links),
     * so it requires the dedicated `manage_fotogrids_library` capability or the
     * blanket `manage_fotogrids` capability.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return bool
     */
    public static function check_manage_library( $request ) {
        return current_user_can( 'manage_fotogrids_library' )
            || current_user_can( 'manage_fotogrids' );
    }

    /**
     * Read permission for library endpoints - same gate as manage.
     *
     * Library listings expose usage counts and stored metadata, which we want
     * to keep behind the management capability.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return bool
     */
    public static function check_read_library( $request ) {
        return self::check_manage_library( $request );
    }
}
