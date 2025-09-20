<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Gallery Album Relations Class
 * 
 * Manages many-to-many relationships between galleries and albums
 */
class Gallery_Album_Relations {
    
    /**
     * Table name for gallery-album relationships
     */
    private static $table_name = null;
    
    /**
     * Initialize the class
     */
    public static function init() {
        global $wpdb;
        self::$table_name = $wpdb->prefix . 'fotogrids_gallery_albums';
        
        // Ensure table exists (for existing installations)
        self::ensure_table_exists();
        
        // Create table on activation
        add_action( 'fotogrids_activate', array( __CLASS__, 'create_table' ) );
        
        // Clean up relationships when posts are deleted
        add_action( 'before_delete_post', array( __CLASS__, 'delete_post_relationships' ) );
    }
    
    /**
     * Create the junction table
     */
    public static function create_table() {
        self::ensure_table_exists();
    }
    
    /**
     * Ensure the junction table exists (can be called anytime)
     */
    public static function ensure_table_exists() {
        global $wpdb;
        
        $table_name = self::get_table_name();
        
        // Check if table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table_name'" ) === $table_name;
        
        if ( ! $table_exists ) {
            $charset_collate = $wpdb->get_charset_collate();
            
            $sql = "CREATE TABLE $table_name (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                gallery_id BIGINT UNSIGNED NOT NULL,
                album_id BIGINT UNSIGNED NOT NULL,
                position INT NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY unique_relationship (gallery_id, album_id),
                INDEX (gallery_id),
                INDEX (album_id),
                INDEX (position)
            ) $charset_collate;";
            
            require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
            dbDelta( $sql );
        }
    }
    
    /**
     * Get table name
     */
    private static function get_table_name() {
        if ( self::$table_name === null ) {
            global $wpdb;
            self::$table_name = $wpdb->prefix . 'fotogrids_gallery_albums';
        }
        return self::$table_name;
    }
    
    /**
     * Add gallery to album
     * 
     * @param int $gallery_id Gallery post ID
     * @param int $album_id Album post ID
     * @param int $position Position in album (optional)
     * @return bool|int False on failure, relationship ID on success
     */
    public static function add_gallery_to_album( $gallery_id, $album_id, $position = null ) {
        global $wpdb;
        
        $gallery_id = absint( $gallery_id );
        $album_id = absint( $album_id );
        
        if ( ! $gallery_id || ! $album_id ) {
            return false;
        }
        
        // Verify posts exist and are correct types
        if ( ! self::verify_post_types( $gallery_id, $album_id ) ) {
            return false;
        }
        
        // Check if relationship already exists
        if ( self::relationship_exists( $gallery_id, $album_id ) ) {
            return false;
        }
        
        // If no position specified, add at the end
        if ( $position === null ) {
            $position = self::get_next_position( $album_id );
        }
        
        $table_name = self::get_table_name();
        
        $result = $wpdb->insert(
            $table_name,
            array(
                'gallery_id' => $gallery_id,
                'album_id' => $album_id,
                'position' => $position,
            ),
            array( '%d', '%d', '%d' )
        );
        
        if ( $result === false ) {
            return false;
        }
        
        // Clear caches
        self::clear_caches( $gallery_id, $album_id );
        
        return $wpdb->insert_id;
    }
    
    /**
     * Remove gallery from album
     * 
     * @param int $gallery_id Gallery post ID
     * @param int $album_id Album post ID
     * @return bool Success
     */
    public static function remove_gallery_from_album( $gallery_id, $album_id ) {
        global $wpdb;
        
        $gallery_id = absint( $gallery_id );
        $album_id = absint( $album_id );
        
        if ( ! $gallery_id || ! $album_id ) {
            return false;
        }
        
        $table_name = self::get_table_name();
        
        $result = $wpdb->delete(
            $table_name,
            array(
                'gallery_id' => $gallery_id,
                'album_id' => $album_id,
            ),
            array( '%d', '%d' )
        );
        
        // Clear caches
        self::clear_caches( $gallery_id, $album_id );
        
        return $result !== false;
    }
    
    /**
     * Get galleries for album
     * 
     * @param int $album_id Album post ID
     * @param array $args Query arguments
     * @return array Gallery objects with relationship data
     */
    public static function get_galleries_for_album( $album_id, $args = array() ) {
        global $wpdb;
        
        $album_id = absint( $album_id );
        if ( ! $album_id ) {
            return array();
        }
        
        $defaults = array(
            'orderby' => 'position',
            'order' => 'ASC',
            'include_meta' => true,
        );
        $args = wp_parse_args( $args, $defaults );
        
        $table_name = self::get_table_name();
        
        $order_clause = '';
        if ( $args['orderby'] === 'position' ) {
            $order_clause = 'ORDER BY ga.position ' . $args['order'];
        } elseif ( $args['orderby'] === 'title' ) {
            $order_clause = 'ORDER BY p.post_title ' . $args['order'];
        } elseif ( $args['orderby'] === 'date' ) {
            $order_clause = 'ORDER BY p.post_date ' . $args['order'];
        }
        
        $sql = $wpdb->prepare(
            "SELECT p.*, ga.position, ga.created_at as relationship_created
             FROM {$wpdb->posts} p
             INNER JOIN $table_name ga ON p.ID = ga.gallery_id
             WHERE ga.album_id = %d 
             AND p.post_type = 'fotogrids_gallery'
             AND p.post_status IN ('publish', 'private', 'draft')
             $order_clause",
            $album_id
        );
        
        $galleries = $wpdb->get_results( $sql );
        
        if ( $args['include_meta'] && ! empty( $galleries ) ) {
            foreach ( $galleries as $gallery ) {
                // Add gallery meta
                $gallery->image_count = self::get_gallery_image_count( $gallery->ID );
                $gallery->layout = get_post_meta( $gallery->ID, 'fotogrids_layout', true ) ?: 'grid';
                $gallery->featured_image = get_the_post_thumbnail_url( $gallery->ID, 'thumbnail' );
                $gallery->sample_images = self::get_gallery_sample_images( $gallery->ID, 4 );
            }
        }
        
        return $galleries;
    }
    
    /**
     * Get albums for gallery
     * 
     * @param int $gallery_id Gallery post ID
     * @param array $args Query arguments
     * @return array Album objects with relationship data
     */
    public static function get_albums_for_gallery( $gallery_id, $args = array() ) {
        global $wpdb;
        
        $gallery_id = absint( $gallery_id );
        if ( ! $gallery_id ) {
            return array();
        }
        
        $defaults = array(
            'orderby' => 'title',
            'order' => 'ASC',
            'include_meta' => true,
        );
        $args = wp_parse_args( $args, $defaults );
        
        $table_name = self::get_table_name();
        
        $order_clause = '';
        if ( $args['orderby'] === 'title' ) {
            $order_clause = 'ORDER BY p.post_title ' . $args['order'];
        } elseif ( $args['orderby'] === 'date' ) {
            $order_clause = 'ORDER BY p.post_date ' . $args['order'];
        }
        
        $sql = $wpdb->prepare(
            "SELECT p.*, ga.position, ga.created_at as relationship_created
             FROM {$wpdb->posts} p
             INNER JOIN $table_name ga ON p.ID = ga.album_id
             WHERE ga.gallery_id = %d 
             AND p.post_type = 'fotogrids_album'
             AND p.post_status IN ('publish', 'private', 'draft')
             $order_clause",
            $gallery_id
        );
        
        $albums = $wpdb->get_results( $sql );
        
        if ( $args['include_meta'] && ! empty( $albums ) ) {
            foreach ( $albums as $album ) {
                // Add album meta
                $album->gallery_count = self::get_album_gallery_count( $album->ID );
                $album->featured_image = get_the_post_thumbnail_url( $album->ID, 'thumbnail' );
            }
        }
        
        return $albums;
    }
    
    /**
     * Reorder galleries in album
     * 
     * @param int $album_id Album post ID
     * @param array $gallery_ids Array of gallery IDs in new order
     * @return bool Success
     */
    public static function reorder_galleries_in_album( $album_id, $gallery_ids ) {
        global $wpdb;
        
        $album_id = absint( $album_id );
        if ( ! $album_id || empty( $gallery_ids ) ) {
            return false;
        }
        
        $table_name = self::get_table_name();
        
        // Update positions
        $position = 0;
        foreach ( $gallery_ids as $gallery_id ) {
            $gallery_id = absint( $gallery_id );
            if ( ! $gallery_id ) {
                continue;
            }
            
            $wpdb->update(
                $table_name,
                array( 'position' => $position ),
                array(
                    'gallery_id' => $gallery_id,
                    'album_id' => $album_id,
                ),
                array( '%d' ),
                array( '%d', '%d' )
            );
            
            $position++;
        }
        
        // Clear caches
        self::clear_caches( null, $album_id );
        
        return true;
    }
    
    /**
     * Get all albums (for selection dropdowns)
     * 
     * @param array $args Query arguments
     * @return array Album objects
     */
    public static function get_all_albums( $args = array() ) {
        $defaults = array(
            'post_type' => 'fotogrids_album',
            'post_status' => array( 'publish', 'draft', 'private' ),
            'posts_per_page' => -1,
            'orderby' => 'title',
            'order' => 'ASC',
            's' => '',
        );
        $args = wp_parse_args( $args, $defaults );
        
        $query = new \WP_Query( $args );
        $albums = array();
        
        foreach ( $query->posts as $album ) {
            $albums[] = array(
                'id' => $album->ID,
                'title' => $album->post_title,
                'status' => $album->post_status,
                'gallery_count' => self::get_album_gallery_count( $album->ID ),
                'featured_image' => get_the_post_thumbnail_url( $album->ID, 'thumbnail' ),
            );
        }
        
        return $albums;
    }
    
    /**
     * Get all galleries (for selection dropdowns)
     * 
     * @param array $args Query arguments
     * @return array Gallery objects
     */
    public static function get_all_galleries( $args = array() ) {
        $defaults = array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => array( 'publish', 'draft', 'private' ),
            'posts_per_page' => -1,
            'orderby' => 'title',
            'order' => 'ASC',
            's' => '',
        );
        $args = wp_parse_args( $args, $defaults );
        
        $query = new \WP_Query( $args );
        $galleries = array();
        
        foreach ( $query->posts as $gallery ) {
            $galleries[] = array(
                'id' => $gallery->ID,
                'title' => $gallery->post_title,
                'status' => $gallery->post_status,
                'image_count' => self::get_gallery_image_count( $gallery->ID ),
                'layout' => get_post_meta( $gallery->ID, 'fotogrids_layout', true ) ?: 'grid',
                'featured_image' => get_the_post_thumbnail_url( $gallery->ID, 'thumbnail' ),
                'sample_images' => self::get_gallery_sample_images( $gallery->ID, 4 ),
            );
        }
        
        return $galleries;
    }
    
    /**
     * Check if relationship exists
     * 
     * @param int $gallery_id Gallery post ID
     * @param int $album_id Album post ID
     * @return bool
     */
    private static function relationship_exists( $gallery_id, $album_id ) {
        global $wpdb;
        
        $table_name = self::get_table_name();
        
        $result = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table_name WHERE gallery_id = %d AND album_id = %d",
            $gallery_id,
            $album_id
        ) );
        
        return ! empty( $result );
    }
    
    /**
     * Get next position for album
     * 
     * @param int $album_id Album post ID
     * @return int Next position
     */
    private static function get_next_position( $album_id ) {
        global $wpdb;
        
        $table_name = self::get_table_name();
        
        $max_position = $wpdb->get_var( $wpdb->prepare(
            "SELECT MAX(position) FROM $table_name WHERE album_id = %d",
            $album_id
        ) );
        
        return $max_position ? $max_position + 1 : 0;
    }
    
    /**
     * Verify post types are correct
     * 
     * @param int $gallery_id Gallery post ID
     * @param int $album_id Album post ID
     * @return bool
     */
    private static function verify_post_types( $gallery_id, $album_id ) {
        $gallery = get_post( $gallery_id );
        $album = get_post( $album_id );
        
        return $gallery && $album && 
               $gallery->post_type === 'fotogrids_gallery' && 
               $album->post_type === 'fotogrids_album';
    }
    
    /**
     * Get gallery image count
     * 
     * @param int $gallery_id Gallery post ID
     * @return int Image count
     */
    private static function get_gallery_image_count( $gallery_id ) {
        $gallery_images = get_post_meta( $gallery_id, 'fotogrids_gallery_images', true );
        if ( $gallery_images ) {
            $image_ids = json_decode( $gallery_images, true );
            return is_array( $image_ids ) ? count( $image_ids ) : 0;
        }
        return 0;
    }
    
    /**
     * Get sample images from gallery for display
     * 
     * @param int $gallery_id Gallery post ID
     * @param int $limit Number of sample images to return (default 4)
     * @return array Array of image URLs
     */
    private static function get_gallery_sample_images( $gallery_id, $limit = 4 ) {
        $gallery_images = get_post_meta( $gallery_id, 'fotogrids_gallery_images', true );
        if ( ! $gallery_images ) {
            return array();
        }
        
        $image_ids = json_decode( $gallery_images, true );
        if ( ! is_array( $image_ids ) || empty( $image_ids ) ) {
            return array();
        }
        
        // Get up to $limit images from the gallery
        $sample_image_ids = array_slice( $image_ids, 0, $limit );
        $image_urls = array();
        
        foreach ( $sample_image_ids as $image_id ) {
            $image_id = absint( $image_id );
            if ( $image_id > 0 ) {
                $image_url = wp_get_attachment_image_url( $image_id, 'thumbnail' );
                if ( $image_url ) {
                    $image_urls[] = $image_url;
                }
            }
        }
        
        return $image_urls;
    }
    
    /**
     * Get album gallery count
     * 
     * @param int $album_id Album post ID
     * @return int Gallery count
     */
    private static function get_album_gallery_count( $album_id ) {
        global $wpdb;
        
        $table_name = self::get_table_name();
        
        $count = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $table_name WHERE album_id = %d",
            $album_id
        ) );
        
        return absint( $count );
    }
    
    /**
     * Clear relationship caches
     * 
     * @param int|null $gallery_id Gallery post ID
     * @param int|null $album_id Album post ID
     */
    private static function clear_caches( $gallery_id = null, $album_id = null ) {
        // Clear any caches here if implemented
        // For now, we'll just trigger post cache clearing
        if ( $gallery_id ) {
            clean_post_cache( $gallery_id );
        }
        if ( $album_id ) {
            clean_post_cache( $album_id );
        }
    }
    
    /**
     * Delete all relationships for a post (when post is deleted)
     * 
     * @param int $post_id Post ID
     */
    public static function delete_post_relationships( $post_id ) {
        global $wpdb;
        
        $post = get_post( $post_id );
        if ( ! $post ) {
            return;
        }
        
        $table_name = self::get_table_name();
        
        if ( $post->post_type === 'fotogrids_gallery' ) {
            $wpdb->delete( $table_name, array( 'gallery_id' => $post_id ), array( '%d' ) );
        } elseif ( $post->post_type === 'fotogrids_album' ) {
            $wpdb->delete( $table_name, array( 'album_id' => $post_id ), array( '%d' ) );
        }
    }
}
