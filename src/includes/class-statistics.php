<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Statistics Class
 * 
 * Handles statistics tracking and management for FotoGrids
 */
class Statistics {
    
    /**
     * Increment a statistic counter
     * 
     * @param string $object_type Type of object (gallery, album, image)
     * @param int $object_id ID of the object
     * @param string $field Field to increment (views, shares)
     * @param int $amount Amount to increment by
     * @return bool Success status
     */
    public static function increment( $object_type, $object_id, $field = 'views', $amount = 1 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_statistics';
        
        // Validate parameters
        if ( ! in_array( $object_type, array( 'gallery', 'album', 'image' ) ) ) {
            return false;
        }
        
        if ( ! in_array( $field, array( 'views', 'shares' ) ) ) {
            return false;
        }
        
        $object_id = (int) $object_id;
        $amount = (int) $amount;
        
        if ( $object_id <= 0 || $amount <= 0 ) {
            return false;
        }
        
        // Try to update existing record first
        $updated = $wpdb->query( $wpdb->prepare(
            "UPDATE $table 
             SET $field = $field + %d, 
                 last_viewed = NOW(), 
                 updated_at = NOW() 
             WHERE object_type = %s AND object_id = %d",
            $amount, $object_type, $object_id
        ) );
        
        if ( $updated === false ) {
            return false;
        }
        
        // If no rows were updated, insert a new record
        if ( $updated === 0 ) {
            $data = array(
                'object_type' => $object_type,
                'object_id' => $object_id,
                'views' => ( $field === 'views' ) ? $amount : 0,
                'shares' => ( $field === 'shares' ) ? $amount : 0,
                'last_viewed' => current_time( 'mysql', true ),
                'created_at' => current_time( 'mysql', true ),
                'updated_at' => current_time( 'mysql', true ),
            );
            
            $inserted = $wpdb->insert(
                $table,
                $data,
                array( '%s', '%d', '%d', '%d', '%s', '%s', '%s' )
            );
            
            return $inserted !== false;
        }
        
        return true;
    }
    
