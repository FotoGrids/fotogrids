<?php
namespace FotoGrids\REST\Metadata;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Metadata Data Handler
 *
 * Handles metadata data for REST API endpoints.
 *
 * @since 1.0.0
 */
class Metadata_Data {

    /**
     * Get metadata tags
     *
     * Retrieves available metadata tags with optional search filtering.
     * Used for autocomplete and selection interfaces in item metadata editing.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request with optional search and limit parameters
     * @return \WP_REST_Response Array of available tags
     */
    public static function get_metadata_tags( $request ) {
        $search = $request->get_param( 'search' );
        $limit = $request->get_param( 'limit' );

        $tags = \FotoGrids\Metadata_Manager::get_tags( $search, $limit );

        return rest_ensure_response( $tags );
    }

    /**
     * Get metadata people
     *
     * Retrieves available people metadata with optional search filtering.
     * Used for autocomplete and selection interfaces in item metadata editing.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request with optional search and limit parameters
     * @return \WP_REST_Response Array of available people
     */
    public static function get_metadata_people( $request ) {
        $search = $request->get_param( 'search' );
        $limit = $request->get_param( 'limit' );

        $people = \FotoGrids\Metadata_Manager::get_people( $search, $limit );

        return rest_ensure_response( $people );
    }

    /**
     * Get metadata locations
     *
     * Retrieves available location metadata with optional search filtering.
     * Used for autocomplete and selection interfaces in item metadata editing.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request with optional search and limit parameters
     * @return \WP_REST_Response Array of available locations
     */
    public static function get_metadata_locations( $request ) {
        $search = $request->get_param( 'search' );
        $limit = $request->get_param( 'limit' );

        $locations = \FotoGrids\Metadata_Manager::get_locations( $search, $limit );

        return rest_ensure_response( $locations );
    }

