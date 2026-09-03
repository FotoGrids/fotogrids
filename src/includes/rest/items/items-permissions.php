<?php
namespace FotoGrids\REST\Items;

use FotoGrids\Galleries\Embed_Store;
use FotoGrids\Galleries\Gallery_Repository;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Items Permissions Handler
 *
 * Handles permission checks for item-related REST API endpoints.
 *
 * Item writes are authorised against the subject being written - the item post
 * for metadata, the owning gallery for embeds - rather than against a
 * plugin-wide capability, so anyone who may edit a gallery may manage the
 * items inside it.
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
	 * Permission check for saving one item's core fields and metadata.
	 *
	 * The saved data belongs to the item itself and is shared by every gallery
	 * showing it, so the gate is WordPress' own `edit_post` on that item.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function check_item_write( $request ) {
		$item_id = absint( $request->get_param( 'id' ) );

		if ( $item_id <= 0 ) {
			return self::invalid_item();
		}

		$post_type = get_post_type( $item_id );

		if ( 'attachment' !== $post_type && Embed_Store::POST_TYPE !== $post_type ) {
			return self::invalid_item();
		}

		if ( ! current_user_can( 'edit_post', $item_id ) ) {
			return self::forbidden( __( 'You do not have permission to edit this item.', 'fotogrids' ) );
		}

		return true;
	}

	/**
	 * Permission check for adding an embed to a gallery.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function check_embed_create( $request ) {
		$gallery_id = absint( $request->get_param( 'gallery_id' ) );

		if ( $gallery_id <= 0 ) {
			return new \WP_Error(
				'fotogrids_invalid_gallery',
				__( 'Invalid gallery ID.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		return self::can_edit_gallery( $gallery_id );
	}

	/**
	 * Permission check for updating or deleting an existing embed.
	 *
	 * The owning gallery is resolved server-side from the embed ID rather than
	 * taken from the request, so a caller cannot name a gallery they happen to
	 * own in order to reach someone else's embed.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function check_embed_write( $request ) {
		$embed_id = absint( $request->get_param( 'id' ) );

		if ( $embed_id <= 0 || ! Embed_Store::is_embed( $embed_id ) ) {
			return self::invalid_item();
		}

		$gallery_id = Gallery_Repository::find_gallery_for_embed( $embed_id );

		if ( $gallery_id > 0 ) {
			return self::can_edit_gallery( $gallery_id );
		}

		// An embed no gallery references any more is gated on the embed itself.
		if ( ! current_user_can( 'edit_post', $embed_id ) ) {
			return self::forbidden( __( 'You do not have permission to edit this item.', 'fotogrids' ) );
		}

		return true;
	}

	/**
	 * Permission check for resolving an embed URL to its oEmbed metadata.
	 *
	 * Writes nothing; it only fetches public metadata for a supported
	 * platform URL on behalf of someone composing a gallery.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request
	 * @return bool|\WP_Error
	 */
	public static function check_embed_resolve( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		if ( ! current_user_can( 'edit_posts' ) ) {
			return self::forbidden( __( 'You do not have permission to add videos.', 'fotogrids' ) );
		}

		return true;
	}

	/**
	 * Whether the current user may edit a given gallery.
	 *
	 * @since 1.1.0
	 * @param int $gallery_id Gallery post ID.
	 * @return bool|\WP_Error
	 */
	private static function can_edit_gallery( $gallery_id ) {
		if ( ! current_user_can( 'edit_post', $gallery_id ) ) {
			return self::forbidden( __( 'You do not have permission to edit this gallery.', 'fotogrids' ) );
		}

		return true;
	}

	/**
	 * Standard 404 for an ID that is not an item this API manages.
	 *
	 * @since 1.1.0
	 * @return \WP_Error
	 */
	private static function invalid_item() {
		return new \WP_Error(
			'fotogrids_invalid_item',
			__( 'Invalid item ID.', 'fotogrids' ),
			array( 'status' => 404 )
		);
	}

	/**
	 * Standard 403.
	 *
	 * @since 1.1.0
	 * @param string $message User-facing reason.
	 * @return \WP_Error
	 */
	private static function forbidden( $message ) {
		return new \WP_Error(
			'rest_forbidden',
			$message,
			array( 'status' => 403 )
		);
	}
}
