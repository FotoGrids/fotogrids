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
 * Creates a FotoGrids gallery from an ordered list of attachment ids.
 *
 * @since 1.0.0
 */
class Gallery_Writer {

	/**
	 * Post meta key holding the source and ref a gallery was migrated from.
	 *
	 * @since 1.3.0
	 * @var string
	 */
	public const ORIGIN_META_KEY = '_fotogrids_migration_origin';

	/**
	 * Create a FotoGrids gallery from a list of attachment ids.
	 *
	 * Attachment ids that are not real attachments on this site are skipped.
	 *
	 * @since 1.0.0
	 * @since 1.3.0 Added the `$origin` parameter.
	 * @param string             $title          Proposed gallery title.
	 * @param array<int, int>    $attachment_ids Ordered attachment ids.
	 * @param string             $origin         Optional. Source id and ref the gallery is migrated from, e.g. 'wp-core:post:12:0'.
	 * @return int|\WP_Error Gallery post id on success.
	 */
	public static function create_from_attachments( string $title, array $attachment_ids, string $origin = '' ) {
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

		if ( '' !== $origin ) {
			update_post_meta( (int) $gallery_id, self::ORIGIN_META_KEY, $origin );
		}

		self::add_items( (int) $gallery_id, $attachment_ids );

		do_action( Actions_Gallery::IMPORTED, (int) $gallery_id, 0 );

		return (int) $gallery_id;
	}

	/**
	 * Id of a gallery already migrated from an origin, or 0 when there is none.
	 *
	 * Galleries in the Trash are not counted.
	 *
	 * @since 1.3.0
	 * @param string $origin Source id and ref, as passed to create_from_attachments().
	 * @return int
	 */
	public static function find_by_origin( string $origin ): int {
		$ids = get_posts(
			array(
				'post_type'      => 'fotogrids_gallery',
				'post_status'    => 'any',
				'fields'         => 'ids',
				'posts_per_page' => 1,
				'no_found_rows'  => true,
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- The origin record is the only link between a migrated gallery and its source.
					array(
						'key'   => self::ORIGIN_META_KEY,
						'value' => $origin,
					),
				),
			)
		);

		return $ids ? (int) $ids[0] : 0;
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
