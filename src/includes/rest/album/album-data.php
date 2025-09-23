<?php
namespace FotoGrids\REST\Album;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Album Data Handler
 *
 * Handles album data retrieval for REST API endpoints.
 *
 * @since 1.0.0
 */
class Album_Data {
    
    /**
     * Get album data with galleries
     *
     * Retrieves a single album with all its associated galleries and metadata.
     * Only returns published albums. Automatically increments view count.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object containing album ID
     * @return \WP_REST_Response|\WP_Error Album data or error response
     */
    public static function get_album( $request ) {
        $album_id = (int) $request['id'];
        
        $album = get_post( $album_id );
        if ( ! $album || $album->post_type !== 'fotogrids_album' ) {
            return new \WP_Error( 
                'album_not_found', 
                __( 'Album not found', 'fotogrids' ), 
                array( 'status' => 404 ) 
            );
        }
        
        if ( $album->post_status !== 'publish' ) {
            return new \WP_Error( 
                'album_not_published', 
                __( 'Album is not published', 'fotogrids' ), 
                array( 'status' => 403 ) 
            );
        }
        
        $meta = array(
            'layout' => get_post_meta( $album_id, 'fotogrids_album_layout', true ) ?: 'grid',
            'featured_gallery' => (int) get_post_meta( $album_id, 'fotogrids_featured_gallery', true ) ?: null,
        );
        
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
        
        \FotoGrids\Statistics::increment( 'album', $album_id, 'views' );
        
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
     * Get image count for a gallery
     *
     * Returns the total number of images associated with a specific gallery.
     * Used for display purposes and pagination calculations.
     *
     * @since 1.0.0
     * @param int $gallery_id The ID of the gallery to count images for
     * @return int The number of images in the gallery
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
}
