<?php
namespace FotoGrids\Tools\Migration\Sources;

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_Gallery;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Gallery Writer
 *
 * Creates a FotoGrids gallery from a normalised list of attachment ids. Every
 * migration source funnels through this writer so a gallery imported from
 * WordPress core, a competitor plugin, or a slider is built the same way - a
 * fotogrids_gallery CPT whose `fotogrids_gallery_items` list holds the
 * attachments in their original order.
 *
 * @since 1.0.0
 */
class Gallery_Writer {

	/**
	 * Create a FotoGrids gallery from a list of attachment ids.
	 *
	 * Attachment ids that are not real attachments on this site are skipped.
	 * Captions and descriptions are read from the attachments themselves, so
	 * existing metadata carries over.
	 *
	 * @since 1.0.0
	 * @param string             $title          Proposed gallery title.
	 * @param array<int, int>    $attachment_ids Ordered attachment ids.
	 * @return int|\WP_Error Gallery post id on success.
	 */
	public static function create_from_attachments( string $title, array $attachment_ids ) {
		$title = sanitize_text_field( $title );
		if ( '' === $title ) {
			$title = __( 'Imported gallery', 'fotogrids' );
		}

		$gallery_id = wp_insert_post(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_title'  => $title,
				'post_status' => 'publish',
			),
			true
		);

		if ( is_wp_error( $gallery_id ) ) {
			return $gallery_id;
		}

		self::add_items( (int) $gallery_id, $attachment_ids );

		do_action( Actions_Gallery::IMPORTED, (int) $gallery_id, 0 );

		return (int) $gallery_id;
	}

	/**
	 * Write a gallery's item list, preserving order.
	 *
	 * @since 1.0.0
	 * @param int             $gallery_id     Target gallery id.
	 * @param array<int, int> $attachment_ids Ordered attachment ids.
	 * @return int Number of items added.
	 */
	private static function add_items( int $gallery_id, array $attachment_ids ): int {
		$item_ids = array();

		foreach ( $attachment_ids as $attachment_id ) {
			$attachment_id = (int) $attachment_id;

			if ( ! $attachment_id || 'attachment' !== get_post_type( $attachment_id ) ) {
				continue;
			}

			if ( ! in_array( $attachment_id, $item_ids, true ) ) {
				$item_ids[] = $attachment_id;
			}
		}

		Gallery_Repository::set_item_ids( $gallery_id, $item_ids );

		return count( $item_ids );
	}
}
