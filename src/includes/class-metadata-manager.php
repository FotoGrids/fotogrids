<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Metadata Manager Class
 *
 * Handles reusable metadata (tags, people, locations) for items
 */
class Metadata_Manager {

    /**
     * Get allowed metadata types
     *
     * Returns the list of allowed metadata types, filterable via
     * 'fotogrids/data/metadata/types' filter.
     *
     * @return array Array of allowed type strings
     */
    public static function get_allowed_types() {
        $default_types = array( 'tag', 'person', 'location' );
        return apply_filters( 'fotogrids/data/metadata/types', $default_types );
    }

    /**
     * Validate metadata type
     *
     * Checks if a given type is in the allowed types list.
     *
     * @param string $type The type to validate
     * @return bool True if type is allowed, false otherwise
     */
    public static function validate_type( $type ) {
        $allowed = self::get_allowed_types();
        return in_array( $type, $allowed, true );
    }

    /**
     * Get metadata by type with optional search and limit
     *
     * @param string $type Metadata type (tag, people, location, etc.)
     * @param string $search Optional search term
     * @param int $limit Optional limit (default: 20)
     * @return array|false Array of metadata objects or false on error
     */
    public static function get_metadata( $type, $search = '', $limit = 20 ) {
        if ( ! self::validate_type( $type ) ) {
            return false;
        }

        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_tags';
        $sql = "SELECT * FROM {$table} WHERE type = %s";
        $params = array( $type );

        if ( ! empty( $search ) ) {
            $sql .= " AND name LIKE %s";
            $params[] = '%' . $wpdb->esc_like( $search ) . '%';
        }

        $sql .= " ORDER BY usage_count DESC, name ASC LIMIT %d";
        $params[] = absint( $limit );

        $sql = $wpdb->prepare( $sql, $params );

        return $wpdb->get_results( $sql );
    }

    /**
     * Get tags with optional search and limit
     *
     * @param string $search Optional search term
     * @param int $limit Optional limit (default: 20)
     * @return array Array of tag objects
     */
    public static function get_tags( $search = '', $limit = 20 ) {
        return self::get_metadata( 'tag', $search, $limit );
    }

    /**
     * Get people with optional search and limit
     *
     * @param string $search Optional search term
     * @param int $limit Optional limit (default: 20)
     * @return array Array of people objects
     */
    public static function get_people( $search = '', $limit = 20 ) {
        return self::get_metadata( 'person', $search, $limit );
    }

    /**
     * Get locations with optional search and limit
     *
     * @param string $search Optional search term
     * @param int $limit Optional limit (default: 20)
     * @return array Array of location objects
     */
    public static function get_locations( $search = '', $limit = 20 ) {
        return self::get_metadata( 'location', $search, $limit );
    }

