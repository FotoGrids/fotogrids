<?php
namespace FotoGrids\REST\Metadata;

use FotoGrids\Hooks\Actions_Library;
use FotoGrids\Hooks\Filters_Library;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Library Manager REST Data Handler.
 *
 * Powers the FotoGrids → Library admin page (site-wide curation of tags,
 * people, and locations). All write callbacks check
 * Metadata_Permissions::check_manage_library() via the route registration.
 *
 * Endpoints (all under fotogrids/v1):
 *   GET    /library/types                        - registered entity types
 *   GET    /library/{type}                       - paginated list + total count header
 *   POST   /library/{type}                       - create an entry
 *   PATCH  /library/{type}/{id}                  - rename / update meta
 *   DELETE /library/{type}/{id}                  - delete one
 *   DELETE /library/{type}                       - bulk delete (ids in body)
 *   POST   /library/{type}/merge                 - merge sources into target
 *   POST   /library/{type}/recalculate           - recompute usage counts
 *
 * The {type} segment is the *plural* slug exposed in the filter
 * (`tags|people|locations`), which is mapped back to the internal singular
 * metadata type (`tag|person|location`) via Library_Data::resolve_type().
 *
 * @since 1.0.0
 */
class Library_Data {

	/**
	 * Get all registered library entity types.
	 *
	 * Plugins (and FotoGrids Pro) can register new entity types via the
	 * `fotogrids/library/entity_types` filter.
	 *
	 * @since 1.0.0
	 * @return array<string, array> Keyed by plural slug.
	 */
	public static function get_entity_types() {
		$defaults = array(
			'tags'      => array(
				'slug'                  => 'tags',
				'type'                  => 'tag',
				'label_plural'          => __( 'Tags', 'fotogrids' ),
				'label_singular'        => __( 'Tag', 'fotogrids' ),
				'supports_create'       => true,
				'supports_extra_fields' => false,
				'icon'                  => 'tag',
			),
			'people'    => array(
				'slug'                  => 'people',
				'type'                  => 'person',
				'label_plural'          => __( 'People', 'fotogrids' ),
				'label_singular'        => __( 'Person', 'fotogrids' ),
				'supports_create'       => true,
				'supports_extra_fields' => false,
				'icon'                  => 'people',
			),
			'locations' => array(
				'slug'                  => 'locations',
				'type'                  => 'location',
				'label_plural'          => __( 'Locations', 'fotogrids' ),
				'label_singular'        => __( 'Location', 'fotogrids' ),
				'supports_create'       => true,
				'supports_extra_fields' => true, // lat / lng
				'icon'                  => 'location',
			),
		);

		/**
		 * Filter the registered library entity types.
		 *
		 * Each entry must include at minimum:
		 *  - slug           string  URL-safe plural slug
		 *  - type           string  Internal metadata type singular (tag/person/location/…)
		 *  - label_plural   string
		 *  - label_singular string
		 *  - supports_create bool
		 *
		 * @since 1.0.0
		 * @param array $entity_types Default tag/person/location config.
		 */
		$entity_types = apply_filters( Filters_Library::ENTITY_TYPES, $defaults );

		return is_array( $entity_types ) ? $entity_types : $defaults;
	}

	/**
	 * Resolve a plural slug to its internal metadata type, or null if unknown.
	 *
	 * @since 1.0.0
	 * @param string $slug
	 * @return string|null
	 */
	public static function resolve_type( $slug ) {
		$types = self::get_entity_types();
		return isset( $types[ $slug ]['type'] ) ? $types[ $slug ]['type'] : null;
	}

	/**
	 * Counts across every entry of a type, for the Library header cards.
	 *
	 * @since  1.2.0
	 * @param  string $type Metadata type.
	 * @return array<string, int>
	 */
	private static function summarize( $type ) {
		$summary = array(
			'unused' => \FotoGrids\Metadata_Manager::count_metadata( $type, '', true ),
		);

		if ( 'location' === $type ) {
			$summary['with_coordinates'] = \FotoGrids\Metadata_Manager::count_locations_with_coordinates();
		}

		return $summary;
	}

	// ─── Endpoint callbacks ─────────────────────────────────────────────────

	/**
	 * GET /library/types - returns the registered entity-type config.
	 */
	public static function get_types( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return rest_ensure_response( array_values( self::get_entity_types() ) );
	}

