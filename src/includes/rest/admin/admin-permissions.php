<?php
namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Admin Permissions Class
 *
 * Handles permissions for admin-specific REST API endpoints.
 *
 * @since 1.0.0
 */
class Admin_Permissions {

	/**
	 * Check if user can manage galleries and albums
	 *
	 * @param \WP_REST_Request $request Request object
	 * @return bool True if user has permission
	 */
	public static function check_admin_manage( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'edit_posts' ) && current_user_can( 'upload_files' );
	}

	/**
	 * Check if user can edit specific gallery
	 *
	 * @param \WP_REST_Request $request Request object
	 * @return bool True if user has permission
	 */
	public static function check_gallery_edit( $request ) {
		$gallery_id = $request->get_param( 'id' );

		if ( ! $gallery_id ) {
			return false;
		}

		$gallery = get_post( $gallery_id );

		if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
			return false;
		}

		return current_user_can( 'edit_post', $gallery_id );
	}

	/**
	 * Checks that the user can edit the gallery and every album the request names.
	 *
	 * Covers both the `album_ids` body param and the `album_id` route param.
	 *
	 * @since 1.2.0
	 * @param \WP_REST_Request $request Request object.
	 * @return bool
	 */
	public static function check_gallery_album_write( $request ) {
		if ( ! self::check_gallery_edit( $request ) ) {
			return false;
		}

		$album_ids = (array) $request->get_param( 'album_ids' );
		if ( $request->get_param( 'album_id' ) ) {
			$album_ids[] = $request->get_param( 'album_id' );
		}

		return self::can_edit_all( $album_ids, 'fotogrids_album' );
	}

	/**
	 * Checks that the user can edit the album and every gallery the request names.
	 *
	 * Covers both the `gallery_ids` body param and the `gallery_id` route param.
	 *
	 * @since 1.2.0
	 * @param \WP_REST_Request $request Request object.
	 * @return bool
	 */
	public static function check_album_gallery_write( $request ) {
		if ( ! self::check_album_edit( $request ) ) {
			return false;
		}

		$gallery_ids = (array) $request->get_param( 'gallery_ids' );
		if ( $request->get_param( 'gallery_id' ) ) {
			$gallery_ids[] = $request->get_param( 'gallery_id' );
		}

		return self::can_edit_all( $gallery_ids, 'fotogrids_gallery' );
	}

	/**
	 * Checks that every ID is a post of the given type the user can edit.
	 *
	 * @since 1.2.0
	 * @param array  $ids       Post IDs.
	 * @param string $post_type Expected post type.
	 * @return bool False when the list is empty.
	 */
	private static function can_edit_all( array $ids, string $post_type ): bool {
		if ( empty( $ids ) ) {
			return false;
		}

		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( ! $id || get_post_type( $id ) !== $post_type || ! current_user_can( 'edit_post', $id ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check if user can edit specific album
	 *
	 * @param \WP_REST_Request $request Request object
	 * @return bool True if user has permission
	 */
	public static function check_album_edit( $request ) {
		$album_id = $request->get_param( 'id' );

		if ( ! $album_id ) {
			return false;
		}

		$album = get_post( $album_id );

		if ( ! $album || 'fotogrids_album' !== $album->post_type ) {
			return false;
		}

		return current_user_can( 'edit_post', $album_id );
	}

	/**
	 * Check if user can edit posts
	 *
	 * @param \WP_REST_Request $request Request object
	 * @return bool True if user has permission
	 */
	public static function check_edit_posts( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Check if user can view statistics.
	 *
	 * Matches the capability that gates the Statistics admin page so the
	 * stats REST endpoints are not readable by users who cannot see the
	 * Statistics surface itself.
	 *
	 * @param \WP_REST_Request $request Request object
	 * @return bool True if user has permission
	 */
	public static function check_view_stats( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'view_fotogrids_stats' );
	}

	/**
	 * Check if user can manage license
	 *
	 * @param \WP_REST_Request $request Request object
	 * @return bool True if user has permission
	 */
	public static function check_license_manage( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'manage_fotogrids_settings' );
	}

	/**
	 * Check if user has the manage_fotogrids capability (required for plugin-level settings
	 * like media configuration and maintenance tools).
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request object
	 * @return bool
	 */
	public static function check_manage_fotogrids( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'manage_fotogrids' );
	}

	/**
	 * Check if the user can manage plugin settings (general / advanced).
	 *
	 * Mirrors the capability gating of the Settings page menu.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request object
	 * @return bool
	 */
	public static function check_manage_settings( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return current_user_can( 'manage_fotogrids_settings' );
	}
}