    /**
     * Get statistics for a specific object
     * 
     * @param string $object_type Type of object
     * @param int $object_id ID of the object
     * @return array|null Statistics data or null if not found
     */
    public static function get( $object_type, $object_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_statistics';
        
        $result = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM $table WHERE object_type = %s AND object_id = %d",
            $object_type, $object_id
        ), ARRAY_A );
        
        if ( $result ) {
            return array(
                'views' => (int) $result['views'],
                'shares' => (int) $result['shares'],
                'last_viewed' => $result['last_viewed'],
                'created_at' => $result['created_at'],
                'updated_at' => $result['updated_at'],
            );
        }
        
        return null;
    }
    
    /**
     * Get top performing objects by views
     * 
     * @param string $object_type Type of object
     * @param int $limit Number of results to return
     * @param int $days Number of days to look back (0 for all time)
     * @return array Array of objects with statistics
     */
    public static function get_top_by_views( $object_type, $limit = 10, $days = 0 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_statistics';
        $limit = (int) $limit;
        
        $where_date = '';
        $params = array( $object_type );
        
        if ( $days > 0 ) {
            $where_date = ' AND last_viewed >= DATE_SUB(NOW(), INTERVAL %d DAY)';
            $params[] = $days;
        }
        
        $params[] = $limit;
        
        $sql = "SELECT object_id, views, shares, last_viewed 
                FROM $table 
                WHERE object_type = %s $where_date 
                ORDER BY views DESC 
                LIMIT %d";
        
        $results = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
        
        // Enrich with object data
        $enriched = array();
        foreach ( $results as $row ) {
            $object_data = self::get_object_data( $object_type, $row['object_id'] );
            if ( $object_data ) {
                $enriched[] = array_merge( $row, $object_data );
            }
        }
        
        return $enriched;
    }
    
    /**
     * Get top performing objects by shares
     * 
     * @param string $object_type Type of object
     * @param int $limit Number of results to return
     * @param int $days Number of days to look back (0 for all time)
     * @return array Array of objects with statistics
     */
    public static function get_top_by_shares( $object_type, $limit = 10, $days = 0 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_statistics';
        $limit = (int) $limit;
        
        $where_date = '';
        $params = array( $object_type );
        
        if ( $days > 0 ) {
            $where_date = ' AND last_viewed >= DATE_SUB(NOW(), INTERVAL %d DAY)';
            $params[] = $days;
        }
        
        $params[] = $limit;
        
        $sql = "SELECT object_id, views, shares, last_viewed 
                FROM $table 
                WHERE object_type = %s $where_date 
                ORDER BY shares DESC 
                LIMIT %d";
        
        $results = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
        
        // Enrich with object data
        $enriched = array();
        foreach ( $results as $row ) {
            $object_data = self::get_object_data( $object_type, $row['object_id'] );
            if ( $object_data ) {
                $enriched[] = array_merge( $row, $object_data );
            }
        }
        
        return $enriched;
    }
    
    /**
     * Get total statistics
     * 
     * @return array Total views and shares across all objects
     */
    public static function get_totals() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_statistics';
        
        $result = $wpdb->get_row(
            "SELECT 
                SUM(views) as total_views, 
                SUM(shares) as total_shares,
                COUNT(DISTINCT object_id) as total_objects
             FROM $table",
            ARRAY_A
        );
        
        return array(
            'total_views' => (int) $result['total_views'],
            'total_shares' => (int) $result['total_shares'],
            'total_objects' => (int) $result['total_objects'],
        );
    }
    
    /**
     * Get statistics over time
     * 
     * @param string $object_type Type of object
     * @param int $object_id Specific object ID (optional)
     * @param int $days Number of days to look back
     * @return array Time series data
     */
    public static function get_time_series( $object_type, $object_id = null, $days = 30 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_statistics';
        
        $where_conditions = array( 'object_type = %s' );
        $params = array( $object_type );
        
        if ( $object_id ) {
            $where_conditions[] = 'object_id = %d';
            $params[] = $object_id;
        }
        
        $where_conditions[] = 'last_viewed >= DATE_SUB(NOW(), INTERVAL %d DAY)';
        $params[] = $days;
        
        $where_sql = implode( ' AND ', $where_conditions );
        
        $sql = "SELECT 
                    DATE(last_viewed) as date,
                    SUM(views) as daily_views,
                    SUM(shares) as daily_shares
                FROM $table 
                WHERE $where_sql
                GROUP BY DATE(last_viewed)
                ORDER BY date ASC";
        
        return $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
    }
    
    /**
     * Clean up old statistics data
     * 
     * @param int $days Number of days to keep (older data will be deleted)
     * @return int Number of rows deleted
     */
    public static function cleanup_old_data( $days = 365 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_statistics';
        
        $deleted = $wpdb->query( $wpdb->prepare(
            "DELETE FROM $table WHERE last_viewed < DATE_SUB(NOW(), INTERVAL %d DAY)",
            $days
        ) );
        
        return $deleted;
    }
    
    /**
     * Get object data based on type and ID
     * 
     * @param string $object_type Type of object
     * @param int $object_id ID of the object
     * @return array|null Object data or null if not found
     */
    private static function get_object_data( $object_type, $object_id ) {
        switch ( $object_type ) {
            case 'gallery':
                $post = get_post( $object_id );
                if ( $post && $post->post_type === 'fotogrids_gallery' ) {
                    return array(
                        'title' => $post->post_title,
                        'url' => get_permalink( $post->ID ),
                        'thumbnail' => get_the_post_thumbnail_url( $post->ID, 'thumbnail' ),
                    );
                }
                break;
                
            case 'album':
                $post = get_post( $object_id );
                if ( $post && $post->post_type === 'fotogrids_album' ) {
                    return array(
                        'title' => $post->post_title,
                        'url' => get_permalink( $post->ID ),
                        'thumbnail' => get_the_post_thumbnail_url( $post->ID, 'thumbnail' ),
                    );
                }
                break;
                
            case 'image':
                $attachment = get_post( $object_id );
                if ( $attachment && $attachment->post_type === 'attachment' ) {
                    return array(
                        'title' => $attachment->post_title,
                        'url' => wp_get_attachment_url( $object_id ),
                        'thumbnail' => wp_get_attachment_image_url( $object_id, 'thumbnail' ),
                    );
                }
                break;
        }
        
        return null;
    }
    
    /**
     * Initialize scheduled cleanup
     */
    public static function init_cleanup_schedule() {
        if ( ! wp_next_scheduled( 'fotogrids_stats_cleanup' ) ) {
            wp_schedule_event( time(), 'weekly', 'fotogrids_stats_cleanup' );
        }
    }
    
    /**
     * Run scheduled cleanup
     */
    public static function run_scheduled_cleanup() {
        // Keep 1 year of data by default
        $days_to_keep = apply_filters( 'fotogrids_stats_retention_days', 365 );
        self::cleanup_old_data( $days_to_keep );
    }
}

// Schedule cleanup
add_action( 'init', array( 'FotoGrids\Statistics', 'init_cleanup_schedule' ) );
add_action( 'fotogrids_stats_cleanup', array( 'FotoGrids\Statistics', 'run_scheduled_cleanup' ) );
