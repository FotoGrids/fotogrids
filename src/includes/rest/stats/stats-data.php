<?php
namespace FotoGrids\REST\Stats;

use FotoGrids\Hooks\Actions_Gallery;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Statistics Data Handler
 *
 * Handles statistics tracking for REST API endpoints.
 *
 * @since 1.0.0
 */
class Stats_Data {

	/**
	 * Increment view count
	 *
	 * Records a view event for a specific object (gallery, album, or item).
	 * Used for analytics and statistics tracking.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request containing object type and ID
	 * @return \WP_REST_Response|\WP_Error Success response or error
	 */
	public static function increment_view( $request ) {
		$object_type = $request->get_param( 'object_type' );
		$object_id   = (int) $request->get_param( 'object_id' );

		if ( ! self::object_exists( $object_type, $object_id ) ) {
			return self::not_found_error();
		}

		$result = \FotoGrids\Statistics::increment( $object_type, $object_id, 'views' );

		if ( ! $result ) {
			return new \WP_Error(
				'stats_update_failed',
				__( 'Failed to update statistics', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * Increment share count
	 *
	 * Records a share event for a specific object, optionally tracking the
	 * social network used for sharing. Triggers additional hooks for
	 * extended tracking functionality.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request containing object type, ID, and network
	 * @return \WP_REST_Response|\WP_Error Success response or error
	 */
	public static function increment_share( $request ) {
		$object_type = $request->get_param( 'object_type' );
		$object_id   = (int) $request->get_param( 'object_id' );
		$network     = $request->get_param( 'network' );

		if ( ! self::object_exists( $object_type, $object_id ) ) {
			return self::not_found_error();
		}

		$result = \FotoGrids\Statistics::increment( $object_type, $object_id, 'shares' );

		if ( ! $result ) {
			return new \WP_Error(
				'stats_update_failed',
				__( 'Failed to update statistics', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		if ( $network ) {
			do_action( Actions_Gallery::SHARE_TRACKED, $object_type, $object_id, $network );
		}

		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * Checks that the tracked object exists and matches its declared type.
	 *
	 * @since  1.2.0
	 * @param  string $object_type gallery, album or item.
	 * @param  int    $object_id   Post ID of the gallery or album, attachment ID of the item.
	 * @return bool
	 */
	private static function object_exists( $object_type, $object_id ) {
		$post_types = array(
			'gallery' => 'fotogrids_gallery',
			'album'   => 'fotogrids_album',
			'item'    => 'attachment',
		);

		if ( ! isset( $post_types[ $object_type ] ) ) {
			return false;
		}

		$post = get_post( $object_id );

		return $post instanceof \WP_Post
			&& $post_types[ $object_type ] === $post->post_type
			&& 'trash' !== $post->post_status;
	}

	/**
	 * Builds the error returned when the tracked object does not exist.
	 *
	 * @since  1.2.0
	 * @return \WP_Error
	 */
	private static function not_found_error() {
		return new \WP_Error(
			'fotogrids_stats_object_not_found',
			__( 'The object being tracked does not exist.', 'fotogrids' ),
			array( 'status' => 404 )
		);
	}
}
