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

        $sizes = array();
        $intermediate_sizes = get_intermediate_image_sizes();

        foreach ( $intermediate_sizes as $size ) {
            $size_data = array(
                'value' => $size,
                'label' => ucfirst( str_replace( array( '-', '_' ), ' ', $size ) ),
            );

            $size_info = wp_get_additional_image_sizes();
            if ( isset( $size_info[ $size ] ) ) {
                $size_data['width'] = $size_info[ $size ]['width'];
                $size_data['height'] = $size_info[ $size ]['height'];
                $size_data['crop'] = isset( $size_info[ $size ]['crop'] ) ? $size_info[ $size ]['crop'] : false;
            } else {
                $size_data['width'] = get_option( "{$size}_size_w" );
                $size_data['height'] = get_option( "{$size}_size_h" );
                $size_data['crop'] = get_option( "{$size}_crop" );
            }

            $sizes[] = $size_data;
        }

        $sizes[] = array(
            'value' => 'full',
            'label' => __( 'Full Size', 'fotogrids' ),
        );

        return rest_ensure_response( array( 'sizes' => $sizes ) );
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

        $items_table = $wpdb->prefix . 'fotogrids_items';
        $items_count = $wpdb->get_var( "SELECT COUNT(*) FROM $items_table" );

        $stats_table = $wpdb->prefix . 'fotogrids_statistics';
        $views_count = $wpdb->get_var( "SELECT SUM(views) FROM $stats_table" );
        if ( ! $views_count ) {
            $views_count = 0;
        }

        return rest_ensure_response( array(
            'galleries' => (int) $galleries_count,
            'albums' => (int) $albums_count,
            'items' => (int) $items_count,
            'views' => (int) $views_count,
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
        $stats_table = $wpdb->prefix . 'fotogrids_statistics';

        $labels = array();
        $data = array();

        for ( $i = $days - 1; $i >= 0; $i-- ) {
            $date = date( 'Y-m-d', strtotime( "-$i days" ) );
            $views = $wpdb->get_var( $wpdb->prepare(
                "SELECT SUM(views) FROM $stats_table WHERE DATE(last_viewed) = %s",
                $date
            ) );

            $labels[] = date( 'M j', strtotime( "-$i days" ) );
            $data[] = (int) ( $views ? $views : 0 );
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

        global $wpdb;
        $stats_table = $wpdb->prefix . 'fotogrids_statistics';

        $results = $wpdb->get_results(
            "SELECT object_id, SUM(views) as total_views
             FROM $stats_table
             WHERE object_type = 'gallery'
             GROUP BY object_id
             ORDER BY total_views DESC
             LIMIT 10",
            ARRAY_A
        );

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

        global $wpdb;
        $stats_table = $wpdb->prefix . 'fotogrids_statistics';

        $results = $wpdb->get_results(
            "SELECT object_type, object_id, views, last_viewed
             FROM $stats_table
             ORDER BY last_viewed DESC
             LIMIT 20",
            ARRAY_A
        );

        $activity = array();

        foreach ( $results as $result ) {
            $post = get_post( $result['object_id'] );
            if ( $post ) {
                $activity[] = array(
                    'title' => $post->post_title,
                    'type' => $result['object_type'],
                    'views' => (int) $result['views'],
                    'last_viewed' => human_time_diff( strtotime( $result['last_viewed'] ), current_time( 'timestamp' ) ) . ' ago',
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

        global $wpdb;
        $stats_table = $wpdb->prefix . 'fotogrids_statistics';

        $results = $wpdb->get_results(
            "SELECT object_type, object_id, views, shares
             FROM $stats_table
             ORDER BY views DESC
             LIMIT 20",
            ARRAY_A
        );

        $content = array();

        foreach ( $results as $result ) {
            $post = get_post( $result['object_id'] );
            if ( $post ) {
                $content[] = array(
                    'title' => $post->post_title,
                    'type' => $result['object_type'],
                    'views' => (int) $result['views'],
                    'shares' => (int) ( $result['shares'] ? $result['shares'] : 0 ),
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
     * GET /admin/license/status — returns the current license status snapshot.
     *
     * @since  1.0.0
     * @param  \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_license_status( $request ) {
        return rest_ensure_response( \FotoGrids\License_Manager::status_snapshot() );
    }

    /**
     * POST /admin/license/activate — activates the supplied license key.
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
     * POST /admin/license/deactivate — deactivates the current site's license.
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
