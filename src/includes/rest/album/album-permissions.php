<?php
namespace FotoGrids\REST\Album;

use FotoGrids\Albums\Album_Repository;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Render_Controller;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Album Permissions Handler
 *
 * Handles permission checks for album-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Album_Permissions {

	/**
	 * Permission check for reading albums
	 *
	 * Determines if the current user has permission to read album data.
	 * Currently allows public access for all published albums.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object
	 * @return bool True if access is allowed, false otherwise
	 */
	public static function check_album_read( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return true;
	}

	/**
	 * Permission check for unlocking a password-protected album.
	 *
	 * Any visitor may submit a password; the handler verifies it.
	 *
	 * @since 1.3.0
	 * @param \WP_REST_Request $request The REST API request object.
	 * @return bool Always true.
	 */
	public static function check_album_unlock( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return true;
	}

	/**
	 * Permission check for the album list endpoint.
	 *
	 * The list includes draft and private albums of every author, so it is
	 * restricted to FotoGrids managers. Public surfaces render specific
	 * published albums through the shortcode, which uses the publish-guarded
	 * read path.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object.
	 * @return bool True if the user may list albums.
	 */
	public static function check_albums_list( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'manage_fotogrids' );
	}

	/**
	 * Permission check for writing an album's featured gallery.
	 *
	 * Mirrors WP's `edit_post` cap for the specific album ID.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function check_featured_gallery_write( $request ) {
		$album_id = absint( $request['id'] );
		if ( $album_id <= 0 ) {
			return new \WP_Error(
				'fotogrids_invalid_album',
				__( 'Invalid album ID.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}
		if ( ! current_user_can( 'edit_post', $album_id ) ) {
			return new \WP_Error(
				'fotogrids_forbidden',
				__( 'You do not have permission to edit this album.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}

	/**
	 * Decides whether the current visitor may see an album and its galleries.
	 *
	 * The album must be published, and every gate that would run on its
	 * public render must pass. For a gated album the response depends on the
	 * visitor, so it is sent with Cache-Control: no-store whether the gates
	 * pass or block.
	 *
	 * @since 1.3.0
	 * @param int $album_id Album post ID.
	 * @return true|\WP_Error
	 */
	public static function authorize_album_view( int $album_id ) {
		$album = $album_id > 0 ? get_post( $album_id ) : null;
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

		$context = Context_Builder::for_public()->build_for_album( $album_id, Album_Repository::get_settings( $album_id ) );
		if ( Render_Controller::has_active_gates( $context ) && ! headers_sent() ) {
			header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
		}

		if ( ! Render_Controller::evaluate_gates( $context )->passed ) {
			return new \WP_Error(
				'fotogrids_album_locked',
				__( 'You do not have access to this album.', 'fotogrids' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		return true;
	}
}