	/**
	 * GET /library/{type} - paginated list.
	 */
	public static function get_library( $request ) {
		$type = self::resolve_type( $request->get_param( 'type' ) );
		if ( ! $type ) {
			return new \WP_Error( 'fotogrids_library_unknown_type', __( 'Unknown library type.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$args = array(
			'search'      => (string) $request->get_param( 'search' ),
			'per_page'    => (int) $request->get_param( 'per_page' ),
			'page'        => (int) $request->get_param( 'page' ),
			'orderby'     => (string) $request->get_param( 'orderby' ),
			'order'       => (string) $request->get_param( 'order' ),
			'unused_only' => filter_var( $request->get_param( 'unused_only' ), FILTER_VALIDATE_BOOLEAN ),
		);

		$rows  = \FotoGrids\Metadata_Manager::get_metadata_paginated( $type, $args );
		$total = \FotoGrids\Metadata_Manager::count_metadata( $type, $args['search'], $args['unused_only'] );

		$items = array_map( array( '\FotoGrids\Metadata_Manager', 'format_for_response' ), $rows );

		$response = rest_ensure_response(
			array(
				'items'    => $items,
				'total'    => $total,
				'page'     => max( 1, $args['page'] ? $args['page'] : 1 ),
				'per_page' => $args['per_page'] ? $args['per_page'] : 50,
				'summary'  => self::summarize( $type ),
			)
		);

		$response->header( 'X-FotoGrids-Library-Total', (string) $total );

		return $response;
	}

	/**
	 * POST /library/{type} - create a new entry.
	 */
	public static function create_entity( $request ) {
		$type = self::resolve_type( $request->get_param( 'type' ) );
		if ( ! $type ) {
			return new \WP_Error( 'fotogrids_library_unknown_type', __( 'Unknown library type.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$name = trim( (string) $request->get_param( 'name' ) );
		if ( '' === $name ) {
			return new \WP_Error( 'fotogrids_library_empty_name', __( 'Name is required.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$existing = \FotoGrids\Metadata_Manager::find_metadata( $type, $name );
		if ( $existing ) {
			return new \WP_Error(
				'fotogrids_library_exists',
				/* translators: %s: name of the existing tag, person or location. */
				sprintf( __( '"%s" already exists.', 'fotogrids' ), $existing->name ),
				array(
					'status'      => 409,
					'conflict_id' => (int) $existing->id,
				)
			);
		}

		$meta = null;
		if ( 'location' === $type ) {
			$meta = \FotoGrids\Metadata_Manager::normalize_coordinates(
				$request->get_param( 'latitude' ),
				$request->get_param( 'longitude' )
			);
			if ( is_wp_error( $meta ) ) {
				return $meta;
			}
		} elseif ( 'person' === $type ) {
			$details = (string) $request->get_param( 'details' );
			if ( '' !== $details ) {
				$meta = array( 'details' => $details );
			}
		}

		$row = \FotoGrids\Metadata_Manager::add_or_get_metadata( $type, $name, $meta );
		if ( ! $row ) {
			return new \WP_Error( 'fotogrids_library_create_failed', __( 'Failed to create entry.', 'fotogrids' ), array( 'status' => 500 ) );
		}

		do_action( Actions_Library::CREATED, $type, (int) $row->id );

		return rest_ensure_response( \FotoGrids\Metadata_Manager::format_for_response( $row ) );
	}

	/**
	 * PATCH /library/{type}/{id} - rename / update meta.
	 */
	public static function update_entity( $request ) {
		$type = self::resolve_type( $request->get_param( 'type' ) );
		$id   = (int) $request->get_param( 'id' );
		if ( ! $type ) {
			return new \WP_Error( 'fotogrids_library_unknown_type', __( 'Unknown library type.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$row = \FotoGrids\Metadata_Manager::get_metadata_by_id( $id );
		if ( ! $row || $row->type !== $type ) {
			return new \WP_Error( 'fotogrids_library_not_found', __( 'Entry not found.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$name = $request->get_param( 'name' );
		$name = null === $name ? $row->name : trim( (string) $name );

		// Reconstruct meta, preserving unrelated keys.
		$meta          = null;
		$existing_meta = ! empty( $row->meta ) ? json_decode( $row->meta, true ) : array();
		if ( ! is_array( $existing_meta ) ) {
			$existing_meta = array();
		}

		if ( 'location' === $type ) {
			$next = $existing_meta;
			if ( $request->has_param( 'latitude' ) || $request->has_param( 'longitude' ) ) {
				$current     = \FotoGrids\Metadata_Manager::coordinates_from_meta( $existing_meta );
				$coordinates = \FotoGrids\Metadata_Manager::normalize_coordinates(
					$request->has_param( 'latitude' ) ? $request->get_param( 'latitude' ) : $current['latitude'],
					$request->has_param( 'longitude' ) ? $request->get_param( 'longitude' ) : $current['longitude']
				);
				if ( is_wp_error( $coordinates ) ) {
					return $coordinates;
				}
				unset( $next['latitude'], $next['longitude'] );
				if ( null !== $coordinates ) {
					$next = array_merge( $next, $coordinates );
				}
			}
			$meta = empty( $next ) ? array() : $next;
		} elseif ( 'person' === $type ) {
			$details = $request->get_param( 'details' );
			$next    = $existing_meta;
			if ( $request->has_param( 'details' ) ) {
				if ( null === $details || '' === $details ) {
					unset( $next['details'] );
				} else {
					$next['details'] = (string) $details;
				}
			}
			$meta = empty( $next ) ? array() : $next;
		}

		$result = \FotoGrids\Metadata_Manager::update_metadata( $id, $name, $meta );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response( \FotoGrids\Metadata_Manager::format_for_response( $result ) );
	}

	/**
	 * DELETE /library/{type}/{id} - delete a single entry.
	 */
	public static function delete_entity( $request ) {
		$type = self::resolve_type( $request->get_param( 'type' ) );
		$id   = (int) $request->get_param( 'id' );
		if ( ! $type ) {
			return new \WP_Error( 'fotogrids_library_unknown_type', __( 'Unknown library type.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$row = \FotoGrids\Metadata_Manager::get_metadata_by_id( $id );
		if ( ! $row || $row->type !== $type ) {
			return new \WP_Error( 'fotogrids_library_not_found', __( 'Entry not found.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$result = \FotoGrids\Metadata_Manager::delete_metadata( $id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response(
			array(
				'deleted' => true,
				'id'      => $id,
			)
		);
	}

	/**
	 * DELETE /library/{type} - bulk delete.
	 */
	public static function bulk_delete( $request ) {
		$type = self::resolve_type( $request->get_param( 'type' ) );
		if ( ! $type ) {
			return new \WP_Error( 'fotogrids_library_unknown_type', __( 'Unknown library type.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$ids = $request->get_param( 'ids' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return new \WP_Error( 'fotogrids_library_missing_ids', __( 'No IDs supplied.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$result = \FotoGrids\Metadata_Manager::bulk_delete( $type, $ids );

		return rest_ensure_response( $result );
	}

	/**
	 * POST /library/{type}/merge - merge sources into target.
	 */
	public static function merge( $request ) {
		$type = self::resolve_type( $request->get_param( 'type' ) );
		if ( ! $type ) {
			return new \WP_Error( 'fotogrids_library_unknown_type', __( 'Unknown library type.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$target_id  = (int) $request->get_param( 'target_id' );
		$source_ids = $request->get_param( 'source_ids' );

		if ( $target_id <= 0 ) {
			return new \WP_Error( 'fotogrids_library_missing_target', __( 'Target ID is required.', 'fotogrids' ), array( 'status' => 400 ) );
		}
		if ( ! is_array( $source_ids ) || empty( $source_ids ) ) {
			return new \WP_Error( 'fotogrids_library_missing_sources', __( 'At least one source ID is required.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$result = \FotoGrids\Metadata_Manager::merge_metadata( $type, $target_id, $source_ids );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$result['target'] = \FotoGrids\Metadata_Manager::format_for_response( $result['target'] );
		return rest_ensure_response( $result );
	}

	/**
	 * POST /library/{type}/recalculate - recompute usage counts.
	 */
	public static function recalculate( $request ) {
		$type = self::resolve_type( $request->get_param( 'type' ) );
		if ( ! $type ) {
			return new \WP_Error( 'fotogrids_library_unknown_type', __( 'Unknown library type.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$touched = \FotoGrids\Metadata_Manager::recalculate_usage_counts( $type );

		return rest_ensure_response( array( 'touched' => $touched ) );
	}
}
