<?php
namespace FotoGrids\REST\Lightbox;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Lightbox REST Routes Registration
 *
 * @since 1.0.0
 */
class Register_Lightbox_Routes {

    /**
     * Register lightbox REST routes.
     *
     * @return void
     */
    public static function register(): void {
        // GET /fotogrids/v1/lightbox/item/{id}
        // Returns all data required by the lightbox info panel for a single item.
        register_rest_route( 'fotogrids/v1', '/lightbox/item/(?P<id>\d+)', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( Lightbox_Data::class, 'get_item_data' ),
                'permission_callback' => array( Lightbox_Permissions::class, 'check_lightbox_read' ),
                'args'                => array(
                    'id'            => array(
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                        'description'       => __( 'Attachment ID.', 'fotogrids' ),
                    ),
                    'credit_source' => array(
                        'required'          => false,
                        'type'              => 'string',
                        'default'           => 'item_meta',
                        'enum'              => array( 'item_meta', 'exif' ),
                        'sanitize_callback' => 'sanitize_key',
                        'description'       => __( 'Where to resolve the credit field from.', 'fotogrids' ),
                    ),
                ),
            ),
        ) );
    }
}
