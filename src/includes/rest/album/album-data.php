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

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * This class is part of the FotoGrids custom-table data layer. Every
	 * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
	 * (or a WP core table such as $wpdb->posts) -- a trusted identifier that
	 * WP placeholders cannot bind. All user-supplied *values* are passed
	 * through $wpdb->prepare(); where SQL is assembled incrementally or uses
	 * a generated %d IN() list, the prepare call is a separate statement the
	 * sniff cannot follow. Custom tables have no WP_Query / core-API
	 * equivalent and no object-cache layer applies at this level.
	 * ---------------------------------------------------------------------
	 */
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
	// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	// phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
	// phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
	// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

	/**
	 * Set or clear the album's featured gallery.
	 *
	 * Body: { gallery_id: int | null }. When null, the explicit choice is
	 * cleared (the runtime cover resolver falls back to the first child
	 * gallery with a resolvable cover). When set, the gallery must still
	 * be a child of this album.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function set_featured_gallery( $request ) {
		$album_id = (int) $request['id'];

		$album = get_post( $album_id );
		if ( ! $album || 'fotogrids_album' !== $album->post_type ) {
			return new \WP_Error(
				'fotogrids_album_not_found',
				__( 'Album not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$gallery_param = $request->get_param( 'gallery_id' );
		$clearing      = ( null === $gallery_param || '' === $gallery_param || (int) 0 === $gallery_param );

		if ( $clearing ) {
			delete_post_meta( $album_id, 'fotogrids_featured_gallery' );
			return rest_ensure_response(
				array(
					'album_id'   => $album_id,
					'gallery_id' => null,
					'cleared'    => true,
				)
			);
		}

		$gallery_id = (int) $gallery_param;
		$gallery    = get_post( $gallery_id );
		if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
			return new \WP_Error(
				'fotogrids_invalid_gallery',
				__( 'Featured gallery must be a gallery.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$children  = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $album_id );
		$child_ids = array();
		foreach ( (array) $children as $child ) {
			$gid = is_object( $child ) ? (int) ( $child->ID ?? $child->id ?? 0 ) : (int) $child;
			if ( $gid > 0 ) {
				$child_ids[] = $gid;
			}
		}
		if ( ! in_array( $gallery_id, $child_ids, true ) ) {
			return new \WP_Error(
				'fotogrids_gallery_not_in_album',
				__( 'Gallery is not part of this album.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		update_post_meta( $album_id, 'fotogrids_featured_gallery', $gallery_id );

		return rest_ensure_response(
			array(
				'album_id'   => $album_id,
				'gallery_id' => $gallery_id,
				'cleared'    => false,
			)
		);
	}

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
		if ( ! $album || 'fotogrids_album' !== $album->post_type ) {
			return new \WP_Error(
				'album_not_found',
				__( 'Album not found', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		if ( 'publish' !== $album->post_status ) {
			return new \WP_Error(
				'album_not_published',
				__( 'Album is not published', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		$meta = array(
			'layout'           => get_post_meta( $album_id, 'fotogrids_layout', true ) ?: 'grid',
			'featured_gallery' => (int) get_post_meta( $album_id, 'fotogrids_featured_gallery', true ) ?: null,
		);

		$galleries = get_posts(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
				'numberposts' => -1,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Admin-side relation lookup on a bounded set; meta_query is the correct tool here.
				'meta_query'  => array(
					array(
						'key'     => 'fotogrids_album_id',
						'value'   => $album_id,
						'compare' => '=',
					),
				),
			)
		);

		$gallery_data = array();
		foreach ( $galleries as $gallery ) {
			$thumb          = \FotoGrids\Galleries\Cover_Resolver::url_for_collection( $gallery->ID, 'medium' );
			$gallery_data[] = array(
				'id'          => $gallery->ID,
				'title'       => $gallery->post_title,
				'description' => $gallery->post_content,
				'thumbnail'   => '' !== $thumb ? $thumb : null,
				'item_count'  => self::get_gallery_item_count( $gallery->ID ),
			);
		}

		\FotoGrids\Statistics::increment( 'album', $album_id, 'views' );

		return rest_ensure_response(
			array(
				'id'          => $album->ID,
				'title'       => $album->post_title,
				'description' => $album->post_content,
				'meta'        => $meta,
				'galleries'   => $gallery_data,
				'shortcode'   => '[fotogrids_album id="' . $album_id . '"]',
			)
		);
	}

	/**
	 * Get albums list for admin use
	 *
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response Array of albums
	 */
	public static function get_albums_list( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		$args = array(
			'post_type'      => 'fotogrids_album',
			'post_status'    => array( 'publish', 'draft', 'private' ),
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		);

		$query  = new \WP_Query( $args );
		$albums = array();

		foreach ( $query->posts as $album ) {
			$albums[] = array(
				'id'     => $album->ID,
				'title'  => $album->post_title,
				'status' => $album->post_status,
			);
		}

		return rest_ensure_response( $albums );
	}

	/**
	 * Get item count for a gallery
	 *
	 * Returns the total number of items associated with a specific gallery.
	 * Used for display purposes and pagination calculations.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id The ID of the gallery to count items for
	 * @return int The number of items in the gallery
	 */
	private static function get_gallery_item_count( $gallery_id ) {
		global $wpdb;

		$table = $wpdb->prefix . 'fotogrids_item_meta';
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $table WHERE gallery_id = %d",
				$gallery_id
			)
		);
	}

	// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
	// phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
	// phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
	// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	// phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
	// phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
	// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
