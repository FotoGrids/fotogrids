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
}
