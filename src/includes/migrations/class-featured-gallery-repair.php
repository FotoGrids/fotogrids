<?php
/**
 * Repair of album featured-gallery picks that name a gallery outside the album.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

use FotoGrids\Post_Types;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Deletes every album's `fotogrids_featured_gallery` that does not name one of
 * the album's galleries.
 *
 * Runs on upgrade and after an import.
 *
 * @since 1.3.0
 */
final class Featured_Gallery_Repair {

	/**
	 * Run the repair.
	 *
	 * @since  1.3.0
	 * @return int Number of picks deleted.
	 */
	public static function run(): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One scan across all albums.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT pm.post_id, pm.meta_value
				FROM %i pm
				INNER JOIN %i p ON p.ID = pm.post_id AND p.post_type = %s
				LEFT JOIN %i r ON r.album_id = pm.post_id AND CAST( r.gallery_id AS CHAR ) = pm.meta_value
				WHERE pm.meta_key = %s AND r.id IS NULL',
				$wpdb->postmeta,
				$wpdb->posts,
				Post_Types::ALBUM,
				$wpdb->prefix . 'fotogrids_gallery_albums',
				Post_Types::FEATURED_GALLERY_META_KEY
			)
		);

		$repaired = 0;
		foreach ( (array) $rows as $row ) {
			if ( delete_post_meta( (int) $row->post_id, Post_Types::FEATURED_GALLERY_META_KEY, $row->meta_value ) ) {
				++$repaired;
			}
		}

		if ( $repaired > 0 ) {
			\FotoGrids\FotoGrids_Cache::flush_all();
		}

		return $repaired;
	}
}
