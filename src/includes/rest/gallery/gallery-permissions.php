<?php
namespace FotoGrids\REST\Gallery;

use FotoGrids\Hooks\Filters_Security;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Gallery Permissions Handler
 *
 * Handles permission checks for gallery-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Gallery_Permissions {

	/**
	 * Permission check for reading galleries
	 *
	 * Determines if the current user has permission to read gallery data.
	 * Currently allows public access for all published galleries.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object
	 * @return bool True if access is allowed, false otherwise
	 */
	public static function check_gallery_read( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return true;
	}

	/**
	 * Permission check for unlocking a password-protected gallery.
	 *
	 * The unlock endpoint is intentionally public - any visitor can attempt
	 * to unlock a gallery by submitting the password. Rate-limiting (if ever
	 * needed) should be applied at the server/WAF level, not here.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object
	 * @return bool Always true.
	 */
	public static function check_gallery_unlock( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return true;
	}

	/**
	 * Permission check for reading a gallery's saved (decrypted) password.
	 *
	 * Controlled by the fotogrids/security/can_view_gallery_password filter.
	 * Default is false - nobody can view stored passwords unless the site
	 * owner explicitly grants permission via the filter.
	 *
	 * Example - allow administrators:
	 *   add_filter(
	 *       'fotogrids/security/can_view_gallery_password',
	 *       fn( $can, $gallery_id, $user_id ) => current_user_can( 'manage_options' ),
	 *       10,
	 *       3
	 *   );
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object
	 * @return bool|\WP_Error True if allowed, WP_Error if not.
	 */
	/**
	 * Permission check for reading gallery cache status.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return bool
	 */
	public static function check_cache_status_read( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'manage_fotogrids' );
	}

	/**
	 * Permission check for flushing a gallery's cache.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return bool
	 */
	public static function check_cache_flush( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'manage_fotogrids' );
	}

	/**
	 * Permission check for writing a gallery's featured item.
	 *
	 * Mirrors WP's `edit_post` cap for the specific gallery ID.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function check_featured_item_write( $request ) {
		$gallery_id = absint( $request['id'] );
		if ( $gallery_id <= 0 ) {
			return new \WP_Error(
				'fotogrids_invalid_gallery',
				__( 'Invalid gallery ID.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}
		if ( ! current_user_can( 'edit_post', $gallery_id ) ) {
			return new \WP_Error(
				'fotogrids_forbidden',
				__( 'You do not have permission to edit this gallery.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}

	public static function check_gallery_password_read( $request ) {
		$gallery_id = absint( $request['id'] );
		$user_id    = get_current_user_id();

		// Administrators can view saved passwords by default.
		// All other roles require an explicit opt-in via the filter.
		$default_allowed = current_user_can( 'manage_options' );

		$allowed = apply_filters(
			Filters_Security::CAN_VIEW_GALLERY_PASSWORD,
			$default_allowed,
			$gallery_id,
			$user_id
		);

		if ( ! $allowed ) {
			return new \WP_Error(
				'fotogrids_forbidden',
				__( 'You do not have permission to view saved gallery passwords.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}
}