    /**
     * Add or get existing metadata entry
     *
     * @param string $type Metadata type
     * @param string $name Metadata name
     * @param array|null $meta Optional metadata to store as JSON
     * @return object|false Metadata object or false on error
     */
    public static function add_or_get_metadata( $type, $name, $meta = null ) {
        if ( ! self::validate_type( $type ) ) {
            return false;
        }

        global $wpdb;

        $name = trim( $name );
        if ( empty( $name ) ) {
            return false;
        }

        $slug = sanitize_title( $name );
        $table = $wpdb->prefix . 'fotogrids_tags';

        $existing = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table} WHERE type = %s AND (LOWER(name) = LOWER(%s) OR slug = %s)",
            $type,
            $name,
            $slug
        ) );

        if ( $existing ) {
            if ( $meta !== null ) {
                $meta_json = json_encode( $meta );
                if ( $existing->meta !== $meta_json ) {
                    $wpdb->update(
                        $table,
                        array( 'meta' => $meta_json ),
                        array( 'id' => $existing->id ),
                        array( '%s' ),
                        array( '%d' )
                    );
                    $existing->meta = $meta_json;
                }
            }
            return $existing;
        }

        $meta_json = $meta !== null ? json_encode( $meta ) : null;

        $result = $wpdb->insert(
            $table,
            array(
                'type' => $type,
                'name' => $name,
                'slug' => $slug,
                'meta' => $meta_json,
                'usage_count' => 0,
                'created_at' => current_time( 'mysql' )
            ),
            array( '%s', '%s', '%s', '%s', '%d', '%s' )
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
     * Add or get existing tag
     *
     * @param string $name Tag name
     * @return object|false Tag object or false on error
     */
    public static function add_or_get_tag( $name ) {
        return self::add_or_get_metadata( 'tag', $name );
    }

    /**
     * Add or get existing person
     *
     * @param string $name Person name
     * @param string $details Optional person details
     * @return object|false Person object or false on error
     */
    public static function add_or_get_person( $name, $details = '' ) {
        $meta = null;
        if ( ! empty( $details ) ) {
            $meta = array( 'details' => $details );
        }
        return self::add_or_get_metadata( 'person', $name, $meta );
    }

    /**
     * Add or get existing location
     *
     * @param string $name Location name
     * @param float|null $latitude Optional latitude
     * @param float|null $longitude Optional longitude
     * @return object|false Location object or false on error
     */
    public static function add_or_get_location( $name, $latitude = null, $longitude = null ) {
        $meta = null;
        if ( $latitude !== null || $longitude !== null ) {
            $meta = array();
            if ( $latitude !== null ) {
                $meta['latitude'] = $latitude;
            }
            if ( $longitude !== null ) {
                $meta['longitude'] = $longitude;
            }
        }
        return self::add_or_get_metadata( 'location', $name, $meta );
    }

    /**
     * Add metadata to item
     *
     * @param int $attachment_id Attachment ID
     * @param string $type Metadata type
     * @param int $metadata_id Metadata ID
     * @return bool|int False on failure, insert ID on success
     */
    private static function add_metadata_relationship( $attachment_id, $type, $metadata_id ) {
        if ( ! self::validate_type( $type ) ) {
            return false;
        }

        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_item_metadata';

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
     * Add tag to item
     *
     * @param int $attachment_id Attachment ID
     * @param string $tag_name Tag name
     * @return bool True on success, false on failure
     */
    public static function add_tag_to_item( $attachment_id, $tag_name ) {
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
     * Add person to item
     *
     * @param int $attachment_id Attachment ID
     * @param string $person_name Person name
     * @param string $details Optional person details
     * @return bool True on success, false on failure
     */
    public static function add_person_to_item( $attachment_id, $person_name, $details = '' ) {
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
     * Add location to item
     *
     * @param int $attachment_id Attachment ID
     * @param string $location_name Location name
     * @param float|null $latitude Optional latitude
     * @param float|null $longitude Optional longitude
     * @return bool True on success, false on failure
     */
    public static function add_location_to_item( $attachment_id, $location_name, $latitude = null, $longitude = null ) {
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
     * Remove metadata from item
     *
     * @param int $attachment_id Attachment ID
     * @param string $type Metadata type
     * @param int $metadata_id Metadata ID
     * @return bool True on success, false on failure
     */
    public static function remove_metadata_from_item( $attachment_id, $type, $metadata_id ) {
        if ( ! self::validate_type( $type ) ) {
            return false;
        }

        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_item_metadata';

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
     * Get all metadata for an item
     *
     * @param int $attachment_id Attachment ID
     * @return array Array with 'tags', 'people', and 'locations' keys
     */
    public static function get_item_metadata( $attachment_id ) {
        global $wpdb;

        $metadata_table = $wpdb->prefix . 'fotogrids_item_metadata';
        $tags_table = $wpdb->prefix . 'fotogrids_tags';

        $result = array(
            'tags' => array(),
            'people' => array(),
            'locations' => array()
        );

        $metadata = $wpdb->get_results( $wpdb->prepare(
            "SELECT t.*, m.metadata_type
             FROM {$tags_table} t
             INNER JOIN {$metadata_table} m ON t.id = m.metadata_id
             WHERE m.attachment_id = %d
             ORDER BY t.metadata_type, t.name ASC",
            $attachment_id
        ) );

        if ( $metadata ) {
            foreach ( $metadata as $item ) {
                $type = $item->metadata_type;
                if ( $type === 'tag' ) {
                    $result['tags'][] = $item;
                } elseif ( $type === 'person' ) {
                    $result['people'][] = $item;
                } elseif ( $type === 'location' ) {
                    $result['locations'][] = $item;
                }
            }
        }

        return $result;
    }

    /**
     * Clear all metadata for an item
     *
     * @param int $attachment_id Attachment ID
     * @return bool True on success, false on failure
     */
    public static function clear_item_metadata( $attachment_id ) {
        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_item_metadata';

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
     *
     * @param string $type Metadata type
     * @param int $id Metadata ID
     * @return bool|int False on failure, number of rows affected on success
     */
    private static function increment_usage_count( $type, $id ) {
        if ( ! self::validate_type( $type ) ) {
            return false;
        }

        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_tags';

        return $wpdb->query( $wpdb->prepare(
            "UPDATE {$table} SET usage_count = usage_count + 1 WHERE id = %d AND type = %s",
            $id,
            $type
        ) );
    }

    /**
     * Decrement usage count
     *
     * @param string $type Metadata type
     * @param int $id Metadata ID
     * @return bool|int False on failure, number of rows affected on success
     */
    private static function decrement_usage_count( $type, $id ) {
        if ( ! self::validate_type( $type ) ) {
            return false;
        }

        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_tags';

        return $wpdb->query( $wpdb->prepare(
            "UPDATE {$table} SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = %d AND type = %s",
            $id,
            $type
        ) );
    }

    /**
     * Get similar items for duplicate prevention
     *
     * @param string $type Metadata type
     * @param string $name Metadata name
     * @param int $limit Optional limit (default: 5)
     * @return array Array of similar metadata objects
     */
    public static function get_similar_items( $type, $name, $limit = 5 ) {
        if ( ! self::validate_type( $type ) ) {
            return array();
        }

        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_tags';
        $search_term = '%' . $wpdb->esc_like( $name ) . '%';

        return $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$table}
             WHERE type = %s AND LOWER(name) LIKE LOWER(%s)
             ORDER BY
                CASE WHEN LOWER(name) = LOWER(%s) THEN 1 ELSE 2 END,
                usage_count DESC,
                name ASC
             LIMIT %d",
            $type,
            $search_term,
            $name,
            $limit
        ) );
    }
}
