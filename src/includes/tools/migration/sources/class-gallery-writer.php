<?php
namespace FotoGrids\Tools\Migration\Sources;

use FotoGrids\Hooks\Actions_Gallery;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Gallery Writer
 *
 * Creates a FotoGrids gallery and its item rows from a normalised list of
 * attachment ids. Every migration source funnels through this writer so a
 * gallery imported from WordPress core, a competitor plugin, or a slider is
 * built the same way - a fotogrids_gallery CPT plus one fotogrids_item_meta
 * row per item.
 *
 * @since 1.0.0
 */
class Gallery_Writer {

	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

	/**
	 * Create a FotoGrids gallery from a list of attachment ids.
	 *
	 * Attachment ids that are not real attachments on this site are skipped.
	 * Per-item caption and description default to the attachment's own caption
	 * and description so existing metadata carries over.
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
	 * Insert item rows for a gallery, preserving order.
	 *
	 * @since 1.0.0
	 * @param int             $gallery_id     Target gallery id.
	 * @param array<int, int> $attachment_ids Ordered attachment ids.
	 * @return int Number of items inserted.
	 */
	private static function add_items( int $gallery_id, array $attachment_ids ): int {
		global $wpdb;
		$table    = $wpdb->prefix . 'fotogrids_item_meta';
		$position = 0;
		$inserted = 0;

		foreach ( $attachment_ids as $attachment_id ) {
			$attachment_id = (int) $attachment_id;

			if ( ! $attachment_id || 'attachment' !== get_post_type( $attachment_id ) ) {
				continue;
			}

			$attachment = get_post( $attachment_id );

			$wpdb->insert(
				$table,
				array(
					'attachment_id' => $attachment_id,
					'gallery_id'    => $gallery_id,
					'position'      => $position,
					'item_type'     => 'image',
					'caption'       => $attachment ? sanitize_text_field( $attachment->post_excerpt ) : '',
					'description'   => $attachment ? wp_kses_post( $attachment->post_content ) : '',
				)
			);

			++$position;
			++$inserted;
		}

		return $inserted;
	}
}
