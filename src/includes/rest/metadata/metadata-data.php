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
		$limit  = $request->get_param( 'limit' );

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
		$limit  = $request->get_param( 'limit' );

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
		$limit  = $request->get_param( 'limit' );

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
		$name      = $request->get_param( 'name' );
		$latitude  = $request->get_param( 'latitude' );
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
}
