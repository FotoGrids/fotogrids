<?php
namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Admin REST Routes Registration
 *
 * Handles registration of all admin-specific REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Admin_Routes {

    /**
     * Register all admin-specific REST API routes
     *
     * Registers endpoints for managing gallery-album relationships.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {

        // Album management routes

        // Add galleries to album: POST /admin/albums/{id}/galleries
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'add_galleries_to_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'gallery_ids' => array(
                        'required' => true,
                        'validate_callback' => function( $param ) {
                            return is_array( $param ) && ! empty( $param );
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'absint', $param );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_album_edit' ),
            ),
        ) );

        // Remove gallery from album: DELETE /admin/albums/{id}/galleries/{gallery_id}
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries/(?P<gallery_id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::DELETABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'remove_gallery_from_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'gallery_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_album_edit' ),
            ),
        ) );

        // Reorder galleries in album: POST /admin/albums/{id}/galleries/reorder
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries/reorder', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'reorder_galleries_in_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'gallery_ids' => array(
                        'required' => true,
                        'validate_callback' => function( $param ) {
                            return is_array( $param ) && ! empty( $param );
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'absint', $param );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_album_edit' ),
            ),
        ) );

        // Gallery management routes

        // Add albums to gallery: POST /admin/galleries/{id}/albums
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/albums', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'add_albums_to_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'album_ids' => array(
                        'required' => true,
                        'validate_callback' => function( $param ) {
                            return is_array( $param ) && ! empty( $param );
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'absint', $param );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_gallery_edit' ),
            ),
        ) );

        // Remove album from gallery: DELETE /admin/galleries/{id}/albums/{album_id}
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/albums/(?P<album_id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::DELETABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'remove_album_from_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'album_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_gallery_edit' ),
            ),
        ) );

        // Get WordPress image sizes: GET /admin/image-sizes
        register_rest_route( 'fotogrids/v1', '/admin/image-sizes', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_image_sizes' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
                'args'     => array(
                    'include_hidden' => array(
                        'type'    => 'boolean',
                        'default' => false,
                    ),
                ),
            ),
        ) );

        // Plugin-wide media settings: GET /admin/media-settings, POST /admin/media-settings
        register_rest_route( 'fotogrids/v1', '/admin/media-settings', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_media_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_fotogrids' ),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'save_media_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_fotogrids' ),
                'args'                => array(
                    'thumbnail_width'     => array( 'type' => 'integer', 'minimum' => 1,   'default' => 400 ),
                    'thumbnail_height'    => array( 'type' => 'integer', 'minimum' => 0,   'default' => 300 ),
                    'thumbnail_crop'      => array( 'type' => 'boolean',                   'default' => true ),
                    'thumbnail_alignment' => array( 'type' => 'string',  'default' => 'center',
                        'enum' => array( 'center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right' ),
                    ),
                    'full_width'          => array( 'type' => 'integer', 'minimum' => 1,   'default' => 1920 ),
                    'full_height'         => array( 'type' => 'integer', 'minimum' => 0,   'default' => 0 ),
                    'masonry_width'       => array( 'type' => 'integer', 'minimum' => 1,   'default' => 600 ),
                    'justified_height'    => array( 'type' => 'integer', 'minimum' => 1,   'default' => 400 ),
                ),
            ),
        ) );

        // General (responsiveness) settings: GET / POST /admin/general-settings
        register_rest_route( 'fotogrids/v1', '/admin/general-settings', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_general_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'save_general_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
                'args'                => array(
                    'mobile_breakpoint'            => array( 'type' => 'integer', 'minimum' => 0, 'default' => 767 ),
                    'tablet_breakpoint'            => array( 'type' => 'integer', 'minimum' => 0, 'default' => 1024 ),
                    'detect_responsive_by_browser' => array( 'type' => 'boolean', 'default' => false ),
                ),
            ),
        ) );

        // Sharing settings: GET / POST /admin/sharing-settings
        register_rest_route( 'fotogrids/v1', '/admin/sharing-settings', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_sharing_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'save_sharing_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
        ) );

        // SEO settings: GET / POST /admin/seo-settings
        register_rest_route( 'fotogrids/v1', '/admin/seo-settings', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_seo_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'save_seo_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
        ) );

        // View page appearance settings: GET / POST /admin/view-settings
        register_rest_route( 'fotogrids/v1', '/admin/view-settings', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_view_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'save_view_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
        ) );

        // Advanced (boolean) settings: GET / POST /admin/advanced-settings
        register_rest_route( 'fotogrids/v1', '/admin/advanced-settings', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_advanced_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Admin\Admin_Data', 'save_advanced_settings' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_manage_settings' ),
                'args'                => array(
                    'autosave'                          => array( 'type' => 'boolean', 'default' => false ),
                    'share_statistics'                  => array( 'type' => 'boolean', 'default' => false ),
                    'custom_js_allow_dynamic_execution' => array( 'type' => 'boolean', 'default' => false ),
                    'delete_data_on_uninstall'          => array( 'type' => 'boolean', 'default' => false ),
                ),
            ),
        ) );

        // Get Google Fonts families: GET /admin/google-fonts/families
        register_rest_route( 'fotogrids/v1', '/admin/google-fonts/families', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_google_fonts_families' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get dashboard overview statistics: GET /admin/stats/overview
        register_rest_route( 'fotogrids/v1', '/admin/stats/overview', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_overview_stats' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get views data over time: GET /admin/stats/views
        register_rest_route( 'fotogrids/v1', '/admin/stats/views', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_views_data' ),
                'args' => array(
                    'days' => array(
                        'default' => 7,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0 && $param <= 365;
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get popular galleries: GET /admin/stats/popular-galleries
        register_rest_route( 'fotogrids/v1', '/admin/stats/popular-galleries', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_popular_galleries' ),
                'args' => array(
                    'days' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get recent activity: GET /admin/stats/recent-activity
        register_rest_route( 'fotogrids/v1', '/admin/stats/recent-activity', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_recent_activity' ),
                'args' => array(
                    'days' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get top content: GET /admin/stats/top-content
        register_rest_route( 'fotogrids/v1', '/admin/stats/top-content', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_top_content' ),
                'args' => array(
                    'days' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Add items to gallery: POST /admin/galleries/{id}/items
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/items', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'add_items_to_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'item_ids' => array(
                        'required' => true,
                        'validate_callback' => function( $param ) {
                            return is_array( $param ) && ! empty( $param );
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'absint', $param );
                        },
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_gallery_edit' ),
            ),
        ) );

        // Get gallery preview HTML: GET /admin/galleries/{id}/preview
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/preview', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_gallery_preview' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'template' => array(
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'cols' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                    'lazy' => array(
                        'default' => true,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                    'lightbox' => array(
                        'default' => true,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                    'captions' => array(
                        'default' => true,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_gallery_edit' ),
            ),
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Preview_Endpoint', 'preview' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'version' => array(
                        'default' => 2,
                        'sanitize_callback' => 'absint',
                    ),
                    'settings' => array(
                        'default' => array(),
                    ),
                    'item_order' => array(
                        'default' => array(),
                    ),
                    'item_overrides' => array(
                        'default' => array(),
                    ),
                    'simulate_state' => array(
                        'default' => null,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_gallery_edit' ),
            ),
        ) );

        // Get catalog field states: GET /admin/catalog/field-states
        register_rest_route( 'fotogrids/v1', '/admin/catalog/field-states', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Catalog_Field_States_Endpoint', 'get_field_states' ),
                'args' => array(
                    'simulate_state' => array(
                        'default' => null,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get assembled catalog tree: GET /admin/catalog/entries
        register_rest_route( 'fotogrids/v1', '/admin/catalog/entries', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Catalog_Entries_Endpoint', 'get_entries' ),
                'args' => array(
                    'post_type' => array(
                        'default' => 'gallery',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get recently edited galleries/albums: GET /admin/recently-edited
        register_rest_route( 'fotogrids/v1', '/admin/recently-edited', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_recently_edited' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get news and updates: GET /admin/news
        register_rest_route( 'fotogrids/v1', '/admin/news', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_news_updates' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_edit_posts' ),
            ),
        ) );

        // Get license status: GET /admin/license/status
        register_rest_route( 'fotogrids/v1', '/admin/license/status', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_license_status' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_license_manage' ),
            ),
        ) );

        // Activate license: POST /admin/license/activate
        register_rest_route( 'fotogrids/v1', '/admin/license/activate', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'activate_license' ),
                'args' => array(
                    'license_key' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_license_manage' ),
            ),
        ) );

        // Deactivate license: POST /admin/license/deactivate
        register_rest_route( 'fotogrids/v1', '/admin/license/deactivate', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'deactivate_license' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_license_manage' ),
            ),
        ) );

        // Get WordPress roles: GET /admin/roles
        register_rest_route( 'fotogrids/v1', '/admin/roles', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Admin\Admin_Data', 'get_roles' ),
                'permission_callback' => array( '\FotoGrids\REST\Admin\Admin_Permissions', 'check_license_manage' ),
            ),
        ) );
    }
}
