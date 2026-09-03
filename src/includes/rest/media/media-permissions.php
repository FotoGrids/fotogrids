<?php
/**
 * Permission checks for the media import REST endpoints.
 *
 * @package FotoGrids\REST\Media
 * @since   1.1.0
 */

namespace FotoGrids\REST\Media;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Media Import Permissions Handler
 *
 * @since 1.1.0
 */
class Media_Permissions {

	/**
	 * Permission check for browsing and importing media into a gallery.
	 *
	 * Authorisation is scoped to the gallery being edited rather than to the
	 * plugin-wide management capability: importing is part of editing a
	 * gallery's items, so anyone who may edit that gallery may import into it.
	 * `upload_files` is required on top because both endpoints create
	 * attachments.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request Request object.
	 * @return bool|\WP_Error
	 */
	public static function check_media_write( $request ) {
		if ( ! current_user_can( 'upload_files' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to upload files.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		$gallery_id = absint( $request->get_param( 'gallery_id' ) );

		if ( $gallery_id <= 0 ) {
			return new \WP_Error(
				'fotogrids_invalid_gallery',
				__( 'Invalid gallery ID.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( ! current_user_can( 'edit_post', $gallery_id ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to edit this gallery.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}
}
