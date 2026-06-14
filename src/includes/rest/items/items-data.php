<?php
namespace FotoGrids\REST\Items;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Items Data Handler
 *
 * Handles item data for REST API endpoints.
 *
 * @since 1.0.0
 */
class Items_Data {
    
    /**
     * Query items with filters
     *
     * Searches for items based on various criteria including gallery, tags,
     * people, and locations. Supports pagination with limit and offset parameters.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object containing filter parameters
     * @return \WP_REST_Response Array of filtered items with metadata
     */
    public static function query_items( $request ) {
        global $wpdb;
        
        $gallery_id = $request->get_param( 'gallery' );
        $tag = $request->get_param( 'tag' );
        $person = $request->get_param( 'person' );
        $location = $request->get_param( 'location' );
        $limit = (int) $request->get_param( 'limit' );
        $offset = (int) $request->get_param( 'offset' );
        
        $table = $wpdb->prefix . 'fotogrids_item_meta';
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
        
        // $table is $wpdb->prefix.'fotogrids_item_meta' (trusted literal -- WP
        // placeholders cannot bind table identifiers); $where_sql is assembled
        // only from %d placeholders, and every value is bound via the
        // $wpdb->prepare() call below. Custom table, so direct query + no cache.
        // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.Security.DirectDB.UnescapedDBParameter, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $sql = "SELECT * FROM $table $where_sql ORDER BY position ASC LIMIT %d OFFSET %d";
        $query_params[] = $limit;
        $query_params[] = $offset;

        $results = $wpdb->get_results( $wpdb->prepare( $sql, $query_params ), ARRAY_A );
        // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.Security.DirectDB.UnescapedDBParameter, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        
        $items = array();
        foreach ( $results as $row ) {
            $attachment_id = (int) $row['attachment_id'];
            $attachment = get_post( $attachment_id );
            
            if ( $attachment ) {
                $items[] = array(
                    'id' => $attachment_id,
                    'gallery_id' => (int) $row['gallery_id'],
                    'position' => (int) $row['position'],
                    'caption' => $row['caption'],
                    'description' => $row['description'],
                    'location' => $row['location'],
                    'url' => wp_get_attachment_url( $attachment_id ),
                    'sizes' => wp_get_attachment_image_sizes( $attachment_id ),
                    'alt' => get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ),
                );
            }
        }
        
        return rest_ensure_response( array(
            'items' => $items,
            'total' => count( $items ),
            'limit' => $limit,
            'offset' => $offset,
        ) );
    }
}
