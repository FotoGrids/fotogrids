<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * REST API Class
 * 
 * Handles all REST API endpoints for FotoGrids
 */
class REST {
    
    /**
     * Initialize the class
     */
    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }
    
    /**
     * Register all REST API routes
     */
    public static function register_routes() {
        error_log( 'FotoGrids: Registering REST API routes' );
        // Gallery endpoints
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'preview' => array(
                        'default' => false,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                ),
                'permission_callback' => array( __CLASS__, 'permission_check_gallery_read' ),
            ),
        ) );
        
        // Album endpoints
        register_rest_route( 'fotogrids/v1', '/album/(?P<id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_album' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( __CLASS__, 'permission_check_album_read' ),
            ),
        ) );
        
        // Images query endpoint
        register_rest_route( 'fotogrids/v1', '/images', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'query_images' ),
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
        
        // Statistics endpoints
        register_rest_route( 'fotogrids/v1', '/stats/view', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( __CLASS__, 'increment_view' ),
                'args' => array(
                    'object_type' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                        'validate_callback' => function( $param ) {
                            return in_array( $param, array( 'gallery', 'album', 'image' ) );
                        },
                    ),
                    'object_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
                'permission_callback' => array( __CLASS__, 'permission_check_stats' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/stats/share', array(
            array(
                'methods'  => \WP_REST_Server::CREATABLE,
                'callback' => array( __CLASS__, 'increment_share' ),
                'args' => array(
                    'object_type' => array(
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                        'validate_callback' => function( $param ) {
                            return in_array( $param, array( 'gallery', 'album', 'image' ) );
                        },
                    ),
                    'object_id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'network' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                        'validate_callback' => function( $param ) {
                            return in_array( $param, array( 'facebook', 'twitter', 'pinterest', 'email', 'copy' ) );
                        },
                    ),
                ),
                'permission_callback' => array( __CLASS__, 'permission_check_stats' ),
            ),
        ) );
        
        // Templates endpoint
        register_rest_route( 'fotogrids/v1', '/templates', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_templates' ),
                'permission_callback' => '__return_true',
            ),
        ) );

        // Galleries list endpoint (for Gutenberg block)
        register_rest_route( 'fotogrids/v1', '/galleries', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_galleries_list' ),
                'permission_callback' => array( __CLASS__, 'permission_check_gallery_read' ),
                'args' => array(
                    'per_page' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                    'page' => array(
                        'default' => 1,
                        'sanitize_callback' => 'absint',
                    ),
                    'search' => array(
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
        ) );

        // Gallery images endpoint (for Gutenberg block)
        register_rest_route( 'fotogrids/v1', '/galleries/(?P<id>\d+)/images', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_gallery_images_endpoint' ),
                'permission_callback' => array( __CLASS__, 'permission_check_gallery_read' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'limit' => array(
                        'default' => -1,
                        'sanitize_callback' => 'absint',
                    ),
                    'offset' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ) );
        
        // Admin Gallery CRUD endpoints
        register_rest_route( 'fotogrids/v1', '/admin/galleries', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_galleries_admin' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'search' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'status' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'per_page' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                    'page' => array(
                        'default' => 1,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( __CLASS__, 'create_gallery' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_gallery_admin' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
            array(
                'methods' => 'PUT',
                'callback' => array( __CLASS__, 'update_gallery' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array( __CLASS__, 'delete_gallery' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        // Admin Album CRUD endpoints
        register_rest_route( 'fotogrids/v1', '/admin/albums', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_albums_admin' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'search' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'status' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'per_page' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                    'page' => array(
                        'default' => 1,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( __CLASS__, 'create_album' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_album_admin' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
            array(
                'methods' => 'PUT',
                'callback' => array( __CLASS__, 'update_album' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array( __CLASS__, 'delete_album' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        // Gallery-Album relationship endpoints
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/albums', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_gallery_albums' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( __CLASS__, 'assign_gallery_to_albums' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'album_ids' => array(
                        'required' => true,
                        'type' => 'array',
                        'validate_callback' => function( $param ) {
                            if ( ! is_array( $param ) ) {
                                return false;
                            }
                            foreach ( $param as $id ) {
                                if ( ! is_numeric( $id ) || intval( $id ) <= 0 ) {
                                    return false;
                                }
                            }
                            return true;
                        },
                        'sanitize_callback' => function( $param ) {
                            return array_map( 'intval', $param );
                        },
                    ),
                ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/galleries/(?P<id>\d+)/albums/(?P<album_id>\d+)', array(
            array(
                'methods' => 'DELETE',
                'callback' => array( __CLASS__, 'remove_gallery_from_album' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_album_galleries' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( __CLASS__, 'assign_galleries_to_album' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'gallery_ids' => array(
                        'required' => true,
                        'type' => 'array',
                        'items' => array( 'type' => 'integer' ),
                    ),
                ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries/(?P<gallery_id>\d+)', array(
            array(
                'methods' => 'DELETE',
                'callback' => array( __CLASS__, 'remove_album_from_gallery' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/albums/(?P<id>\d+)/galleries/reorder', array(
            array(
                'methods' => 'PUT',
                'callback' => array( __CLASS__, 'reorder_album_galleries' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'gallery_ids' => array(
                        'required' => true,
                        'type' => 'array',
                        'items' => array( 'type' => 'integer' ),
                    ),
                ),
            ),
        ) );
        
        // Selection endpoints for dropdowns
        register_rest_route( 'fotogrids/v1', '/admin/albums/all', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_all_albums_for_selection' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'search' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/galleries/all', array(
            array(
                'methods' => 'GET',
                'callback' => array( __CLASS__, 'get_all_galleries_for_selection' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'search' => array(
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'exclude_album' => array(
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ) );
        
        // Admin Stats endpoints
        register_rest_route( 'fotogrids/v1', '/admin/stats/overview', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_stats_overview' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/stats/views', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_views_data' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
                'args' => array(
                    'days' => array(
                        'default' => 7,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/stats/popular-galleries', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_popular_galleries' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/stats/recent-activity', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_recent_activity' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
        
        register_rest_route( 'fotogrids/v1', '/admin/stats/top-content', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( __CLASS__, 'get_top_content' ),
                'permission_callback' => array( __CLASS__, 'permission_check_admin' ),
            ),
        ) );
    }
    
    /**
     * Get gallery data with images
     */
    public static function get_gallery( $request ) {
        $gallery_id = (int) $request['id'];
        $is_preview = (bool) $request['preview'];
        
        // Get gallery post
        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error( 
                'gallery_not_found', 
                __( 'Gallery not found', 'fotogrids' ), 
                array( 'status' => 404 ) 
            );
        }
        
        // Check if gallery is published (unless preview mode)
        if ( ! $is_preview && $gallery->post_status !== 'publish' ) {
            return new \WP_Error( 
                'gallery_not_published', 
                __( 'Gallery is not published', 'fotogrids' ), 
                array( 'status' => 403 ) 
            );
        }
        
        // Get gallery meta
        $meta = array(
            'layout' => get_post_meta( $gallery_id, 'fotogrids_layout', true ) ?: 'grid',
            'columns' => (int) get_post_meta( $gallery_id, 'fotogrids_columns', true ) ?: 3,
            'album_id' => (int) get_post_meta( $gallery_id, 'fotogrids_album_id', true ) ?: null,
        );
        
        // Get gallery images
        $images = self::get_gallery_images( $gallery_id );
        
        // Increment view count (unless preview mode)
        if ( ! $is_preview ) {
            Statistics::increment( 'gallery', $gallery_id, 'views' );
        }
        
        return rest_ensure_response( array(
            'id' => $gallery->ID,
            'title' => $gallery->post_title,
            'description' => $gallery->post_content,
            'meta' => $meta,
            'images' => $images,
            'shortcode' => '[fotogrids_gallery id="' . $gallery_id . '"]',
        ) );
    }
    
    /**
     * Get album data with galleries
     */
    public static function get_album( $request ) {
        $album_id = (int) $request['id'];
        
        // Get album post
        $album = get_post( $album_id );
        if ( ! $album || $album->post_type !== 'fotogrids_album' ) {
            return new \WP_Error( 
                'album_not_found', 
                __( 'Album not found', 'fotogrids' ), 
                array( 'status' => 404 ) 
            );
        }
        
        // Check if album is published
        if ( $album->post_status !== 'publish' ) {
            return new \WP_Error( 
                'album_not_published', 
                __( 'Album is not published', 'fotogrids' ), 
                array( 'status' => 403 ) 
            );
        }
        
        // Get album meta
        $meta = array(
            'layout' => get_post_meta( $album_id, 'fotogrids_album_layout', true ) ?: 'grid',
            'featured_gallery' => (int) get_post_meta( $album_id, 'fotogrids_featured_gallery', true ) ?: null,
        );
        
        // Get galleries in this album
        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => 'publish',
            'numberposts' => -1,
            'meta_query' => array(
                array(
                    'key' => 'fotogrids_album_id',
                    'value' => $album_id,
                    'compare' => '=',
                ),
            ),
        ) );
        
        $gallery_data = array();
        foreach ( $galleries as $gallery ) {
            $gallery_data[] = array(
                'id' => $gallery->ID,
                'title' => $gallery->post_title,
                'description' => $gallery->post_content,
                'thumbnail' => get_the_post_thumbnail_url( $gallery->ID, 'medium' ),
                'image_count' => self::get_gallery_image_count( $gallery->ID ),
            );
        }
        
        // Increment view count
        Statistics::increment( 'album', $album_id, 'views' );
        
        return rest_ensure_response( array(
            'id' => $album->ID,
            'title' => $album->post_title,
            'description' => $album->post_content,
            'meta' => $meta,
            'galleries' => $gallery_data,
            'shortcode' => '[fotogrids_album id="' . $album_id . '"]',
        ) );
    }
    
    /**
     * Query images with filters
     */
    public static function query_images( $request ) {
        global $wpdb;
        
        $gallery_id = $request->get_param( 'gallery' );
        $tag = $request->get_param( 'tag' );
        $person = $request->get_param( 'person' );
        $location = $request->get_param( 'location' );
        $limit = (int) $request->get_param( 'limit' );
        $offset = (int) $request->get_param( 'offset' );
        
        // Start building query
        $table = $wpdb->prefix . 'fotogrids_image_meta';
        $where_conditions = array();
        $query_params = array();
        
        // Filter by gallery
        if ( $gallery_id ) {
            $where_conditions[] = 'gallery_id = %d';
            $query_params[] = $gallery_id;
        }
        
        // Build WHERE clause
        $where_sql = '';
        if ( ! empty( $where_conditions ) ) {
            $where_sql = 'WHERE ' . implode( ' AND ', $where_conditions );
        }
        
        // Build full query
        $sql = "SELECT * FROM $table $where_sql ORDER BY position ASC LIMIT %d OFFSET %d";
        $query_params[] = $limit;
        $query_params[] = $offset;
        
        $results = $wpdb->get_results( $wpdb->prepare( $sql, $query_params ), ARRAY_A );
        
        // Process results to include attachment data
        $images = array();
        foreach ( $results as $row ) {
            $attachment_id = (int) $row['attachment_id'];
            $attachment = get_post( $attachment_id );
            
            if ( $attachment ) {
                $images[] = array(
                    'id' => $attachment_id,
                    'gallery_id' => (int) $row['gallery_id'],
                    'position' => (int) $row['position'],
                    'caption' => $row['caption'],
                    'description' => $row['description'],
                    'location' => $row['location'],
                    'url' => wp_get_attachment_url( $attachment_id ),
                    'sizes' => wp_get_attachment_image_sizes( $attachment_id ),
                    'alt' => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
                );
            }
        }
        
        return rest_ensure_response( array(
            'images' => $images,
            'total' => count( $images ),
            'limit' => $limit,
            'offset' => $offset,
        ) );
    }
    
    /**
     * Increment view count
     */
    public static function increment_view( $request ) {
        $object_type = $request->get_param( 'object_type' );
        $object_id = (int) $request->get_param( 'object_id' );
        
        $result = Statistics::increment( $object_type, $object_id, 'views' );
        
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
     */
    public static function increment_share( $request ) {
        $object_type = $request->get_param( 'object_type' );
        $object_id = (int) $request->get_param( 'object_id' );
        $network = $request->get_param( 'network' );
        
        $result = Statistics::increment( $object_type, $object_id, 'shares' );
        
        if ( ! $result ) {
            return new \WP_Error( 
                'stats_update_failed', 
                __( 'Failed to update statistics', 'fotogrids' ), 
                array( 'status' => 500 ) 
            );
        }
        
        // Log the specific network if provided
        if ( $network ) {
            do_action( 'fotogrids_share_tracked', $object_type, $object_id, $network );
        }
        
        return rest_ensure_response( array( 'success' => true ) );
    }
    
    /**
     * Get available templates
     */
    public static function get_templates( $request ) {
        // Basic templates (always available)
        $templates = array(
            array(
                'id' => 'grid',
                'name' => __( 'Grid', 'fotogrids' ),
                'description' => __( 'Simple grid layout', 'fotogrids' ),
                'type' => 'free',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/grid.jpg',
            ),
            array(
                'id' => 'masonry',
                'name' => __( 'Masonry', 'fotogrids' ),
                'description' => __( 'Pinterest-style masonry layout', 'fotogrids' ),
                'type' => 'free',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/masonry.jpg',
            ),
            array(
                'id' => 'justified',
                'name' => __( 'Justified', 'fotogrids' ),
                'description' => __( 'Justified grid with equal heights', 'fotogrids' ),
                'type' => 'free',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/justified.jpg',
            ),
        );
        
        // Pro templates (check license)
        $pro_templates = array(
            array(
                'id' => 'slider',
                'name' => __( 'Slider', 'fotogrids' ),
                'description' => __( 'Image slider with navigation', 'fotogrids' ),
                'type' => 'starter',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/slider.jpg',
            ),
            array(
                'id' => 'polaroid',
                'name' => __( 'Polaroid', 'fotogrids' ),
                'description' => __( 'Polaroid-style photo layout', 'fotogrids' ),
                'type' => 'starter',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/polaroid.jpg',
            ),
        );
        
        // Add pro templates based on license
        // TODO: Implement license checking
        $templates = array_merge( $templates, $pro_templates );
        
        return rest_ensure_response( array( 'templates' => $templates ) );
    }
    
    /**
     * Permission check for reading galleries
     */
    public static function permission_check_gallery_read( $request ) {
        // Allow public access for published galleries
        return true;
    }
    
    /**
     * Permission check for reading albums
     */
    public static function permission_check_album_read( $request ) {
        // Allow public access for published albums
        return true;
    }
    
    /**
     * Permission check for statistics endpoints
     */
    public static function permission_check_stats( $request ) {
        // Allow unauthenticated users to track stats
        // TODO: Add rate limiting and nonce validation
        return true;
    }
    
    /**
     * Get images for a specific gallery
     */
    private static function get_gallery_images( $gallery_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_image_meta';
        $results = $wpdb->get_results( 
            $wpdb->prepare( 
                "SELECT * FROM $table WHERE gallery_id = %d ORDER BY position ASC", 
                $gallery_id 
            ), 
            ARRAY_A 
        );
        
        $images = array();
        foreach ( $results as $row ) {
            $attachment_id = (int) $row['attachment_id'];
            $attachment = get_post( $attachment_id );
            
            if ( $attachment ) {
                $images[] = array(
                    'id' => $attachment_id,
                    'position' => (int) $row['position'],
                    'caption' => $row['caption'],
                    'description' => $row['description'],
                    'location' => $row['location'],
                    'url' => wp_get_attachment_url( $attachment_id ),
                    'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
                    'medium' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
                    'large' => wp_get_attachment_image_url( $attachment_id, 'large' ),
                    'full' => wp_get_attachment_url( $attachment_id ),
                    'alt' => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
                );
            }
        }
        
        return $images;
    }
    
    /**
     * Get image count for a gallery
     */
    private static function get_gallery_image_count( $gallery_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_image_meta';
        return (int) $wpdb->get_var( 
            $wpdb->prepare( 
                "SELECT COUNT(*) FROM $table WHERE gallery_id = %d", 
                $gallery_id 
            ) 
        );
    }

    /**
     * Get galleries list (for Gutenberg block)
     */
    public static function get_galleries_list( $request ) {
        $per_page = (int) $request['per_page'];
        $page = (int) $request['page'];
        $search = $request['search'];

        $args = array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => 'publish',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
        );

        if ( ! empty( $search ) ) {
            $args['s'] = $search;
        }

        $query = new \WP_Query( $args );
        $galleries = array();

        foreach ( $query->posts as $post ) {
            $image_count = self::get_gallery_image_count( $post->ID );
            $featured_image = get_the_post_thumbnail_url( $post->ID, 'medium' );

            $galleries[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'image_count' => $image_count,
                'featured_image' => $featured_image ?: null,
                'created' => $post->post_date,
                'modified' => $post->post_modified,
            );
        }

        return rest_ensure_response( $galleries );
    }

    /**
     * Get gallery images endpoint (for Gutenberg block)
     */
    public static function get_gallery_images_endpoint( $request ) {
        $gallery_id = (int) $request['id'];
        $limit = (int) $request['limit'];
        $offset = (int) $request['offset'];

        // Verify gallery exists
        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found.', 'fotogrids' ), array( 'status' => 404 ) );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_image_meta';
        
        // Build query
        $sql = "SELECT * FROM $table WHERE gallery_id = %d ORDER BY position ASC";
        $params = array( $gallery_id );

        if ( $limit > 0 ) {
            $sql .= " LIMIT %d";
            $params[] = $limit;

            if ( $offset > 0 ) {
                $sql .= " OFFSET %d";
                $params[] = $offset;
            }
        }

        $results = $wpdb->get_results( 
            $wpdb->prepare( $sql, $params ), 
            ARRAY_A 
        );

        $images = array();
        foreach ( $results as $row ) {
            $attachment_id = (int) $row['attachment_id'];
            $attachment = get_post( $attachment_id );

            if ( $attachment ) {
                $images[] = array(
                    'id' => $attachment_id,
                    'position' => (int) $row['position'],
                    'caption' => $row['caption'],
                    'description' => $row['description'],
                    'url' => wp_get_attachment_url( $attachment_id ),
                    'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
                    'medium' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
                    'large' => wp_get_attachment_image_url( $attachment_id, 'large' ),
                    'full' => wp_get_attachment_url( $attachment_id ),
                    'alt' => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
                    'title' => $attachment->post_title,
                );
            }
        }

        return rest_ensure_response( $images );
    }
    
    /**
     * Admin permission check
     */
    public static function permission_check_admin( $request ) {
        $can_edit = current_user_can( 'edit_posts' );
        error_log( 'FotoGrids REST permission check: ' . ( $can_edit ? 'ALLOWED' : 'DENIED' ) );
        return $can_edit;
    }
    
    /**
     * Get galleries for admin interface
     */
    public static function get_galleries_admin( $request ) {
        $search = $request->get_param( 'search' );
        $status = $request->get_param( 'status' );
        $per_page = $request->get_param( 'per_page' );
        $page = $request->get_param( 'page' );
        
        $args = array(
            'post_type' => 'fotogrids_gallery',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
        );
        
        if ( $search ) {
            $args['s'] = $search;
        }
        
        if ( $status && $status !== 'all' ) {
            $args['post_status'] = $status;
        } else {
            $args['post_status'] = array( 'publish', 'draft', 'private' );
        }
        
        $query = new \WP_Query( $args );
        $galleries = array();
        
        foreach ( $query->posts as $post ) {
            $gallery_images = get_post_meta( $post->ID, 'fotogrids_gallery_images', true );
            $image_count = $gallery_images ? count( json_decode( $gallery_images, true ) ) : 0;
            
            $layout = get_post_meta( $post->ID, 'fotogrids_layout', true ) ?: 'grid';
            $views = get_post_meta( $post->ID, 'fotogrids_views', true ) ?: 0;
            
            $galleries[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'status' => $post->post_status,
                'created' => $post->post_date,
                'modified' => $post->post_modified,
                'images' => $image_count,
                'layout' => $layout,
                'views' => (int) $views,
            );
        }
        
        return rest_ensure_response( array(
            'galleries' => $galleries,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
        ) );
    }
    
    /**
     * Get single gallery for admin editing
     */
    public static function get_gallery_admin( $request ) {
        $gallery_id = (int) $request['id'];
        $gallery = get_post( $gallery_id );
        
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $gallery_images = get_post_meta( $gallery_id, 'fotogrids_gallery_images', true );
        $image_ids = $gallery_images ? json_decode( $gallery_images, true ) : array();
        
        $data = array(
            'id' => $gallery->ID,
            'title' => $gallery->post_title,
            'content' => $gallery->post_content,
            'status' => $gallery->post_status,
            'layout' => get_post_meta( $gallery_id, 'fotogrids_layout', true ) ?: 'grid',
            'columns' => get_post_meta( $gallery_id, 'fotogrids_columns', true ) ?: 3,
            'lightbox' => get_post_meta( $gallery_id, 'fotogrids_lightbox', true ) === '1',
            'captions' => get_post_meta( $gallery_id, 'fotogrids_captions', true ) === '1',
            'lazy' => get_post_meta( $gallery_id, 'fotogrids_lazy', true ) === '1',
            'image_ids' => $image_ids,
        );
        
        return rest_ensure_response( $data );
    }
    
    /**
     * Create new gallery
     */
    public static function create_gallery( $request ) {
        $title = sanitize_text_field( $request->get_param( 'title' ) );
        $content = wp_kses_post( $request->get_param( 'content' ) );
        $status = sanitize_text_field( $request->get_param( 'status' ) ) ?: 'draft';
        
        if ( empty( $title ) ) {
            return new \WP_Error( 'missing_title', __( 'Gallery title is required', 'fotogrids' ), array( 'status' => 400 ) );
        }
        
        $post_data = array(
            'post_title' => $title,
            'post_content' => $content,
            'post_status' => $status,
            'post_type' => 'fotogrids_gallery',
        );
        
        $gallery_id = wp_insert_post( $post_data );
        
        if ( is_wp_error( $gallery_id ) ) {
            return $gallery_id;
        }
        
        // Set default meta values
        update_post_meta( $gallery_id, 'fotogrids_layout', $request->get_param( 'layout' ) ?: 'grid' );
        update_post_meta( $gallery_id, 'fotogrids_columns', $request->get_param( 'columns' ) ?: 3 );
        update_post_meta( $gallery_id, 'fotogrids_lightbox', $request->get_param( 'lightbox' ) ? '1' : '0' );
        update_post_meta( $gallery_id, 'fotogrids_captions', $request->get_param( 'captions' ) ? '1' : '0' );
        update_post_meta( $gallery_id, 'fotogrids_lazy', $request->get_param( 'lazy' ) ? '1' : '0' );
        
        if ( $request->get_param( 'image_ids' ) ) {
            update_post_meta( $gallery_id, 'fotogrids_gallery_images', json_encode( $request->get_param( 'image_ids' ) ) );
        }
        
        return rest_ensure_response( array( 'id' => $gallery_id, 'message' => __( 'Gallery created successfully', 'fotogrids' ) ) );
    }
    
    /**
     * Update gallery
     */
    public static function update_gallery( $request ) {
        $gallery_id = (int) $request['id'];
        $gallery = get_post( $gallery_id );
        
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $post_data = array( 'ID' => $gallery_id );
        
        if ( $request->get_param( 'title' ) ) {
            $post_data['post_title'] = sanitize_text_field( $request->get_param( 'title' ) );
        }
        
        if ( $request->get_param( 'content' ) ) {
            $post_data['post_content'] = wp_kses_post( $request->get_param( 'content' ) );
        }
        
        if ( $request->get_param( 'status' ) ) {
            $post_data['post_status'] = sanitize_text_field( $request->get_param( 'status' ) );
        }
        
        $result = wp_update_post( $post_data );
        
        if ( is_wp_error( $result ) ) {
            return $result;
        }
        
        // Update meta fields
        $meta_fields = array( 'layout', 'columns', 'lightbox', 'captions', 'lazy' );
        foreach ( $meta_fields as $field ) {
            if ( $request->get_param( $field ) !== null ) {
                $value = $field === 'columns' ? absint( $request->get_param( $field ) ) : $request->get_param( $field );
                if ( in_array( $field, array( 'lightbox', 'captions', 'lazy' ) ) ) {
                    $value = $value ? '1' : '0';
                }
                update_post_meta( $gallery_id, "fotogrids_$field", $value );
            }
        }
        
        if ( $request->get_param( 'image_ids' ) !== null ) {
            update_post_meta( $gallery_id, 'fotogrids_gallery_images', json_encode( $request->get_param( 'image_ids' ) ) );
        }
        
        return rest_ensure_response( array( 'message' => __( 'Gallery updated successfully', 'fotogrids' ) ) );
    }
    
    /**
     * Delete gallery
     */
    public static function delete_gallery( $request ) {
        $gallery_id = (int) $request['id'];
        $gallery = get_post( $gallery_id );
        
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $result = wp_delete_post( $gallery_id, true );
        
        if ( ! $result ) {
            return new \WP_Error( 'delete_failed', __( 'Failed to delete gallery', 'fotogrids' ), array( 'status' => 500 ) );
        }
        
        return rest_ensure_response( array( 'message' => __( 'Gallery deleted successfully', 'fotogrids' ) ) );
    }
    
    /**
     * Get albums for admin interface
     */
    public static function get_albums_admin( $request ) {
        $search = $request->get_param( 'search' );
        $status = $request->get_param( 'status' );
        $per_page = $request->get_param( 'per_page' );
        $page = $request->get_param( 'page' );
        
        $args = array(
            'post_type' => 'fotogrids_album',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
        );
        
        if ( $search ) {
            $args['s'] = $search;
        }
        
        if ( $status && $status !== 'all' ) {
            $args['post_status'] = $status;
        } else {
            $args['post_status'] = array( 'publish', 'draft', 'private' );
        }
        
        $query = new \WP_Query( $args );
        $albums = array();
        
        foreach ( $query->posts as $post ) {
            $album_galleries = get_post_meta( $post->ID, 'fotogrids_album_galleries', true );
            $gallery_count = $album_galleries ? count( explode( ',', $album_galleries ) ) : 0;
            
            $views = get_post_meta( $post->ID, 'fotogrids_views', true ) ?: 0;
            
            $albums[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'status' => $post->post_status,
                'created' => $post->post_date,
                'modified' => $post->post_modified,
                'galleries' => $gallery_count,
                'views' => (int) $views,
            );
        }
        
        return rest_ensure_response( array(
            'albums' => $albums,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
        ) );
    }
    
    /**
     * Get single album for admin editing
     */
    public static function get_album_admin( $request ) {
        $album_id = (int) $request['id'];
        $album = get_post( $album_id );
        
        if ( ! $album || $album->post_type !== 'fotogrids_album' ) {
            return new \WP_Error( 'album_not_found', __( 'Album not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $album_galleries = get_post_meta( $album_id, 'fotogrids_album_galleries', true );
        $gallery_ids = $album_galleries ? explode( ',', $album_galleries ) : array();
        
        $data = array(
            'id' => $album->ID,
            'title' => $album->post_title,
            'content' => $album->post_content,
            'status' => $album->post_status,
            'layout' => get_post_meta( $album_id, 'fotogrids_album_layout', true ) ?: 'grid',
            'gallery_ids' => array_map( 'intval', $gallery_ids ),
        );
        
        return rest_ensure_response( $data );
    }
    
    /**
     * Create new album
     */
    public static function create_album( $request ) {
        $title = sanitize_text_field( $request->get_param( 'title' ) );
        $content = wp_kses_post( $request->get_param( 'content' ) );
        $status = sanitize_text_field( $request->get_param( 'status' ) ) ?: 'draft';
        
        if ( empty( $title ) ) {
            return new \WP_Error( 'missing_title', __( 'Album title is required', 'fotogrids' ), array( 'status' => 400 ) );
        }
        
        $post_data = array(
            'post_title' => $title,
            'post_content' => $content,
            'post_status' => $status,
            'post_type' => 'fotogrids_album',
        );
        
        $album_id = wp_insert_post( $post_data );
        
        if ( is_wp_error( $album_id ) ) {
            return $album_id;
        }
        
        // Set default meta values
        update_post_meta( $album_id, 'fotogrids_album_layout', $request->get_param( 'layout' ) ?: 'grid' );
        
        if ( $request->get_param( 'gallery_ids' ) ) {
            update_post_meta( $album_id, 'fotogrids_album_galleries', implode( ',', $request->get_param( 'gallery_ids' ) ) );
        }
        
        return rest_ensure_response( array( 'id' => $album_id, 'message' => __( 'Album created successfully', 'fotogrids' ) ) );
    }
    
    /**
     * Update album
     */
    public static function update_album( $request ) {
        $album_id = (int) $request['id'];
        $album = get_post( $album_id );
        
        if ( ! $album || $album->post_type !== 'fotogrids_album' ) {
            return new \WP_Error( 'album_not_found', __( 'Album not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $post_data = array( 'ID' => $album_id );
        
        if ( $request->get_param( 'title' ) ) {
            $post_data['post_title'] = sanitize_text_field( $request->get_param( 'title' ) );
        }
        
        if ( $request->get_param( 'content' ) ) {
            $post_data['post_content'] = wp_kses_post( $request->get_param( 'content' ) );
        }
        
        if ( $request->get_param( 'status' ) ) {
            $post_data['post_status'] = sanitize_text_field( $request->get_param( 'status' ) );
        }
        
        $result = wp_update_post( $post_data );
        
        if ( is_wp_error( $result ) ) {
            return $result;
        }
        
        // Update meta fields
        if ( $request->get_param( 'layout' ) !== null ) {
            update_post_meta( $album_id, 'fotogrids_album_layout', $request->get_param( 'layout' ) );
        }
        
        if ( $request->get_param( 'gallery_ids' ) !== null ) {
            update_post_meta( $album_id, 'fotogrids_album_galleries', implode( ',', $request->get_param( 'gallery_ids' ) ) );
        }
        
        return rest_ensure_response( array( 'message' => __( 'Album updated successfully', 'fotogrids' ) ) );
    }
    
    /**
     * Delete album
     */
    public static function delete_album( $request ) {
        $album_id = (int) $request['id'];
        $album = get_post( $album_id );
        
        if ( ! $album || $album->post_type !== 'fotogrids_album' ) {
            return new \WP_Error( 'album_not_found', __( 'Album not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $result = wp_delete_post( $album_id, true );
        
        if ( ! $result ) {
            return new \WP_Error( 'delete_failed', __( 'Failed to delete album', 'fotogrids' ), array( 'status' => 500 ) );
        }
        
        return rest_ensure_response( array( 'message' => __( 'Album deleted successfully', 'fotogrids' ) ) );
    }
    
    // ===== GALLERY-ALBUM RELATIONSHIP METHODS =====
    
    /**
     * Get albums assigned to a gallery
     */
    public static function get_gallery_albums( $request ) {
        $gallery_id = (int) $request['id'];
        
        if ( ! get_post( $gallery_id ) || get_post_type( $gallery_id ) !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $albums = \FotoGrids\Gallery_Album_Relations::get_albums_for_gallery( $gallery_id );
        
        return rest_ensure_response( array( 'albums' => $albums ) );
    }
    
    /**
     * Assign gallery to multiple albums
     */
    public static function assign_gallery_to_albums( $request ) {
        $gallery_id = (int) $request['id'];
        $album_ids = $request->get_param( 'album_ids' );
        
        error_log( 'FotoGrids assign_gallery_to_albums: gallery_id=' . $gallery_id . ', album_ids=' . print_r( $album_ids, true ) );
        
        if ( ! get_post( $gallery_id ) || get_post_type( $gallery_id ) !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        if ( ! is_array( $album_ids ) ) {
            error_log( 'FotoGrids: album_ids is not an array: ' . gettype( $album_ids ) . ' = ' . print_r( $album_ids, true ) );
            return new \WP_Error( 'invalid_album_ids', __( 'Album IDs must be an array', 'fotogrids' ), array( 'status' => 400 ) );
        }
        
        $success_count = 0;
        $errors = array();
        
        foreach ( $album_ids as $album_id ) {
            $album_id = absint( $album_id );
            if ( ! $album_id ) {
                continue;
            }
            
            if ( ! get_post( $album_id ) || get_post_type( $album_id ) !== 'fotogrids_album' ) {
                $errors[] = sprintf( __( 'Album %d not found', 'fotogrids' ), $album_id );
                continue;
            }
            
            $result = \FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, $album_id );
            if ( $result ) {
                $success_count++;
            }
        }
        
        $message = sprintf( 
            _n( 
                'Gallery assigned to %d album successfully', 
                'Gallery assigned to %d albums successfully', 
                $success_count, 
                'fotogrids' 
            ), 
            $success_count 
        );
        
        $response = array( 
            'message' => $message,
            'assigned_count' => $success_count,
        );
        
        if ( ! empty( $errors ) ) {
            $response['errors'] = $errors;
        }
        
        return rest_ensure_response( $response );
    }
    
    /**
     * Remove gallery from album
     */
    public static function remove_gallery_from_album( $request ) {
        $gallery_id = (int) $request['id'];
        $album_id = (int) $request['album_id'];
        
        if ( ! get_post( $gallery_id ) || get_post_type( $gallery_id ) !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        if ( ! get_post( $album_id ) || get_post_type( $album_id ) !== 'fotogrids_album' ) {
            return new \WP_Error( 'album_not_found', __( 'Album not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $result = \FotoGrids\Gallery_Album_Relations::remove_gallery_from_album( $gallery_id, $album_id );
        
        if ( ! $result ) {
            return new \WP_Error( 'removal_failed', __( 'Failed to remove gallery from album', 'fotogrids' ), array( 'status' => 500 ) );
        }
        
        return rest_ensure_response( array( 'message' => __( 'Gallery removed from album successfully', 'fotogrids' ) ) );
    }
    
    /**
     * Get galleries assigned to an album
     */
    public static function get_album_galleries( $request ) {
        $album_id = (int) $request['id'];
        
        if ( ! get_post( $album_id ) || get_post_type( $album_id ) !== 'fotogrids_album' ) {
            return new \WP_Error( 'album_not_found', __( 'Album not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        $galleries = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $album_id );
        
        return rest_ensure_response( array( 'galleries' => $galleries ) );
    }
    
    /**
     * Assign multiple galleries to album
     */
    public static function assign_galleries_to_album( $request ) {
        error_log( 'FotoGrids: assign_galleries_to_album called' );
        $album_id = (int) $request['id'];
        $gallery_ids = $request->get_param( 'gallery_ids' );
        
        if ( ! get_post( $album_id ) || get_post_type( $album_id ) !== 'fotogrids_album' ) {
            return new \WP_Error( 'album_not_found', __( 'Album not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        if ( ! is_array( $gallery_ids ) ) {
            return new \WP_Error( 'invalid_gallery_ids', __( 'Gallery IDs must be an array', 'fotogrids' ), array( 'status' => 400 ) );
        }
        
        $success_count = 0;
        $errors = array();
        
        foreach ( $gallery_ids as $gallery_id ) {
            $gallery_id = absint( $gallery_id );
            if ( ! $gallery_id ) {
                continue;
            }
            
            if ( ! get_post( $gallery_id ) || get_post_type( $gallery_id ) !== 'fotogrids_gallery' ) {
                $errors[] = sprintf( __( 'Gallery %d not found', 'fotogrids' ), $gallery_id );
                continue;
            }
            
            $result = \FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, $album_id );
            if ( $result ) {
                $success_count++;
            }
        }
        
        $message = sprintf( 
            _n( 
                '%d gallery assigned to album successfully', 
                '%d galleries assigned to album successfully', 
                $success_count, 
                'fotogrids' 
            ), 
            $success_count 
        );
        
        $response = array( 
            'message' => $message,
            'assigned_count' => $success_count,
        );
        
        if ( ! empty( $errors ) ) {
            $response['errors'] = $errors;
        }
        
        return rest_ensure_response( $response );
    }
    
    /**
     * Remove album from gallery (same as remove_gallery_from_album but different endpoint)
     */
    public static function remove_album_from_gallery( $request ) {
        $album_id = (int) $request['id'];
        $gallery_id = (int) $request['gallery_id'];
        
        return self::remove_gallery_from_album( array(
            'id' => $gallery_id,
            'album_id' => $album_id,
        ) );
    }
    
    /**
     * Reorder galleries in album
     */
    public static function reorder_album_galleries( $request ) {
        $album_id = (int) $request['id'];
        $gallery_ids = $request->get_param( 'gallery_ids' );
        
        if ( ! get_post( $album_id ) || get_post_type( $album_id ) !== 'fotogrids_album' ) {
            return new \WP_Error( 'album_not_found', __( 'Album not found', 'fotogrids' ), array( 'status' => 404 ) );
        }
        
        if ( ! is_array( $gallery_ids ) ) {
            return new \WP_Error( 'invalid_gallery_ids', __( 'Gallery IDs must be an array', 'fotogrids' ), array( 'status' => 400 ) );
        }
        
        $result = \FotoGrids\Gallery_Album_Relations::reorder_galleries_in_album( $album_id, $gallery_ids );
        
        if ( ! $result ) {
            return new \WP_Error( 'reorder_failed', __( 'Failed to reorder galleries', 'fotogrids' ), array( 'status' => 500 ) );
        }
        
        return rest_ensure_response( array( 'message' => __( 'Galleries reordered successfully', 'fotogrids' ) ) );
    }
    
    /**
     * Get all albums for selection dropdowns
     */
    public static function get_all_albums_for_selection( $request ) {
        $search = $request->get_param( 'search' );
        
        $args = array();
        if ( $search ) {
            $args['s'] = $search;
        }
        
        $albums = \FotoGrids\Gallery_Album_Relations::get_all_albums( $args );
        
        return rest_ensure_response( array( 'albums' => $albums ) );
    }
    
    /**
     * Get all galleries for selection dropdowns
     */
    public static function get_all_galleries_for_selection( $request ) {
        $search = $request->get_param( 'search' );
        $exclude_album = $request->get_param( 'exclude_album' );
        
        $args = array();
        if ( $search ) {
            $args['s'] = $search;
        }
        
        $galleries = \FotoGrids\Gallery_Album_Relations::get_all_galleries( $args );
        
        // If exclude_album is specified, remove galleries already in that album
        if ( $exclude_album ) {
            $album_galleries = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $exclude_album );
            $album_gallery_ids = array_map( function( $gallery ) {
                return $gallery->ID;
            }, $album_galleries );
            
            $galleries = array_filter( $galleries, function( $gallery ) use ( $album_gallery_ids ) {
                return ! in_array( $gallery['id'], $album_gallery_ids );
            } );
        }
        
        return rest_ensure_response( array( 'galleries' => array_values( $galleries ) ) );
    }
    
    /**
     * Get stats overview data
     */
    public static function get_stats_overview( $request ) {
        // Count galleries
        $galleries_count = wp_count_posts( 'fotogrids_gallery' );
        $total_galleries = $galleries_count->publish + $galleries_count->draft + $galleries_count->private;
        
        // Count albums
        $albums_count = wp_count_posts( 'fotogrids_album' );
        $total_albums = $albums_count->publish + $albums_count->draft + $albums_count->private;
        
        // Count total images across all galleries
        $total_images = 0;
        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => array( 'publish', 'draft', 'private' ),
            'numberposts' => -1,
        ) );
        
        foreach ( $galleries as $gallery ) {
            $images_meta = get_post_meta( $gallery->ID, 'fotogrids_gallery_images', true );
            if ( $images_meta ) {
                $images = json_decode( $images_meta, true );
                if ( is_array( $images ) ) {
                    $total_images += count( $images );
                }
            }
        }
        
        // Get total views (placeholder - would come from statistics table)
        $total_views = 0; // TODO: Implement actual view counting
        
        return rest_ensure_response( array(
            'galleries' => $total_galleries,
            'albums' => $total_albums,
            'images' => $total_images,
            'views' => $total_views,
        ) );
    }
    
    /**
     * Get views data for chart
     */
    public static function get_views_data( $request ) {
        $days = $request->get_param( 'days' ) ?: 7;
        
        // Generate placeholder data for now
        $labels = array();
        $data = array();
        
        for ( $i = $days - 1; $i >= 0; $i-- ) {
            $date = date( 'M j', strtotime( "-{$i} days" ) );
            $labels[] = $date;
            $data[] = rand( 0, 50 ); // Placeholder data
        }
        
        return rest_ensure_response( array(
            'labels' => $labels,
            'data' => $data,
        ) );
    }
    
    /**
     * Get popular galleries data
     */
    public static function get_popular_galleries( $request ) {
        // Get published galleries
        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => 'publish',
            'numberposts' => 5,
            'orderby' => 'date',
            'order' => 'DESC',
        ) );
        
        $labels = array();
        $data = array();
        
        foreach ( $galleries as $gallery ) {
            $labels[] = $gallery->post_title;
            $data[] = rand( 10, 100 ); // Placeholder data
        }
        
        return rest_ensure_response( array(
            'labels' => $labels,
            'data' => $data,
        ) );
    }
    
    /**
     * Get recent activity data
     */
    public static function get_recent_activity( $request ) {
        $activities = array();
        
        // Get recent galleries
        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => 'publish',
            'numberposts' => 5,
            'orderby' => 'modified',
            'order' => 'DESC',
        ) );
        
        foreach ( $galleries as $gallery ) {
            $activities[] = array(
                'title' => $gallery->post_title,
                'type' => 'gallery',
                'views' => rand( 5, 50 ), // Placeholder
                'last_viewed' => human_time_diff( strtotime( $gallery->post_modified ) ) . ' ago',
            );
        }
        
        // Get recent albums
        $albums = get_posts( array(
            'post_type' => 'fotogrids_album',
            'post_status' => 'publish',
            'numberposts' => 3,
            'orderby' => 'modified',
            'order' => 'DESC',
        ) );
        
        foreach ( $albums as $album ) {
            $activities[] = array(
                'title' => $album->post_title,
                'type' => 'album',
                'views' => rand( 3, 30 ), // Placeholder
                'last_viewed' => human_time_diff( strtotime( $album->post_modified ) ) . ' ago',
            );
        }
        
        // Sort by views (descending)
        usort( $activities, function( $a, $b ) {
            return $b['views'] - $a['views'];
        } );
        
        return rest_ensure_response( array_slice( $activities, 0, 8 ) );
    }
    
    /**
     * Get top performing content
     */
    public static function get_top_content( $request ) {
        $content = array();
        
        // Get galleries
        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => 'publish',
            'numberposts' => 5,
        ) );
        
        foreach ( $galleries as $gallery ) {
            $content[] = array(
                'title' => $gallery->post_title,
                'type' => 'gallery',
                'views' => rand( 20, 200 ), // Placeholder
                'shares' => rand( 0, 20 ), // Placeholder
            );
        }
        
        // Get albums
        $albums = get_posts( array(
            'post_type' => 'fotogrids_album',
            'post_status' => 'publish',
            'numberposts' => 3,
        ) );
        
        foreach ( $albums as $album ) {
            $content[] = array(
                'title' => $album->post_title,
                'type' => 'album',
                'views' => rand( 15, 150 ), // Placeholder
                'shares' => rand( 0, 15 ), // Placeholder
            );
        }
        
        // Sort by views (descending)
        usort( $content, function( $a, $b ) {
            return $b['views'] - $a['views'];
        } );
        
        return rest_ensure_response( array_slice( $content, 0, 10 ) );
    }
}
