<?php
/**
 * Permission callbacks for the view collections REST resource.
 *
 * @package FotoGrids\Modules\ViewCollections\REST
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections\REST;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Permission checks for view page settings endpoints.
 *
 * @since 1.0.0
 */
class View_Collections_Permissions {

    /**
     * Permission check for reading resolved view page settings.
     *
     * Public read mirrors the gallery resource: the frontend needs the
     * resolved settings without a nonce.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST request.
     * @return bool
     */
    public static function check_read( $request ) {
        return true;
    }

    /**
     * Permission check for writing view page settings.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST request.
     * @return bool
     */
    public static function check_write( $request ) {
        return current_user_can( 'manage_fotogrids' );
    }
}
