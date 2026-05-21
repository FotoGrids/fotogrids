<?php
namespace FotoGrids\REST\Items;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Items REST Routes Registration
 *
 * Handles registration of item-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Items_Routes {
    
    /**
     * Register all item-related REST API routes
     *
     * Registers endpoints for item querying and filtering.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Unified item save endpoint — core fields + metadata in one call.
        register_rest_route( 'fotogrids/v1', '/items/(?P<id>\d+)/save', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Items\Save_Item_Data', 'save' ),
                'permission_callback' => array( '\FotoGrids\REST\Items\Items_Permissions', 'check_items_write' ),
                'args'                => array(
                    'id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                    ),
                    'title' => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'alt' => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'caption' => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_textarea_field',
                    ),
                    'description' => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_textarea_field',
                    ),
                    'credit' => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'external_url' => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_url',
                    ),
                    'link_target' => array(
                        'default'           => 'global',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'exif' => array(
                        'default' => array(),
                        'type'    => 'object',
                    ),
                    'tags' => array(
                        'default' => array(),
                        'type'    => 'array',
                        'items'   => array( 'type' => 'integer' ),
                    ),
                    'people' => array(
                        'default' => array(),
                        'type'    => 'array',
                        'items'   => array(
                            'type'       => 'object',
                            'properties' => array(
                                'id'      => array( 'type' => 'integer' ),
                                'name'    => array( 'type' => 'string' ),
                                'details' => array( 'type' => 'string' ),
                            ),
                        ),
                    ),
                    'locations' => array(
                        'default' => array(),
                        'type'    => 'array',
                        'items'   => array(
                            'type'       => 'object',
                            'properties' => array(
                                'id'        => array( 'type' => 'integer' ),
                                'name'      => array( 'type' => 'string' ),
                                'latitude'  => array( 'type' => array( 'number', 'null' ) ),
                                'longitude' => array( 'type' => array( 'number', 'null' ) ),
                            ),
                        ),
                    ),
                ),
            ),
        ) );

        // Items query endpoint
        register_rest_route( 'fotogrids/v1', '/items', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Items\Items_Data', 'query_items' ),
                'args' => array(
                    'gallery' => array(
                        'sanitize_callback' => 'absint',
                    ),
                    'tag' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'person' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'location' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'limit' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                    'offset' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => '__return_true',
            ),
        ) );

        // Resolve embed URL to oEmbed metadata (title + thumbnail).
        register_rest_route( 'fotogrids/v1', '/items/resolve-embed', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Items\Embed_Data', 'resolve_embed' ),
                'permission_callback' => array( '\FotoGrids\REST\Items\Items_Permissions', 'check_items_write' ),
                'args'                => array(
                    'url'    => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'esc_url_raw',
                        'description'       => __( 'The full YouTube or Vimeo URL to resolve.', 'fotogrids' ),
                    ),
                    'source' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'enum'              => array( 'video_youtube', 'video_vimeo' ),
                        'sanitize_callback' => 'sanitize_key',
                        'description'       => __( 'The embed platform identifier.', 'fotogrids' ),
                    ),
                ),
            ),
        ) );

        // Create a virtual embed item in a gallery.
        register_rest_route( 'fotogrids/v1', '/items/embed', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Items\Embed_Data', 'create_embed' ),
                'permission_callback' => array( '\FotoGrids\REST\Items\Items_Permissions', 'check_items_write' ),
                'args'                => array(
                    'gallery_id'     => array(
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                        'description'       => __( 'The gallery to add the embed to.', 'fotogrids' ),
                    ),
                    'source'         => array(
                        'required'          => true,
                        'type'              => 'string',
                        'enum'              => array( 'video_youtube', 'video_vimeo' ),
                        'sanitize_callback' => 'sanitize_key',
                        'description'       => __( 'The embed platform identifier.', 'fotogrids' ),
                    ),
                    'url'            => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'esc_url_raw',
                        'description'       => __( 'The full embed URL.', 'fotogrids' ),
                    ),
                    'caption'        => array(
                        'required'          => false,
                        'type'              => 'string',
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                        'description'       => __( 'Optional caption for the embed item.', 'fotogrids' ),
                    ),
                    'embed_settings' => array(
                        'required'    => false,
                        'type'        => 'object',
                        'default'     => array(),
                        'description' => __( 'Platform-specific embed settings (autoplay, mute, loop, etc.).', 'fotogrids' ),
                    ),
                ),
            ),
        ) );
    }
}
