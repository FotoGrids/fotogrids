<?php
namespace FotoGrids\REST\Items;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Items Permissions Handler
 *
 * Handles permission checks for item-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Items_Permissions {

	/**
	 * Permission check for reading items
	 *
	 * Public - the frontend lightbox needs item data without auth.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return bool
	 */
	public static function check_items_read( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return true;
	}

	/**
	 * Permission check for writing items (create / update / delete)
	 *
	 * Requires the manage_fotogrids capability.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function check_items_write( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		if ( ! current_user_can( 'manage_fotogrids' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to manage gallery items.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}
}
