<?php
/**
 * Data handlers for the view collections REST resource.
 *
 * @package FotoGrids\Modules\ViewCollections\REST
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections\REST;

use FotoGrids\Modules\ViewCollections\Settings;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Read and write handlers for view page settings.
 *
 * @since 1.0.0
 */
class View_Collections_Data {

    /**
     * Return the resolved view page settings for a collection.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST request.
     * @return \WP_REST_Response|\WP_Error
     */
    public static function get_settings( $request ) {
        $post_id = absint( $request['id'] );
        $post    = get_post( $post_id );

        if ( ! $post || ! in_array( $post->post_type, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
            return new \WP_Error(
                'fotogrids_not_found',
                __( 'Collection not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        $data = array(
            'id'       => $post_id,
            'url'      => get_permalink( $post ),
            'settings' => Settings::get( $post_id ),
        );

        /**
         * Filter the view page settings REST response.
         *
         * @since 1.0.0
         * @param array    $data
         * @param \WP_Post $post
         */
        $data = apply_filters( 'fotogrids/view/rest/settings_response', $data, $post );

        return rest_ensure_response( $data );
    }
}
