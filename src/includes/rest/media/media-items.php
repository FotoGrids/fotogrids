<?php
/**
 * Shared attachment-to-gallery-item shaping for the media import endpoints.
 *
 * @package FotoGrids\REST\Media
 * @since   1.1.0
 */

namespace FotoGrids\REST\Media;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Media Item Formatter
 *
 * @since 1.1.0
 */
class Media_Items {

	/**
	 * Shape an attachment as the item object the gallery metabox consumes.
	 *
	 * @since 1.1.0
	 * @param int $attachment_id Attachment ID.
	 * @return array<string, mixed>|null Null when the attachment is gone.
	 */
	public static function to_item( $attachment_id ) {
		$attachment_id = (int) $attachment_id;
		$url           = wp_get_attachment_url( $attachment_id );

		if ( ! $url ) {
			return null;
		}

		$thumbnail = wp_get_attachment_image_url( $attachment_id, 'thumbnail' );
		$title     = get_the_title( $attachment_id );
		$alt       = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );

		return array(
			'id'        => $attachment_id,
			'title'     => '' !== $title ? $title : wp_basename( $url ),
			'url'       => $url,
			'thumbnail' => $thumbnail ? $thumbnail : $url,
			'alt'       => is_string( $alt ) ? $alt : '',
			'featured'  => false,
		);
	}
}
