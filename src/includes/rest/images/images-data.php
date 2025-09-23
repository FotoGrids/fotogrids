<?php
namespace FotoGrids\REST\Images;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Images Data Handler
 *
 * Handles image data for REST API endpoints.
 *
 * @since 1.0.0
 */
class Images_Data {
    
    /**
     * Query images with filters
     *
     * Searches for images based on various criteria including gallery, tags,
     * people, and locations. Supports pagination with limit and offset parameters.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object containing filter parameters
     * @return \WP_REST_Response Array of filtered images with metadata
     */
    public static function query_images( $request ) {
        global $wpdb;
        
        $gallery_id = $request->get_param( 'gallery' );
        $tag = $request->get_param( 'tag' );
        $person = $request->get_param( 'person' );
        $location = $request->get_param( 'location' );
        $limit = (int) $request->get_param( 'limit' );
        $offset = (int) $request->get_param( 'offset' );
        
        $table = $wpdb->prefix . 'fotogrids_image_meta';
        $where_conditions = array();
        $query_params = array();
        
        if ( $gallery_id ) {
            $where_conditions[] = 'gallery_id = %d';
            $query_params[] = $gallery_id;
        }
        
        $where_sql = '';
        if ( ! empty( $where_conditions ) ) {
            $where_sql = 'WHERE ' . implode( ' AND ', $where_conditions );
        }
        
        $sql = "SELECT * FROM $table $where_sql ORDER BY position ASC LIMIT %d OFFSET %d";
        $query_params[] = $limit;
        $query_params[] = $offset;
        
        $results = $wpdb->get_results( $wpdb->prepare( $sql, $query_params ), ARRAY_A );
        
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
}
