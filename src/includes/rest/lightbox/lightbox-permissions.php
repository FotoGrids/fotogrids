<?php
namespace FotoGrids\REST\Lightbox;

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\REST\Gallery\Gallery_Permissions;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Lightbox REST Permissions
 *
 * @since 1.0.0
 */
class Lightbox_Permissions {

	/**
	 * Permission check for a single item's lightbox data.
	 *
	 * Users who can edit the attachment always pass. Anyone else must name a
	 * gallery that contains the item and that they are allowed to view.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object.
	 * @return true|\WP_Error
	 */
	public static function check_lightbox_read( $request ) {
		$item_id    = absint( $request->get_param( 'id' ) );
		$gallery_id = absint( $request->get_param( 'gallery_id' ) );

		if ( $item_id > 0 && current_user_can( 'edit_post', $item_id ) ) {
			return true;
		}

		if ( $gallery_id <= 0 || ! in_array( $item_id, Gallery_Repository::get_item_ids( $gallery_id ), true ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'Sorry, you are not allowed to view this item.', 'fotogrids' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		return Gallery_Permissions::authorize_gallery_view( $gallery_id );
	}
}