    /**
     * Create metadata tag
     *
     * Creates a new metadata tag that can be used for item categorization.
     * Returns the created tag data or an error if creation fails.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request containing tag name
     * @return \WP_REST_Response|\WP_Error Created tag data or error response
     */
    public static function create_metadata_tag( $request ) {
        $name = $request->get_param( 'name' );

        if ( empty( $name ) ) {
            return new \WP_Error( 'missing_name', __( 'Tag name is required', 'fotogrids' ), array( 'status' => 400 ) );
        }

        $tag = \FotoGrids\Metadata_Manager::add_or_get_tag( $name );

        if ( ! $tag ) {
            return new \WP_Error( 'creation_failed', __( 'Failed to create tag', 'fotogrids' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( $tag );
    }

    /**
     * Create metadata person
     *
     * Creates a new person entry that can be used for item metadata.
     * Returns the created person data or an error if creation fails.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request containing person name
     * @return \WP_REST_Response|\WP_Error Created person data or error response
     */
    public static function create_metadata_person( $request ) {
        $name = $request->get_param( 'name' );

        if ( empty( $name ) ) {
            return new \WP_Error( 'missing_name', __( 'Person name is required', 'fotogrids' ), array( 'status' => 400 ) );
        }

        $person = \FotoGrids\Metadata_Manager::add_or_get_person( $name );

        if ( ! $person ) {
            return new \WP_Error( 'creation_failed', __( 'Failed to create person', 'fotogrids' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( $person );
    }

    /**
     * Create metadata location
     *
     * Creates a new location entry that can be used for item metadata.
     * Returns the created location data or an error if creation fails.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request containing location name
     * @return \WP_REST_Response|\WP_Error Created location data or error response
     */
    public static function create_metadata_location( $request ) {
        $name = $request->get_param( 'name' );
        $latitude = $request->get_param( 'latitude' );
        $longitude = $request->get_param( 'longitude' );

        if ( empty( $name ) ) {
            return new \WP_Error( 'missing_name', __( 'Location name is required', 'fotogrids' ), array( 'status' => 400 ) );
        }

        $location = \FotoGrids\Metadata_Manager::add_or_get_location( $name, $latitude, $longitude );

        if ( ! $location ) {
            return new \WP_Error( 'creation_failed', __( 'Failed to create location', 'fotogrids' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( $location );
    }

    /**
     * Get item metadata
     *
     * Retrieves all metadata associated with a specific item including
     * tags, people, and location information.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request containing item ID
     * @return \WP_REST_Response Item metadata including tags, people, and locations
     */
    public static function get_item_metadata( $request ) {
        $item_id = $request->get_param( 'id' );

        $metadata = \FotoGrids\Metadata_Manager::get_item_metadata( $item_id );

        return rest_ensure_response( $metadata );
    }

    /**
     * Save item metadata
     *
     * Saves metadata for a specific item including tags, people, and locations.
     * Clears existing metadata before saving new data to ensure accuracy.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request containing item ID and metadata
     * @return \WP_REST_Response Results of metadata save operation including any errors
     */
    public static function save_item_metadata( $request ) {
        $item_id   = $request->get_param( 'id' );
        $tags      = $request->get_param( 'tags' )      ?: array();
        $people    = $request->get_param( 'people' )    ?: array();
        $locations = $request->get_param( 'locations' ) ?: array();

        \FotoGrids\Metadata_Manager::clear_item_metadata( $item_id );

        $results = array(
            'tags'      => array(),
            'people'    => array(),
            'locations' => array(),
            'errors'    => array(),
        );

        // ── Tags ─────────────────────────────────────────────────────────────
        // The FE sends an array of integer IDs. Link each directly without a
        // name lookup. Fall back to name-based lookup only for non-integer values
        // (e.g. external API callers that still send names).
        foreach ( $tags as $tag_data ) {
            if ( is_int( $tag_data ) || ( is_numeric( $tag_data ) && intval( $tag_data ) == $tag_data ) ) {
                $tag_id = (int) $tag_data;
                $result = \FotoGrids\Metadata_Manager::link_tag_to_item( $item_id, $tag_id );
                if ( $result ) {
                    $results['tags'][] = array( 'id' => $tag_id );
                } else {
                    $results['errors'][] = sprintf( __( 'Failed to link tag ID %d to item %d', 'fotogrids' ), $tag_id, $item_id );
                }
            } else {
                // Fallback: name string (backwards compat for external callers).
                $tag_name = is_string( $tag_data ) ? trim( $tag_data ) : ( isset( $tag_data['name'] ) ? trim( $tag_data['name'] ) : '' );
                if ( empty( $tag_name ) ) {
                    continue;
                }
                $result = \FotoGrids\Metadata_Manager::add_tag_to_item( $item_id, $tag_name );
                if ( $result ) {
                    $results['tags'][] = array( 'name' => $tag_name );
                } else {
                    $results['errors'][] = sprintf( __( 'Failed to add tag: %s to item %d', 'fotogrids' ), $tag_name, $item_id );
                }
            }
        }

        // ── People ───────────────────────────────────────────────────────────
        // The FE sends { id, name, details }. When an ID is present, link
        // directly. Fall back to name-based lookup when ID is absent.
        foreach ( $people as $person ) {
            $person_id = isset( $person['id'] ) ? (int) $person['id'] : 0;
            $name      = isset( $person['name'] )    ? trim( $person['name'] )    : '';
            $details   = isset( $person['details'] ) ? trim( $person['details'] ) : '';

            if ( $person_id > 0 ) {
                $result = \FotoGrids\Metadata_Manager::link_person_to_item( $item_id, $person_id );
                if ( $result ) {
                    $results['people'][] = array( 'id' => $person_id, 'name' => $name );
                } else {
                    $results['errors'][] = sprintf( __( 'Failed to link person ID %d to item %d', 'fotogrids' ), $person_id, $item_id );
                }
            } elseif ( ! empty( $name ) ) {
                // Fallback: no ID supplied - find or create by name.
                $result = \FotoGrids\Metadata_Manager::add_person_to_item( $item_id, $name, $details );
                if ( $result ) {
                    $results['people'][] = array( 'name' => $name );
                } else {
                    $results['errors'][] = sprintf( __( 'Failed to add person: %s', 'fotogrids' ), $name );
                }
            }
        }

        // ── Locations ────────────────────────────────────────────────────────
        // The FE sends { id, name, latitude, longitude }. When an ID is present,
        // link directly. Fall back to name-based lookup when ID is absent.
        foreach ( $locations as $location ) {
            $location_id = isset( $location['id'] ) ? (int) $location['id'] : 0;
            $name        = isset( $location['name'] )      ? trim( $location['name'] )    : '';
            $latitude    = isset( $location['latitude'] )  ? $location['latitude']        : null;
            $longitude   = isset( $location['longitude'] ) ? $location['longitude']       : null;

            if ( $location_id > 0 ) {
                $result = \FotoGrids\Metadata_Manager::link_location_to_item( $item_id, $location_id );
                if ( $result ) {
                    $results['locations'][] = array( 'id' => $location_id, 'name' => $name );
                } else {
                    $results['errors'][] = sprintf( __( 'Failed to link location ID %d to item %d', 'fotogrids' ), $location_id, $item_id );
                }
            } elseif ( ! empty( $name ) ) {
                // Fallback: no ID supplied - find or create by name.
                $result = \FotoGrids\Metadata_Manager::add_location_to_item( $item_id, $name, $latitude, $longitude );
                if ( $result ) {
                    $results['locations'][] = array( 'name' => $name );
                } else {
                    $results['errors'][] = sprintf( __( 'Failed to add location: %s', 'fotogrids' ), $name );
                }
            }
        }

        return rest_ensure_response( $results );
    }
}
