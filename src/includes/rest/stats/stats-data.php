<?php
namespace FotoGrids\REST\Stats;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Statistics Data Handler
 *
 * Handles statistics tracking for REST API endpoints.
 *
 * @since 1.0.0
 */
class Stats_Data {

    /**
     * Increment view count
     *
     * Records a view event for a specific object (gallery, album, or item).
     * Used for analytics and statistics tracking.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request containing object type and ID
     * @return \WP_REST_Response|\WP_Error Success response or error
     */
    public static function increment_view( $request ) {
        $object_type = $request->get_param( 'object_type' );
        $object_id = (int) $request->get_param( 'object_id' );

        $result = \FotoGrids\Statistics::increment( $object_type, $object_id, 'views' );

        if ( ! $result ) {
            return new \WP_Error(
                'stats_update_failed',
                __( 'Failed to update statistics', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }

        return rest_ensure_response( array( 'success' => true ) );
    }

    /**
     * Increment share count
     *
     * Records a share event for a specific object, optionally tracking the
     * social network used for sharing. Triggers additional hooks for
     * extended tracking functionality.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request containing object type, ID, and network
     * @return \WP_REST_Response|\WP_Error Success response or error
     */
    public static function increment_share( $request ) {
        $object_type = $request->get_param( 'object_type' );
        $object_id = (int) $request->get_param( 'object_id' );
        $network = $request->get_param( 'network' );

        $result = \FotoGrids\Statistics::increment( $object_type, $object_id, 'shares' );

        if ( ! $result ) {
            return new \WP_Error(
                'stats_update_failed',
                __( 'Failed to update statistics', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }

        if ( $network ) {
            do_action( 'fotogrids/actions/share/tracked', $object_type, $object_id, $network );
        }

        return rest_ensure_response( array( 'success' => true ) );
    }
}
