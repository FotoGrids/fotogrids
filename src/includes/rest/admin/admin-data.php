<?php
namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Admin Data Class
 *
 * Handles data operations for admin-specific REST API endpoints.
 *
 * @since 1.0.0
 */
class Admin_Data {

    /**
     * Add galleries to album
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function add_galleries_to_album( $request ) {
        $album_id = $request->get_param( 'id' );
        $gallery_ids = $request->get_param( 'gallery_ids' );

        if ( empty( $gallery_ids ) || ! is_array( $gallery_ids ) ) {
            return new \WP_Error(
                'invalid_gallery_ids',
                __( 'Invalid gallery IDs provided.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $added = array();
        $errors = array();

        foreach ( $gallery_ids as $gallery_id ) {
            $result = \FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, $album_id );

            if ( $result ) {
                $added[] = $gallery_id;
            } else {
                $errors[] = $gallery_id;
            }
        }

        return rest_ensure_response( array(
            'success' => true,
            'added' => $added,
            'errors' => $errors,
            'message' => sprintf(
                _n(
                    '%d gallery added to album.',
                    '%d galleries added to album.',
                    count( $added ),
                    'fotogrids'
                ),
                count( $added )
            )
        ) );
    }

    /**
     * Remove gallery from album
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function remove_gallery_from_album( $request ) {
        $album_id = $request->get_param( 'id' );
        $gallery_id = $request->get_param( 'gallery_id' );

        $result = \FotoGrids\Gallery_Album_Relations::remove_gallery_from_album( $gallery_id, $album_id );

        if ( $result ) {
            return rest_ensure_response( array(
                'success' => true,
                'message' => __( 'Gallery removed from album.', 'fotogrids' )
            ) );
        } else {
            return new \WP_Error(
                'removal_failed',
                __( 'Failed to remove gallery from album.', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }
    }

    /**
     * Reorder galleries in album
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function reorder_galleries_in_album( $request ) {
        $album_id = $request->get_param( 'id' );
        $gallery_ids = $request->get_param( 'gallery_ids' );

        if ( empty( $gallery_ids ) || ! is_array( $gallery_ids ) ) {
            return new \WP_Error(
                'invalid_gallery_ids',
                __( 'Invalid gallery IDs provided.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $result = \FotoGrids\Gallery_Album_Relations::reorder_galleries_in_album( $album_id, $gallery_ids );

        if ( $result ) {
            return rest_ensure_response( array(
                'success' => true,
                'message' => __( 'Gallery order updated.', 'fotogrids' )
            ) );
        } else {
            return new \WP_Error(
                'reorder_failed',
                __( 'Failed to reorder galleries.', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }
    }

    /**
     * Add albums to gallery
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function add_albums_to_gallery( $request ) {
        $gallery_id = $request->get_param( 'id' );
        $album_ids = $request->get_param( 'album_ids' );

        if ( empty( $album_ids ) || ! is_array( $album_ids ) ) {
            return new \WP_Error(
                'invalid_album_ids',
                __( 'Invalid album IDs provided.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $added = array();
        $errors = array();

        foreach ( $album_ids as $album_id ) {
            $result = \FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, $album_id );

            if ( $result ) {
                $added[] = $album_id;
            } else {
                $errors[] = $album_id;
            }
        }

        return rest_ensure_response( array(
            'success' => true,
            'added' => $added,
            'errors' => $errors,
            'message' => sprintf(
                _n(
                    'Gallery added to %d album.',
                    'Gallery added to %d albums.',
                    count( $added ),
                    'fotogrids'
                ),
                count( $added )
            )
        ) );
    }

    /**
     * Remove album from gallery
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function remove_album_from_gallery( $request ) {
        $gallery_id = $request->get_param( 'id' );
        $album_id = $request->get_param( 'album_id' );

        $result = \FotoGrids\Gallery_Album_Relations::remove_gallery_from_album( $gallery_id, $album_id );

        if ( $result ) {
            return rest_ensure_response( array(
                'success' => true,
                'message' => __( 'Gallery removed from album.', 'fotogrids' )
            ) );
        } else {
            return new \WP_Error(
                'removal_failed',
                __( 'Failed to remove gallery from album.', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }
    }

    /**
     * Get WordPress roles
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response Array of roles with their capabilities
     */
    public static function get_roles( $request ) {
        if ( ! current_user_can( 'manage_fotogrids_settings' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        $wp_roles = wp_roles();
        $roles = array();

        foreach ( $wp_roles->roles as $role_key => $role_data ) {
            $role = get_role( $role_key );
            if ( ! $role ) {
                continue;
            }

            $roles[] = array(
                'key' => $role_key,
                'name' => $role_data['name'],
                'capabilities' => $role->capabilities,
            );
        }

        return rest_ensure_response( array( 'roles' => $roles ) );
    }

    /**
     * Get WordPress image sizes
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_image_sizes( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        // Hidden companion sizes - never shown in the picker UI.
        $hidden_slugs = array( \FotoGrids\Image_Size_Manager::SLUG_FULL_MOBILE );

        // Whether to include hidden sizes (e.g. for the Plugin Settings Media tab).
        $include_hidden = (bool) ( $request->get_param( 'include_hidden' ) ?? false );

        $sizes = array();
        $intermediate_sizes = get_intermediate_image_sizes();

        foreach ( $intermediate_sizes as $size ) {
            $is_hidden = in_array( $size, $hidden_slugs, true );
            if ( $is_hidden && ! $include_hidden ) {
                continue;
            }

            $is_fotogrids    = strpos( $size, 'fotogrids_' ) === 0;
            $is_plugin_size  = in_array( $size, array(
                \FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL,
                \FotoGrids\Image_Size_Manager::SLUG_FULL,
                \FotoGrids\Image_Size_Manager::SLUG_FULL_MOBILE,
                \FotoGrids\Image_Size_Manager::SLUG_MASONRY,
                \FotoGrids\Image_Size_Manager::SLUG_JUSTIFIED,
            ), true );
            $is_custom_size  = strpos( $size, \FotoGrids\Image_Size_Manager::CUSTOM_SLUG_PREFIX ) === 0;

            // Build human-readable label; give FotoGrids plugin sizes nicer names.
            if ( $size === \FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL ) {
                $label = __( 'FotoGrids Thumbnails', 'fotogrids' );
            } elseif ( $size === \FotoGrids\Image_Size_Manager::SLUG_FULL ) {
                $label = __( 'FotoGrids Full Size', 'fotogrids' );
            } elseif ( $size === \FotoGrids\Image_Size_Manager::SLUG_FULL_MOBILE ) {
                $label = __( 'FotoGrids Full Size (Mobile)', 'fotogrids' );
            } elseif ( $size === \FotoGrids\Image_Size_Manager::SLUG_MASONRY ) {
                $label = __( 'FotoGrids Masonry (variable height)', 'fotogrids' );
            } elseif ( $size === \FotoGrids\Image_Size_Manager::SLUG_JUSTIFIED ) {
                $label = __( 'FotoGrids Justified (variable width)', 'fotogrids' );
            } else {
                $label = ucfirst( str_replace( array( '-', '_' ), ' ', $size ) );
            }

            $size_data = array(
                'value'          => $size,
                'label'          => $label,
                'is_fotogrids'   => $is_fotogrids,
                'is_plugin_size' => $is_plugin_size,
                'is_custom_size' => $is_custom_size,
                'is_hidden'      => $is_hidden,
            );

            $size_info = wp_get_additional_image_sizes();
            if ( isset( $size_info[ $size ] ) ) {
                $size_data['width']  = $size_info[ $size ]['width'];
                $size_data['height'] = $size_info[ $size ]['height'];
                $size_data['crop']   = isset( $size_info[ $size ]['crop'] ) ? $size_info[ $size ]['crop'] : false;
            } else {
                $size_data['width']  = get_option( "{$size}_size_w" );
                $size_data['height'] = get_option( "{$size}_size_h" );
                $size_data['crop']   = get_option( "{$size}_crop" );
            }

            $sizes[] = $size_data;
        }

        $sizes[] = array(
            'value'          => 'full',
            'label'          => __( 'Full Size', 'fotogrids' ),
            'is_fotogrids'   => false,
            'is_plugin_size' => false,
            'is_custom_size' => false,
            'is_hidden'      => false,
        );

        return rest_ensure_response( array( 'sizes' => $sizes ) );
    }

    /**
     * Get plugin-wide media settings.
     *
     * GET /wp-json/fotogrids/v1/admin/media-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_media_settings( $request ): \WP_REST_Response {
        $settings     = \FotoGrids\Image_Size_Manager::get_plugin_size_settings();
        $custom_sizes = \FotoGrids\Image_Size_Manager::get_custom_sizes();

        return rest_ensure_response( array(
            'settings'     => $settings,
            'custom_sizes' => array_values( array_map( function( $slug, $config ) {
                return array_merge( [ 'slug' => $slug ], $config );
            }, array_keys( $custom_sizes ), $custom_sizes ) ),
        ) );
    }

    /**
     * Save plugin-wide media settings.
     *
     * POST /wp-json/fotogrids/v1/admin/media-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function save_media_settings( $request ): \WP_REST_Response {
        $raw = array(
            'thumbnail_width'     => $request->get_param( 'thumbnail_width' ),
            'thumbnail_height'    => $request->get_param( 'thumbnail_height' ),
            'thumbnail_crop'      => $request->get_param( 'thumbnail_crop' ),
            'thumbnail_alignment' => $request->get_param( 'thumbnail_alignment' ),
            'full_width'          => $request->get_param( 'full_width' ),
            'full_height'         => $request->get_param( 'full_height' ),
            'masonry_width'       => $request->get_param( 'masonry_width' ),
            'justified_height'    => $request->get_param( 'justified_height' ),
        );

        $saved = \FotoGrids\Image_Size_Manager::save_plugin_size_settings( $raw );

        return rest_ensure_response( array( 'settings' => $saved ) );
    }

    /**
     * Get general (responsiveness) settings.
     *
     * GET /wp-json/fotogrids/v1/admin/general-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_general_settings( $request ): \WP_REST_Response {
        return rest_ensure_response( array(
            'settings' => \FotoGrids\Settings\Plugin_Settings_Store::get_general(),
        ) );
    }

    /**
     * Save general (responsiveness) settings.
     *
     * Delegates to the same sanitizer the Settings API uses, so REST and
     * options.php persist identically (breakpoint clamping included).
     *
     * POST /wp-json/fotogrids/v1/admin/general-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function save_general_settings( $request ): \WP_REST_Response {
        $settings = \FotoGrids\Settings\Plugin_Settings_Store::save_general( array(
            'mobile_breakpoint'            => $request->get_param( 'mobile_breakpoint' ),
            'tablet_breakpoint'            => $request->get_param( 'tablet_breakpoint' ),
            'detect_responsive_by_browser' => $request->get_param( 'detect_responsive_by_browser' ),
        ) );

        return rest_ensure_response( array( 'settings' => $settings ) );
    }

    /**
     * Get the global SEO settings.
     *
     * GET /wp-json/fotogrids/v1/admin/seo-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_seo_settings( $request ): \WP_REST_Response {
        return rest_ensure_response( array(
            'settings' => \FotoGrids\Settings\SEO_Settings_Store::get(),
        ) );
    }

    /**
     * Save the global SEO settings.
     *
     * POST /wp-json/fotogrids/v1/admin/seo-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function save_seo_settings( $request ): \WP_REST_Response {
        $settings = \FotoGrids\Settings\SEO_Settings_Store::save( $request->get_json_params() ?: $request->get_params() );

        return rest_ensure_response( array( 'settings' => $settings ) );
    }

    /**
     * Get the global sharing settings.
     *
     * GET /wp-json/fotogrids/v1/admin/sharing-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_sharing_settings( $request ): \WP_REST_Response {
        return rest_ensure_response( array(
            'settings' => \FotoGrids\Settings\Sharing_Settings_Store::get(),
        ) );
    }

    /**
     * Save the global sharing settings.
     *
     * POST /wp-json/fotogrids/v1/admin/sharing-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function save_sharing_settings( $request ): \WP_REST_Response {
        $settings = \FotoGrids\Settings\Sharing_Settings_Store::save( $request->get_json_params() ?: $request->get_params() );

        return rest_ensure_response( array( 'settings' => $settings ) );
    }

    /**
     * Get the global view page appearance settings.
     *
     * GET /wp-json/fotogrids/v1/admin/view-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_view_settings( $request ): \WP_REST_Response {
        return rest_ensure_response( array(
            'settings' => \FotoGrids\Settings\View_Settings_Store::get(),
        ) );
    }

    /**
     * Save the global view page appearance settings.
     *
     * POST /wp-json/fotogrids/v1/admin/view-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function save_view_settings( $request ): \WP_REST_Response {
        $settings = \FotoGrids\Settings\View_Settings_Store::save( $request->get_json_params() ?: $request->get_params() );

        return rest_ensure_response( array( 'settings' => $settings ) );
    }

    /**
     * Get advanced (boolean) settings.
     *
     * GET /wp-json/fotogrids/v1/admin/advanced-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_advanced_settings( $request ): \WP_REST_Response {
        return rest_ensure_response( array(
            'settings' => \FotoGrids\Settings\Plugin_Settings_Store::get_advanced(),
        ) );
    }

    /**
     * Save advanced (boolean) settings.
     *
     * Each flag is its own top-level option. The uninstall flag is persisted
     * as its inverse (fotogrids_preserve_data_on_uninstall), which is what the
     * uninstaller reads.
     *
     * POST /wp-json/fotogrids/v1/admin/advanced-settings
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function save_advanced_settings( $request ): \WP_REST_Response {
        $settings = \FotoGrids\Settings\Plugin_Settings_Store::save_advanced( array(
            'autosave'                          => $request->get_param( 'autosave' ),
            'share_statistics'                  => $request->get_param( 'share_statistics' ),
            'custom_js_allow_dynamic_execution' => $request->get_param( 'custom_js_allow_dynamic_execution' ),
            'delete_data_on_uninstall'          => $request->get_param( 'delete_data_on_uninstall' ),
        ) );

        return rest_ensure_response( array( 'settings' => $settings ) );
    }

    /**
     * Get regeneration status for all gallery attachments.
     *
     * Returns per-attachment derivative status for fotogrids_thumbnail, fotogrids_full,
     * and any registered custom FotoGrids sizes.
     *
     * GET /wp-json/fotogrids/v1/admin/regen-thumbnails/status
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_regen_thumbnails_status( $request ): \WP_REST_Response {
        global $wpdb;

        // Collect all unique attachment IDs used across FotoGrids galleries.
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $attachment_ids = $wpdb->get_col( "SELECT DISTINCT attachment_id FROM {$table} WHERE attachment_id > 0" );

        $plugin_sizes   = array(
            \FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL,
            \FotoGrids\Image_Size_Manager::SLUG_FULL,
        );
        $custom_sizes   = array_keys( \FotoGrids\Image_Size_Manager::get_custom_sizes() );

        $items = array();
        foreach ( $attachment_ids as $attachment_id ) {
            $attachment_id   = (int) $attachment_id;
            $attachment_post = get_post( $attachment_id );
            if ( ! $attachment_post ) {
                continue;
            }

            $size_statuses = array();
            foreach ( array_merge( $plugin_sizes, $custom_sizes ) as $slug ) {
                $data = image_get_intermediate_size( $attachment_id, $slug );
                $size_statuses[ $slug ] = array(
                    'exists' => ( $data !== false && ! empty( $data['file'] ) ),
                    'width'  => $data['width']  ?? null,
                    'height' => $data['height'] ?? null,
                );
            }

            $items[] = array(
                'attachment_id' => $attachment_id,
                'filename'      => basename( get_attached_file( $attachment_id ) ?: '' ),
                'thumb_url'     => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ) ?: '',
                'sizes'         => $size_statuses,
            );
        }

        return rest_ensure_response( array(
            'items'        => $items,
            'plugin_sizes' => $plugin_sizes,
            'custom_sizes' => $custom_sizes,
        ) );
    }

    /**
     * Regenerate image derivatives for a single attachment.
     *
     * POST /wp-json/fotogrids/v1/admin/regen-thumbnails/regenerate
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function regenerate_attachment( $request ) {
        $attachment_id = (int) $request->get_param( 'attachment_id' );

        $attachment_post = get_post( $attachment_id );
        if ( ! $attachment_post || $attachment_post->post_type !== 'attachment' ) {
            return new \WP_Error(
                'invalid_attachment',
                __( 'Attachment not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        $file = get_attached_file( $attachment_id );
        if ( ! $file || ! file_exists( $file ) ) {
            return new \WP_Error(
                'file_missing',
                __( 'Attachment file not found on disk.', 'fotogrids' ),
                array( 'status' => 422 )
            );
        }

        // Regenerate all derivatives for this attachment.
        $metadata = wp_generate_attachment_metadata( $attachment_id, $file );
        if ( is_wp_error( $metadata ) ) {
            return $metadata;
        }
        wp_update_attachment_metadata( $attachment_id, $metadata );

        // Return updated size statuses.
        $plugin_sizes = array(
            \FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL,
            \FotoGrids\Image_Size_Manager::SLUG_FULL,
        );
        $custom_sizes = array_keys( \FotoGrids\Image_Size_Manager::get_custom_sizes() );
        $size_statuses = array();
        foreach ( array_merge( $plugin_sizes, $custom_sizes ) as $slug ) {
            $data = image_get_intermediate_size( $attachment_id, $slug );
            $size_statuses[ $slug ] = array(
                'exists' => ( $data !== false && ! empty( $data['file'] ) ),
                'width'  => $data['width']  ?? null,
                'height' => $data['height'] ?? null,
            );
        }

        return rest_ensure_response( array(
            'attachment_id' => $attachment_id,
            'sizes'         => $size_statuses,
        ) );
    }

    /**
     * Get Google Fonts family names via a server-side request.
     *
     * @param \WP_REST_Request $request Request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public static function get_google_fonts_families( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        $cache_key = 'fotogrids_google_fonts_families_v1';
        $cached_families = get_transient( $cache_key );

        if ( is_array( $cached_families ) && ! empty( $cached_families ) ) {
            return rest_ensure_response( array( 'families' => array_values( $cached_families ) ) );
        }

        $response = wp_remote_get(
            'https://fonts.google.com/metadata/fonts',
            array(
                'timeout' => 8,
                'redirection' => 3,
            )
        );

        if ( is_wp_error( $response ) ) {
            return new \WP_Error(
                'google_fonts_request_failed',
                __( 'Unable to fetch Google Fonts metadata.', 'fotogrids' ),
                array( 'status' => 502 )
            );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        if ( 200 !== $status_code ) {
            return new \WP_Error(
                'google_fonts_bad_response',
                __( 'Google Fonts metadata endpoint returned an unexpected response.', 'fotogrids' ),
                array( 'status' => 502 )
            );
        }

        $body = (string) wp_remote_retrieve_body( $response );
        $body = preg_replace( "/^\)\]\}'\n?/", '', $body );
        $parsed = json_decode( $body, true );
        $family_metadata = is_array( $parsed ) && isset( $parsed['familyMetadataList'] ) && is_array( $parsed['familyMetadataList'] )
            ? $parsed['familyMetadataList']
            : array();

        $families = array();
        foreach ( $family_metadata as $font_entry ) {
            if ( ! is_array( $font_entry ) || ! isset( $font_entry['family'] ) ) {
                continue;
            }

            $family = trim( (string) $font_entry['family'] );
            if ( '' !== $family ) {
                $families[] = $family;
            }
        }

        $families = array_values( array_unique( $families ) );
        sort( $families, SORT_NATURAL | SORT_FLAG_CASE );

        if ( empty( $families ) ) {
            return new \WP_Error(
                'google_fonts_empty',
                __( 'Google Fonts metadata response was empty.', 'fotogrids' ),
                array( 'status' => 502 )
            );
        }

        set_transient( $cache_key, $families, 12 * HOUR_IN_SECONDS );

        return rest_ensure_response( array( 'families' => $families ) );
    }

    /**
     * Get overview statistics
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_overview_stats( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        global $wpdb;

        $galleries_count = wp_count_posts( 'fotogrids_gallery' )->publish;
        $albums_count = wp_count_posts( 'fotogrids_album' )->publish;

        $items_table = $wpdb->prefix . 'fotogrids_item_meta';
        $items_count = $wpdb->get_var( "SELECT COUNT(*) FROM $items_table" );

        $stats_table = $wpdb->prefix . 'fotogrids_statistics';
        $totals = $wpdb->get_row(
            "SELECT SUM(views) AS views, SUM(shares) AS shares FROM $stats_table",
            ARRAY_A
        );
        $views_count = isset( $totals['views'] ) ? (int) $totals['views'] : 0;
        $shares_count = isset( $totals['shares'] ) ? (int) $totals['shares'] : 0;

        return rest_ensure_response( array(
            'galleries' => (int) $galleries_count,
            'albums' => (int) $albums_count,
            'items' => (int) $items_count,
            'views' => (int) $views_count,
            'shares' => (int) $shares_count,
        ) );
    }

    /**
     * Get views data over time
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_views_data( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        $days = (int) $request->get_param( 'days' );
        if ( $days <= 0 ) {
            $days = 7;
        }

        global $wpdb;
        $daily_table = $wpdb->prefix . 'fotogrids_statistics_daily';

        // Fetch all daily rows within the window in one query, then map to a
        // dense date-keyed array so days with zero views are still represented.
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT viewed_date, SUM(views) AS daily_views
             FROM $daily_table
             WHERE viewed_date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)
               AND viewed_date <= CURDATE()
             GROUP BY viewed_date
             ORDER BY viewed_date ASC",
            $days - 1
        ), ARRAY_A );

        $views_by_date = array();
        foreach ( $rows as $row ) {
            $views_by_date[ $row['viewed_date'] ] = (int) $row['daily_views'];
        }

        $labels = array();
        $data = array();

        for ( $i = $days - 1; $i >= 0; $i-- ) {
            $date = date( 'Y-m-d', strtotime( "-$i days" ) );
            $labels[] = date( 'M j', strtotime( "-$i days" ) );
            $data[] = $views_by_date[ $date ] ?? 0;
        }

        return rest_ensure_response( array(
            'labels' => $labels,
            'data' => $data,
        ) );
    }

    /**
     * Get popular galleries
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_popular_galleries( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        $days = (int) $request->get_param( 'days' );

        global $wpdb;

        if ( $days > 0 ) {
            // Scope to the daily table for the selected period.
            $daily_table = $wpdb->prefix . 'fotogrids_statistics_daily';
            $results = $wpdb->get_results( $wpdb->prepare(
                "SELECT object_id, SUM(views) AS total_views
                 FROM $daily_table
                 WHERE object_type = 'gallery'
                   AND viewed_date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)
                 GROUP BY object_id
                 ORDER BY total_views DESC
                 LIMIT 10",
                $days - 1
            ), ARRAY_A );
        } else {
            $stats_table = $wpdb->prefix . 'fotogrids_statistics';
            $results = $wpdb->get_results(
                "SELECT object_id, SUM(views) AS total_views
                 FROM $stats_table
                 WHERE object_type = 'gallery'
                 GROUP BY object_id
                 ORDER BY total_views DESC
                 LIMIT 10",
                ARRAY_A
            );
        }

        $labels = array();
        $data = array();

        foreach ( $results as $result ) {
            $gallery = get_post( $result['object_id'] );
            if ( $gallery ) {
                $labels[] = $gallery->post_title;
                $data[] = (int) $result['total_views'];
            }
        }

        return rest_ensure_response( array(
            'labels' => $labels,
            'data' => $data,
        ) );
    }

    /**
     * Get recent activity
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_recent_activity( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        $days = (int) $request->get_param( 'days' );

        global $wpdb;
        $stats_table = $wpdb->prefix . 'fotogrids_statistics';

        if ( $days > 0 ) {
            $results = $wpdb->get_results( $wpdb->prepare(
                "SELECT object_type, object_id, views, last_viewed
                 FROM $stats_table
                 WHERE last_viewed >= DATE_SUB(NOW(), INTERVAL %d DAY)
                 ORDER BY last_viewed DESC
                 LIMIT 20",
                $days
            ), ARRAY_A );
        } else {
            $results = $wpdb->get_results(
                "SELECT object_type, object_id, views, last_viewed
                 FROM $stats_table
                 ORDER BY last_viewed DESC
                 LIMIT 20",
                ARRAY_A
            );
        }

        $activity = array();

        foreach ( $results as $result ) {
            $post = get_post( $result['object_id'] );
            if ( $post ) {
                $activity[] = array(
                    'id'          => (int) $result['object_id'],
                    'title'       => $post->post_title,
                    'type'        => $result['object_type'],
                    'views'       => (int) $result['views'],
                    'last_viewed' => human_time_diff( strtotime( $result['last_viewed'] ), current_time( 'timestamp' ) ) . ' ago',
                    'edit_url'    => get_edit_post_link( $post->ID, 'raw' ),
                );
            }
        }

        return rest_ensure_response( $activity );
    }

    /**
     * Get top performing content
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_top_content( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        $days = (int) $request->get_param( 'days' );

        global $wpdb;

        if ( $days > 0 ) {
            $daily_table = $wpdb->prefix . 'fotogrids_statistics_daily';
            $results = $wpdb->get_results( $wpdb->prepare(
                "SELECT object_type, object_id,
                        SUM(views) AS views, SUM(shares) AS shares
                 FROM $daily_table
                 WHERE viewed_date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)
                 GROUP BY object_type, object_id
                 ORDER BY views DESC
                 LIMIT 20",
                $days - 1
            ), ARRAY_A );
        } else {
            $stats_table = $wpdb->prefix . 'fotogrids_statistics';
            $results = $wpdb->get_results(
                "SELECT object_type, object_id, views, shares
                 FROM $stats_table
                 ORDER BY views DESC
                 LIMIT 20",
                ARRAY_A
            );
        }

        $content = array();

        foreach ( $results as $result ) {
            $post = get_post( $result['object_id'] );
            if ( $post ) {
                $content[] = array(
                    'id'       => (int) $result['object_id'],
                    'title'    => $post->post_title,
                    'type'     => $result['object_type'],
                    'views'    => (int) $result['views'],
                    'shares'   => (int) ( $result['shares'] ?: 0 ),
                    'edit_url' => get_edit_post_link( $post->ID, 'raw' ),
                );
            }
        }

        return rest_ensure_response( $content );
    }

    /**
     * Add items to gallery
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function add_items_to_gallery( $request ) {
        $gallery_id = $request->get_param( 'id' );
        $item_ids = $request->get_param( 'item_ids' );

        if ( empty( $item_ids ) || ! is_array( $item_ids ) ) {
            return new \WP_Error(
                'invalid_item_ids',
                __( 'Invalid item IDs provided.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $added = array();
        $errors = array();

        foreach ( $item_ids as $item_id ) {
            $result = fotogrids_add_item_to_gallery( $gallery_id, $item_id );

            if ( $result ) {
                $added[] = $item_id;
            } else {
                $errors[] = $item_id;
            }
        }

        return rest_ensure_response( array(
            'success' => true,
            'added' => $added,
            'errors' => $errors,
            'message' => sprintf(
                _n(
                    '%d item added to gallery.',
                    '%d items added to gallery.',
                    count( $added ),
                    'fotogrids'
                ),
                count( $added )
            )
        ) );
    }

    /**
     * Get gallery preview HTML
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_gallery_preview( $request ) {
        $gallery_id = absint( $request->get_param( 'id' ) );

        if ( ! $gallery_id ) {
            return new \WP_Error(
                'invalid_gallery_id',
                __( 'Invalid gallery ID.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error(
                'gallery_not_found',
                __( 'Gallery not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        if ( ! current_user_can( 'edit_post', $gallery_id ) ) {
            return new \WP_Error(
                'forbidden',
                __( 'Insufficient permissions.', 'fotogrids' ),
                array( 'status' => 403 )
            );
        }

        $atts = array();

        $template = $request->get_param( 'template' );
        if ( $template ) {
            $atts['template'] = sanitize_text_field( $template );
        }

        $cols = absint( $request->get_param( 'cols' ) );
        if ( $cols ) {
            $atts['cols'] = $cols;
        }

        $lazy = $request->get_param( 'lazy' );
        if ( $lazy !== null ) {
            $atts['lazy'] = $lazy ? 'true' : 'false';
        }

        $lightbox = $request->get_param( 'lightbox' );
        if ( $lightbox !== null ) {
            $atts['lightbox'] = $lightbox ? 'true' : 'false';
        }

        $captions = $request->get_param( 'captions' );
        if ( $captions !== null ) {
            $atts['captions'] = $captions ? 'true' : 'false';
        }

        $html = \FotoGrids\Public_Render::render_gallery_preview( $gallery_id, $atts );

        return rest_ensure_response( array(
            'html'       => $html,
            'gallery_id' => $gallery_id,
        ) );
    }

    /**
     * Get recently edited galleries and albums
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_recently_edited( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        $posts = get_posts( array(
            'post_type'      => array( 'fotogrids_gallery', 'fotogrids_album' ),
            'post_status'    => array( 'publish', 'draft' ),
            'posts_per_page' => 10,
            'orderby'        => 'modified',
            'order'          => 'DESC',
        ) );

        $items = array();
        foreach ( $posts as $post ) {
            $items[] = array(
                'id'           => $post->ID,
                'title'        => $post->post_title ?: __( '(no title)', 'fotogrids' ),
                'type'         => $post->post_type,
                'status'       => $post->post_status,
                'modified'     => $post->post_modified,
                'modified_gmt' => $post->post_modified_gmt,
                'edit_url'     => get_edit_post_link( $post->ID, 'raw' ),
            );
        }

        return rest_ensure_response( array( 'items' => $items ) );
    }

    /**
     * Get news and updates
     *
     * @param \WP_REST_Request $request Request object
     * @return \WP_REST_Response|\WP_Error Response object
     */
    public static function get_news_updates( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return new \WP_Error( 'forbidden', __( 'Insufficient permissions', 'fotogrids' ), array( 'status' => 403 ) );
        }

        return rest_ensure_response( array( 'items' => array() ) );
    }

    /**
     * GET /admin/license/status - returns the current license status snapshot.
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_license_status( $request ) {
        return rest_ensure_response( \FotoGrids\License_Manager::status_snapshot() );
    }

    /**
     * POST /admin/license/activate - activates the supplied license key.
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function activate_license( $request ) {
        $license_key = (string) $request->get_param( 'license_key' );

        $result = \FotoGrids\License_Manager::activate( $license_key );

        if ( is_wp_error( $result ) ) {
            return rest_ensure_response( array(
                'success' => false,
                'message' => $result->get_error_message(),
                'code'    => $result->get_error_code(),
                'status'  => \FotoGrids\License_Manager::status_snapshot(),
            ) );
        }

        return rest_ensure_response( array(
            'success' => true,
            'message' => __( 'License activated. Pro features are now available.', 'fotogrids' ),
            'status'  => \FotoGrids\License_Manager::status_snapshot(),
        ) );
    }

    /**
     * POST /admin/license/deactivate - deactivates the current site's license.
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function deactivate_license( $request ) {
        $result = \FotoGrids\License_Manager::deactivate();

        if ( is_wp_error( $result ) ) {
            return rest_ensure_response( array(
                'success' => false,
                'message' => $result->get_error_message(),
                'code'    => $result->get_error_code(),
                'status'  => \FotoGrids\License_Manager::status_snapshot(),
            ) );
        }

        return rest_ensure_response( array(
            'success' => true,
            'message' => __( 'License deactivated.', 'fotogrids' ),
            'status'  => \FotoGrids\License_Manager::status_snapshot(),
        ) );
    }
}
