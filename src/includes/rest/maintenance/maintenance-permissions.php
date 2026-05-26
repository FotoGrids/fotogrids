<?php
namespace FotoGrids\REST\Maintenance;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Permission callbacks for the Maintenance REST resource.
 *
 * Every Maintenance route is gated on the `manage_fotogrids` capability -
 * the same capability used by the other plugin-wide write endpoints
 * (media-settings, advanced-settings). All of Maintenance's operations are
 * destructive or developer-facing, so the same role gate applies.
 *
 * @since 1.0.0
 */
class Maintenance_Permissions {

    /**
     * Check whether the current user can perform Maintenance operations.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request Request object.
     * @return bool
     */
    public static function check_manage_fotogrids( $request ) {
        return current_user_can( 'manage_fotogrids' );
    }
}
