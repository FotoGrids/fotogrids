<?php
namespace FotoGrids\REST\Stats;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Statistics Permissions Handler
 *
 * Handles permission checks for statistics-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Stats_Permissions {
    
    /**
     * Permission check for statistics endpoints
     *
     * Determines if the current user has permission to submit statistics data.
     * Currently allows unauthenticated users to track stats for analytics.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object
     * @return bool True if access is allowed, false otherwise
     */
    public static function check_stats( $request ) {
        return true;
    }
}
