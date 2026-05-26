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
     * Link an existing tag to an item directly by ID.
     *
     * Preferred over add_tag_to_item() when the caller already holds the tag ID
     * (e.g. the admin metadata save endpoint), as it avoids an extra name lookup.
     *
     * @since 1.0.0
     * @param int $attachment_id Attachment ID
     * @param int $tag_id        ID of an existing tag in fotogrids_tags
     * @return bool True on success, false on failure
     */
    public static function link_tag_to_item( $attachment_id, $tag_id ) {
        $result = self::add_metadata_relationship( $attachment_id, 'tag', $tag_id );
        if ( $result ) {
            self::increment_usage_count( 'tag', $tag_id );
        }
        return (bool) $result;
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
     * Link an existing person to an item directly by ID.
     *
     * Preferred over add_person_to_item() when the caller already holds the
     * person ID, as it avoids an extra name lookup.
     *
     * @since 1.0.0
     * @param int $attachment_id Attachment ID
     * @param int $person_id     ID of an existing person in fotogrids_tags
     * @return bool True on success, false on failure
     */
    public static function link_person_to_item( $attachment_id, $person_id ) {
        $result = self::add_metadata_relationship( $attachment_id, 'person', $person_id );
        if ( $result ) {
            self::increment_usage_count( 'person', $person_id );
        }
        return (bool) $result;
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
     * Link an existing location to an item directly by ID.
     *
     * Preferred over add_location_to_item() when the caller already holds the
     * location ID, as it avoids an extra name lookup.
     *
     * @since 1.0.0
     * @param int $attachment_id Attachment ID
     * @param int $location_id   ID of an existing location in fotogrids_tags
     * @return bool True on success, false on failure
     */
    public static function link_location_to_item( $attachment_id, $location_id ) {
        $result = self::add_metadata_relationship( $attachment_id, 'location', $location_id );
        if ( $result ) {
            self::increment_usage_count( 'location', $location_id );
        }
        return (bool) $result;
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
             ORDER BY m.metadata_type, t.name ASC",
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

    // ─── Library Manager helpers ────────────────────────────────────────────
    //
    // The following methods power the FotoGrids → Library admin page, where
    // tags / people / locations are curated as a site-wide library.

    /**
     * Get a single metadata row by ID.
     *
     * @since 1.0.0
     * @param int $id Row ID in fotogrids_tags.
     * @return object|null
     */
    public static function get_metadata_by_id( $id ) {
        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_tags';
        return $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table} WHERE id = %d",
            (int) $id
        ) );
    }

    /**
     * Count how many entries of a given type match a search term.
     *
     * Used by the library REST endpoint for pagination headers.
     *
     * @since 1.0.0
     * @param string $type   Metadata type.
     * @param string $search Optional case-insensitive name fragment.
     * @param bool   $unused_only When true, only counts rows with usage_count = 0.
     * @return int
     */
    public static function count_metadata( $type, $search = '', $unused_only = false ) {
        if ( ! self::validate_type( $type ) ) {
            return 0;
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_tags';

        $sql    = "SELECT COUNT(*) FROM {$table} WHERE type = %s";
        $params = array( $type );

        if ( ! empty( $search ) ) {
            $sql     .= ' AND name LIKE %s';
            $params[] = '%' . $wpdb->esc_like( $search ) . '%';
        }

        if ( $unused_only ) {
            $sql .= ' AND usage_count = 0';
        }

        return (int) $wpdb->get_var( $wpdb->prepare( $sql, $params ) );
    }

    /**
     * Paginated, sortable list of metadata for the Library admin.
     *
     * Args:
     *   - search      string  Case-insensitive name fragment.
     *   - per_page    int     1..200 (default 50).
     *   - page        int     1-based page number.
     *   - orderby     string  one of: name, slug, usage_count, created_at.
     *   - order       string  asc | desc.
     *   - unused_only bool    When true, only returns rows with usage_count = 0.
     *
     * @since 1.0.0
     * @param string $type
     * @param array  $args
     * @return array
     */
    public static function get_metadata_paginated( $type, $args = array() ) {
        if ( ! self::validate_type( $type ) ) {
            return array();
        }

        $defaults = array(
            'search'      => '',
            'per_page'    => 50,
            'page'        => 1,
            'orderby'     => 'name',
            'order'       => 'asc',
            'unused_only' => false,
        );
        $args = wp_parse_args( $args, $defaults );

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_tags';

        // Whitelist orderby/order to prevent SQL injection.
        $orderby_allowed = array( 'name', 'slug', 'usage_count', 'created_at', 'id' );
        $orderby         = in_array( $args['orderby'], $orderby_allowed, true ) ? $args['orderby'] : 'name';
        $order           = strtolower( $args['order'] ) === 'desc' ? 'DESC' : 'ASC';

        $sql    = "SELECT * FROM {$table} WHERE type = %s";
        $params = array( $type );

        if ( ! empty( $args['search'] ) ) {
            $sql     .= ' AND name LIKE %s';
            $params[] = '%' . $wpdb->esc_like( $args['search'] ) . '%';
        }

        if ( ! empty( $args['unused_only'] ) ) {
            $sql .= ' AND usage_count = 0';
        }

        // Stable secondary sort by id so paging never duplicates rows.
        $sql .= " ORDER BY {$orderby} {$order}, id ASC LIMIT %d OFFSET %d";

        $per_page = max( 1, min( 200, (int) $args['per_page'] ) );
        $page     = max( 1, (int) $args['page'] );
        $offset   = ( $page - 1 ) * $per_page;

        $params[] = $per_page;
        $params[] = $offset;

        return $wpdb->get_results( $wpdb->prepare( $sql, $params ) );
    }

    /**
     * Update the name, slug, and (optionally) meta of a metadata row.
     *
     * Slug is recomputed from the new name. Refuses to clobber another row
     * of the same type that already owns the new name.
     *
     * @since 1.0.0
     * @param int        $id   Row ID.
     * @param string     $name New name (required, trimmed).
     * @param array|null $meta Optional meta payload. Pass null to leave untouched.
     * @return object|\WP_Error Updated row on success, WP_Error on conflict / not found.
     */
    public static function update_metadata( $id, $name, $meta = null ) {
        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_tags';

        $row = self::get_metadata_by_id( $id );
        if ( ! $row ) {
            return new \WP_Error( 'fotogrids_library_not_found', __( 'Entry not found.', 'fotogrids' ), array( 'status' => 404 ) );
        }

        $name = trim( (string) $name );
        if ( $name === '' ) {
            return new \WP_Error( 'fotogrids_library_empty_name', __( 'Name cannot be empty.', 'fotogrids' ), array( 'status' => 400 ) );
        }

        $slug = sanitize_title( $name );

        $conflict = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$table} WHERE type = %s AND id != %d AND (LOWER(name) = LOWER(%s) OR slug = %s) LIMIT 1",
            $row->type,
            (int) $id,
            $name,
            $slug
        ) );
        if ( $conflict ) {
            return new \WP_Error(
                'fotogrids_library_conflict',
                __( 'Another entry with this name already exists. Use Merge if you want to combine them.', 'fotogrids' ),
                array( 'status' => 409, 'conflict_id' => (int) $conflict )
            );
        }

        $data    = array( 'name' => $name, 'slug' => $slug );
        $formats = array( '%s', '%s' );

        if ( $meta !== null ) {
            $data['meta'] = is_string( $meta ) ? $meta : wp_json_encode( $meta );
            $formats[]    = '%s';
        }

        $wpdb->update( $table, $data, array( 'id' => (int) $id ), $formats, array( '%d' ) );

        do_action( 'fotogrids/actions/library/updated', $row->type, (int) $id );

        return self::get_metadata_by_id( $id );
    }

    /**
     * Delete a metadata row and cascade-delete its item links.
     *
     * @since 1.0.0
     * @param int $id Row ID.
     * @return bool|\WP_Error True on success.
     */
    public static function delete_metadata( $id ) {
        global $wpdb;

        $row = self::get_metadata_by_id( $id );
        if ( ! $row ) {
            return new \WP_Error( 'fotogrids_library_not_found', __( 'Entry not found.', 'fotogrids' ), array( 'status' => 404 ) );
        }

        $links_table = $wpdb->prefix . 'fotogrids_item_metadata';
        $tags_table  = $wpdb->prefix . 'fotogrids_tags';

        // Cascade: drop every item link that references this row.
        $wpdb->delete(
            $links_table,
            array( 'metadata_type' => $row->type, 'metadata_id' => (int) $id ),
            array( '%s', '%d' )
        );

        $deleted = $wpdb->delete( $tags_table, array( 'id' => (int) $id ), array( '%d' ) );

        if ( $deleted ) {
            do_action( 'fotogrids/actions/library/deleted', $row->type, (int) $id );
            return true;
        }

        return new \WP_Error( 'fotogrids_library_delete_failed', __( 'Failed to delete entry.', 'fotogrids' ), array( 'status' => 500 ) );
    }

    /**
     * Bulk delete by ID, scoped to a single type for safety.
     *
     * @since 1.0.0
     * @param string $type Metadata type - all IDs must belong to this type.
     * @param int[]  $ids  IDs to delete.
     * @return array { deleted: int, skipped: int[] }
     */
    public static function bulk_delete( $type, $ids ) {
        if ( ! self::validate_type( $type ) ) {
            return array( 'deleted' => 0, 'skipped' => array_map( 'intval', (array) $ids ) );
        }

        $deleted = 0;
        $skipped = array();

        foreach ( (array) $ids as $raw_id ) {
            $id  = (int) $raw_id;
            if ( $id <= 0 ) {
                continue;
            }

            $row = self::get_metadata_by_id( $id );
            if ( ! $row || $row->type !== $type ) {
                $skipped[] = $id;
                continue;
            }

            $result = self::delete_metadata( $id );
            if ( $result === true ) {
                $deleted++;
            } else {
                $skipped[] = $id;
            }
        }

        return array( 'deleted' => $deleted, 'skipped' => $skipped );
    }

    /**
     * Merge one or more source entries into a target.
     *
     * Re-points every item-metadata link from the sources to the target
     * (silently dropping links that would duplicate an existing target link),
     * then deletes the sources and recomputes the target's usage_count.
     *
     * @since 1.0.0
     * @param string $type       Metadata type - all rows must share this type.
     * @param int    $target_id  Row to keep.
     * @param int[]  $source_ids Rows to merge into target.
     * @return array|\WP_Error { merged: int, target: object } on success.
     */
    public static function merge_metadata( $type, $target_id, $source_ids ) {
        if ( ! self::validate_type( $type ) ) {
            return new \WP_Error( 'fotogrids_library_invalid_type', __( 'Invalid metadata type.', 'fotogrids' ), array( 'status' => 400 ) );
        }

        $target = self::get_metadata_by_id( $target_id );
        if ( ! $target || $target->type !== $type ) {
            return new \WP_Error( 'fotogrids_library_not_found', __( 'Target entry not found.', 'fotogrids' ), array( 'status' => 404 ) );
        }

        global $wpdb;
        $links_table = $wpdb->prefix . 'fotogrids_item_metadata';

        $merged = 0;
        foreach ( (array) $source_ids as $raw_source_id ) {
            $source_id = (int) $raw_source_id;
            if ( $source_id <= 0 || $source_id === (int) $target_id ) {
                continue;
            }

            $source = self::get_metadata_by_id( $source_id );
            if ( ! $source || $source->type !== $type ) {
                continue;
            }

            // Find every attachment currently linked to source.
            $attachment_ids = $wpdb->get_col( $wpdb->prepare(
                "SELECT attachment_id FROM {$links_table} WHERE metadata_type = %s AND metadata_id = %d",
                $type,
                $source_id
            ) );

            foreach ( $attachment_ids as $attachment_id ) {
                $attachment_id = (int) $attachment_id;

                $already_linked = (int) $wpdb->get_var( $wpdb->prepare(
                    "SELECT id FROM {$links_table} WHERE attachment_id = %d AND metadata_type = %s AND metadata_id = %d",
                    $attachment_id,
                    $type,
                    (int) $target_id
                ) );

                if ( $already_linked ) {
                    // Target already linked - drop the source link without re-pointing.
                    $wpdb->delete(
                        $links_table,
                        array(
                            'attachment_id' => $attachment_id,
                            'metadata_type' => $type,
                            'metadata_id'   => $source_id,
                        ),
                        array( '%d', '%s', '%d' )
                    );
                } else {
                    // Re-point this link from source to target.
                    $wpdb->update(
                        $links_table,
                        array( 'metadata_id' => (int) $target_id ),
                        array(
                            'attachment_id' => $attachment_id,
                            'metadata_type' => $type,
                            'metadata_id'   => $source_id,
                        ),
                        array( '%d' ),
                        array( '%d', '%s', '%d' )
                    );
                }
            }

            // Source is now empty - delete it.
            $wpdb->delete( $wpdb->prefix . 'fotogrids_tags', array( 'id' => $source_id ), array( '%d' ) );
            $merged++;

            do_action( 'fotogrids/actions/library/deleted', $type, $source_id );
        }

        // Recompute target usage_count from authoritative join data.
        self::recompute_usage_count( $type, (int) $target_id );

        do_action( 'fotogrids/actions/library/merged', $type, (int) $target_id, array_map( 'intval', (array) $source_ids ) );

        return array(
            'merged' => $merged,
            'target' => self::get_metadata_by_id( $target_id ),
        );
    }

    /**
     * Recompute a single row's usage_count from fotogrids_item_metadata.
     *
     * @since 1.0.0
     * @param string $type
     * @param int    $id
     * @return int New count, or 0 if row missing.
     */
    public static function recompute_usage_count( $type, $id ) {
        if ( ! self::validate_type( $type ) ) {
            return 0;
        }

        global $wpdb;
        $links_table = $wpdb->prefix . 'fotogrids_item_metadata';
        $tags_table  = $wpdb->prefix . 'fotogrids_tags';

        $count = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$links_table} WHERE metadata_type = %s AND metadata_id = %d",
            $type,
            (int) $id
        ) );

        $wpdb->update(
            $tags_table,
            array( 'usage_count' => $count ),
            array( 'id' => (int) $id, 'type' => $type ),
            array( '%d' ),
            array( '%d', '%s' )
        );

        return $count;
    }

    /**
     * Recompute usage_count for every row, optionally scoped to a type.
     *
     * Cheap on real-world libraries - one UPDATE per row that needs fixing.
     *
     * @since 1.0.0
     * @param string|null $type If provided, only rows of this type are recomputed.
     * @return int Number of rows updated.
     */
    public static function recalculate_usage_counts( $type = null ) {
        global $wpdb;
        $tags_table = $wpdb->prefix . 'fotogrids_tags';

        if ( $type !== null && ! self::validate_type( $type ) ) {
            return 0;
        }

        $sql    = "SELECT id, type FROM {$tags_table}";
        $params = array();
        if ( $type !== null ) {
            $sql     .= ' WHERE type = %s';
            $params[] = $type;
        }

        $rows = $params ? $wpdb->get_results( $wpdb->prepare( $sql, $params ) ) : $wpdb->get_results( $sql );

        $touched = 0;
        foreach ( $rows as $row ) {
            self::recompute_usage_count( $row->type, (int) $row->id );
            $touched++;
        }

        return $touched;
    }
}
