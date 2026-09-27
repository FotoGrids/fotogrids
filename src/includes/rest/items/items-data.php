<?php
namespace FotoGrids\REST\Items;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Items Data Handler
 *
 * Handles item data for REST API endpoints.
 *
 * @since 1.0.0
 */
class Items_Data {

	/**
	 * Query items with filters
	 *
	 * Searches for items based on various criteria including gallery, tags,
	 * people, and locations. Supports pagination with limit and offset parameters.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object containing filter parameters
	 * @return \WP_REST_Response Array of filtered items with metadata
	 */
	public static function query_items( $request ) {
		$gallery_id = $request->get_param( 'gallery' );
		$tag        = $request->get_param( 'tag' );
		$person     = $request->get_param( 'person' );
		$location   = $request->get_param( 'location' );
		$limit      = (int) $request->get_param( 'limit' );
		$offset     = (int) $request->get_param( 'offset' );

		if ( $gallery_id ) {
			$gallery_id = (int) $gallery_id;

			if ( 'publish' !== get_post_status( $gallery_id ) && ! current_user_can( 'edit_post', $gallery_id ) ) {
				return self::empty_items_response( $limit, $offset );
			}

			$item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
		} elseif ( current_user_can( 'edit_posts' ) ) {
			$gallery_id = 0;
			$item_ids   = \FotoGrids\Galleries\Gallery_Repository::all_item_ids( array( 'publish', 'future', 'draft', 'pending', 'private' ) );
		} else {
			return self::empty_items_response( $limit, $offset );
		}

		$item_ids  = array_values(
			array_filter(
				$item_ids,
				static fn ( $id ) => 'attachment' === get_post_type( (int) $id )
			)
		);
		$page_ids  = array_slice( $item_ids, $offset, $limit, true );
		$item_meta = \FotoGrids\Galleries\Item_Meta::get_many( $page_ids );

		$items = array();
		foreach ( $page_ids as $position => $attachment_id ) {
			$attachment = get_post( (int) $attachment_id );

			$items[] = array(
				'id'          => (int) $attachment_id,
				'gallery_id'  => $gallery_id,
				'position'    => (int) $position,
				'caption'     => $attachment->post_excerpt,
				'description' => $attachment->post_content,
				'location'    => (string) ( $item_meta[ $attachment_id ]['location'] ?? '' ),
				'url'         => wp_get_attachment_url( $attachment_id ),
				'sizes'       => wp_get_attachment_image_sizes( $attachment_id ),
				'alt'         => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
			);
		}

		return rest_ensure_response(
			array(
				'items'  => $items,
				'total'  => count( $items ),
				'limit'  => $limit,
				'offset' => $offset,
			)
		);
	}

	/**
	 * Build an empty items query response.
	 *
	 * Returned when the caller may not read the requested items (an
	 * unpublished gallery they cannot edit, or an unfiltered query without
	 * editing rights) so the public endpoint never leaks item metadata.
	 *
	 * @param int $limit  Requested limit, echoed back.
	 * @param int $offset Requested offset, echoed back.
	 * @return \WP_REST_Response
	 */
	private static function empty_items_response( int $limit, int $offset ) {
		return rest_ensure_response(
			array(
				'items'  => array(),
				'total'  => 0,
				'limit'  => $limit,
				'offset' => $offset,
			)
		);
	}
}
