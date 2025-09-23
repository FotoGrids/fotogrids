<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Metadata Manager Class
 * 
 * Handles reusable metadata (tags, people, locations) for images
 */
class Metadata_Manager {
   
    /**
     * Get tags with optional search and limit
     */
    public static function get_tags( $search = '', $limit = 20 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_tags';
        $sql = "SELECT * FROM {$table}";
        $params = array();
        
        if ( ! empty( $search ) ) {
            $sql .= " WHERE name LIKE %s";
            $params[] = '%' . $wpdb->esc_like( $search ) . '%';
        }
        
        $sql .= " ORDER BY usage_count DESC, name ASC LIMIT %d";
        $params[] = absint( $limit );
        
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, $params );
        }
        
        return $wpdb->get_results( $sql );
    }
    
    /**
     * Get people with optional search and limit
     */
    public static function get_people( $search = '', $limit = 20 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_people';
        $sql = "SELECT * FROM {$table}";
        $params = array();
        
        if ( ! empty( $search ) ) {
            $sql .= " WHERE name LIKE %s";
            $params[] = '%' . $wpdb->esc_like( $search ) . '%';
        }
        
        $sql .= " ORDER BY usage_count DESC, name ASC LIMIT %d";
        $params[] = absint( $limit );
        
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, $params );
        }
        
        return $wpdb->get_results( $sql );
    }
    
    /**
     * Get locations with optional search and limit
     */
    public static function get_locations( $search = '', $limit = 20 ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_locations';
        $sql = "SELECT * FROM {$table}";
        $params = array();
        
        if ( ! empty( $search ) ) {
            $sql .= " WHERE name LIKE %s";
            $params[] = '%' . $wpdb->esc_like( $search ) . '%';
        }
        
        $sql .= " ORDER BY usage_count DESC, name ASC LIMIT %d";
        $params[] = absint( $limit );
        
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, $params );
        }
        
        return $wpdb->get_results( $sql );
    }
    
    /**
     * Add or get existing tag
     */
    public static function add_or_get_tag( $name ) {
        global $wpdb;
        
        $name = trim( $name );
        if ( empty( $name ) ) {
            return false;
        }
        
        $slug = sanitize_title( $name );
        $table = $wpdb->prefix . 'fotogrids_tags';
        
        $existing = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table} WHERE LOWER(name) = LOWER(%s) OR slug = %s",
            $name,
            $slug
        ) );
        
        if ( $existing ) {
            return $existing;
        }
        
        $result = $wpdb->insert(
            $table,
            array(
                'name' => $name,
                'slug' => $slug,
                'usage_count' => 0,
                'created_at' => current_time( 'mysql' )
            ),
            array( '%s', '%s', '%d', '%s' )
        );
        
        if ( $result ) {
            return $wpdb->get_row( $wpdb->prepare(
                "SELECT * FROM {$table} WHERE id = %d",
                $wpdb->insert_id
            ) );
        }
        
        return false;
    }
    
    /**
     * Add or get existing person
     */
    public static function add_or_get_person( $name, $details = '' ) {
        global $wpdb;
        
        $name = trim( $name );
        if ( empty( $name ) ) {
            return false;
        }
        
        $table = $wpdb->prefix . 'fotogrids_people';
        
        $existing = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table} WHERE LOWER(name) = LOWER(%s)",
            $name
        ) );
        
        if ( $existing ) {
            if ( ! empty( $details ) && $existing->details !== $details ) {
                $wpdb->update(
                    $table,
                    array( 'details' => $details ),
                    array( 'id' => $existing->id ),
                    array( '%s' ),
                    array( '%d' )
                );
                $existing->details = $details;
            }
            return $existing;
        }
        
        $result = $wpdb->insert(
            $table,
            array(
                'name' => $name,
                'details' => $details,
                'usage_count' => 0,
                'created_at' => current_time( 'mysql' )
            ),
            array( '%s', '%s', '%d', '%s' )
        );
        
        if ( $result ) {
            return $wpdb->get_row( $wpdb->prepare(
                "SELECT * FROM {$table} WHERE id = %d",
                $wpdb->insert_id
            ) );
        }
        
        return false;
    }
    
    /**
     * Add or get existing location
     */
    public static function add_or_get_location( $name, $latitude = null, $longitude = null ) {
        global $wpdb;
        
        $name = trim( $name );
        if ( empty( $name ) ) {
            return false;
        }
        
        $table = $wpdb->prefix . 'fotogrids_locations';
        
        $existing = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table} WHERE LOWER(name) = LOWER(%s)",
            $name
        ) );
        
        if ( $existing ) {
            $update_data = array();
            $update_format = array();
            
            if ( $latitude !== null && $existing->latitude != $latitude ) {
                $update_data['latitude'] = $latitude;
                $update_format[] = '%f';
            }
            
            if ( $longitude !== null && $existing->longitude != $longitude ) {
                $update_data['longitude'] = $longitude;
                $update_format[] = '%f';
            }
            
            if ( ! empty( $update_data ) ) {
                $wpdb->update(
                    $table,
                    $update_data,
                    array( 'id' => $existing->id ),
                    $update_format,
                    array( '%d' )
                );
                
                $existing = $wpdb->get_row( $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE id = %d",
                    $existing->id
                ) );
            }
            
            return $existing;
        }
        
        $result = $wpdb->insert(
            $table,
            array(
                'name' => $name,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'usage_count' => 0,
                'created_at' => current_time( 'mysql' )
            ),
            array( '%s', '%f', '%f', '%d', '%s' )
        );
        
        if ( $result ) {
            return $wpdb->get_row( $wpdb->prepare(
                "SELECT * FROM {$table} WHERE id = %d",
                $wpdb->insert_id
            ) );
        }
        
        return false;
    }
    
    /**
     * Add tag to image
     */
    public static function add_tag_to_image( $attachment_id, $tag_name ) {
        $tag = self::add_or_get_tag( $tag_name );
        if ( ! $tag ) {
            return false;
        }
        
        $result = self::add_metadata_relationship( $attachment_id, 'tag', $tag->id );
        if ( $result ) {
            self::increment_usage_count( 'tag', $tag->id );
        }
        
        return $result;
    }
    
    /**
     * Add person to image
     */
    public static function add_person_to_image( $attachment_id, $person_name, $details = '' ) {
        $person = self::add_or_get_person( $person_name, $details );
        if ( ! $person ) {
            return false;
        }
        
        $result = self::add_metadata_relationship( $attachment_id, 'person', $person->id );
        if ( $result ) {
            self::increment_usage_count( 'person', $person->id );
        }
        
        return $result;
    }
    
    /**
     * Add location to image
     */
    public static function add_location_to_image( $attachment_id, $location_name, $latitude = null, $longitude = null ) {
        $location = self::add_or_get_location( $location_name, $latitude, $longitude );
        if ( ! $location ) {
            return false;
        }
        
        $result = self::add_metadata_relationship( $attachment_id, 'location', $location->id );
        if ( $result ) {
            self::increment_usage_count( 'location', $location->id );
        }
        
        return $result;
    }
    
    /**
     * Add metadata relationship
     */
    private static function add_metadata_relationship( $attachment_id, $type, $metadata_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_image_metadata';
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$table} WHERE attachment_id = %d AND metadata_type = %s AND metadata_id = %d",
            $attachment_id,
            $type,
            $metadata_id
        ) );
        
        if ( $existing ) {
            return true;
        }
        
        return $wpdb->insert(
            $table,
            array(
                'attachment_id' => $attachment_id,
                'metadata_type' => $type,
                'metadata_id' => $metadata_id,
                'created_at' => current_time( 'mysql' )
            ),
            array( '%d', '%s', '%d', '%s' )
        );
    }
    
    /**
     * Remove metadata from image
     */
    public static function remove_metadata_from_image( $attachment_id, $type, $metadata_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_image_metadata';
        
        $result = $wpdb->delete(
            $table,
            array(
                'attachment_id' => $attachment_id,
                'metadata_type' => $type,
                'metadata_id' => $metadata_id
            ),
            array( '%d', '%s', '%d' )
        );
        
        if ( $result ) {
            self::decrement_usage_count( $type, $metadata_id );
        }
        
        return $result;
    }
    
    /**
     * Get all metadata for an image
     */
    public static function get_image_metadata( $attachment_id ) {
        global $wpdb;
        
        $metadata_table = $wpdb->prefix . 'fotogrids_image_metadata';
        $tags_table = $wpdb->prefix . 'fotogrids_tags';
        $people_table = $wpdb->prefix . 'fotogrids_people';
        $locations_table = $wpdb->prefix . 'fotogrids_locations';
        
        $result = array(
            'tags' => array(),
            'people' => array(),
            'locations' => array()
        );
        
        $tags = $wpdb->get_results( $wpdb->prepare(
            "SELECT t.* FROM {$tags_table} t 
             INNER JOIN {$metadata_table} m ON t.id = m.metadata_id 
             WHERE m.attachment_id = %d AND m.metadata_type = 'tag'
             ORDER BY t.name ASC",
            $attachment_id
        ) );
        
        if ( $tags ) {
            $result['tags'] = $tags;
        }
        
        $people = $wpdb->get_results( $wpdb->prepare(
            "SELECT p.* FROM {$people_table} p 
             INNER JOIN {$metadata_table} m ON p.id = m.metadata_id 
             WHERE m.attachment_id = %d AND m.metadata_type = 'person'
             ORDER BY p.name ASC",
            $attachment_id
        ) );
        
        if ( $people ) {
            $result['people'] = $people;
        }
        
        $locations = $wpdb->get_results( $wpdb->prepare(
            "SELECT l.* FROM {$locations_table} l 
             INNER JOIN {$metadata_table} m ON l.id = m.metadata_id 
             WHERE m.attachment_id = %d AND m.metadata_type = 'location'
             ORDER BY l.name ASC",
            $attachment_id
        ) );
        
        if ( $locations ) {
            $result['locations'] = $locations;
        }
        
        return $result;
    }
    
    /**
     * Clear all metadata for an image
     */
    public static function clear_image_metadata( $attachment_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_image_metadata';
        
        $metadata = $wpdb->get_results( $wpdb->prepare(
            "SELECT metadata_type, metadata_id FROM {$table} WHERE attachment_id = %d",
            $attachment_id
        ) );
        
        foreach ( $metadata as $item ) {
            self::decrement_usage_count( $item->metadata_type, $item->metadata_id );
        }
        
        return $wpdb->delete(
            $table,
            array( 'attachment_id' => $attachment_id ),
            array( '%d' )
        );
    }
    
    /**
     * Increment usage count
     */
    private static function increment_usage_count( $type, $id ) {
        global $wpdb;
        
        $table_map = array(
            'tag' => $wpdb->prefix . 'fotogrids_tags',
            'person' => $wpdb->prefix . 'fotogrids_people',
            'location' => $wpdb->prefix . 'fotogrids_locations'
        );
        
        if ( ! isset( $table_map[ $type ] ) ) {
            return false;
        }
        
        return $wpdb->query( $wpdb->prepare(
            "UPDATE {$table_map[$type]} SET usage_count = usage_count + 1 WHERE id = %d",
            $id
        ) );
    }
    
    /**
     * Decrement usage count
     */
    private static function decrement_usage_count( $type, $id ) {
        global $wpdb;
        
        $table_map = array(
            'tag' => $wpdb->prefix . 'fotogrids_tags',
            'person' => $wpdb->prefix . 'fotogrids_people',
            'location' => $wpdb->prefix . 'fotogrids_locations'
        );
        
        if ( ! isset( $table_map[ $type ] ) ) {
            return false;
        }
        
        return $wpdb->query( $wpdb->prepare(
            "UPDATE {$table_map[$type]} SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = %d",
            $id
        ) );
    }
    
    /**
     * Get similar items for duplicate prevention
     */
    public static function get_similar_items( $type, $name, $limit = 5 ) {
        global $wpdb;
        
        $table_map = array(
            'tag' => $wpdb->prefix . 'fotogrids_tags',
            'person' => $wpdb->prefix . 'fotogrids_people',
            'location' => $wpdb->prefix . 'fotogrids_locations'
        );
        
        if ( ! isset( $table_map[ $type ] ) ) {
            return array();
        }
        
        $table = $table_map[ $type ];
        $search_term = '%' . $wpdb->esc_like( $name ) . '%';
        
        return $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$table} 
             WHERE LOWER(name) LIKE LOWER(%s) 
             ORDER BY 
                CASE WHEN LOWER(name) = LOWER(%s) THEN 1 ELSE 2 END,
                usage_count DESC, 
                name ASC 
             LIMIT %d",
            $search_term,
            $name,
            $limit
        ) );
    }
}
