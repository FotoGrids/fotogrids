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
 * Runs once on upgrade; after an import, `repair_albums()` checks the albums
 * the import wrote.
 *
 * @since 1.3.0
 */
final class Featured_Gallery_Repair implements Migration {

	/**
	 * Identifier recorded once the repair has run.
	 *
	 * @since  1.3.0
	 * @return string
	 */
	public static function id(): string {
		return '0004-featured-gallery-repair';
	}

	/**
	 * Run the repair over every album.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function run(): void {
		self::repair( null );
	}

	/**
	 * Run the repair over some albums.
	 *
	 * @since  1.3.0
	 * @param  array<int, int> $album_ids Album IDs.
	 * @return void
	 */
	public static function repair_albums( array $album_ids ): void {
		$album_ids = array_values( array_unique( array_filter( array_map( 'intval', $album_ids ) ) ) );

		if ( array() !== $album_ids ) {
			self::repair( $album_ids );
		}
	}

	/**
	 * Delete the picks that do not name one of their album's galleries.
	 *
	 * @since  1.3.0
	 * @param  array<int, int>|null $album_ids Albums to check; null for all of them.
	 * @return void
	 */
	private static function repair( ?array $album_ids ): void {
		global $wpdb;

		$only = null === $album_ids ? '' : ' AND pm.post_id IN (' . implode( ',', array_fill( 0, count( $album_ids ), '%d' ) ) . ')';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- One scan across albums; $only is a generated list of %d tokens, one per entry in $album_ids.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT pm.post_id, pm.meta_value
				FROM %i pm
				INNER JOIN %i p ON p.ID = pm.post_id AND p.post_type = %s
				LEFT JOIN %i r ON r.album_id = pm.post_id AND CAST( r.gallery_id AS CHAR ) = pm.meta_value
				WHERE pm.meta_key = %s AND r.id IS NULL{$only}",
				array_merge(
					array(
						$wpdb->postmeta,
						$wpdb->posts,
						Post_Types::ALBUM,
						$wpdb->prefix . 'fotogrids_gallery_albums',
						Post_Types::FEATURED_GALLERY_META_KEY,
					),
					$album_ids ?? array()
				)
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		$repaired = 0;
		foreach ( (array) $rows as $row ) {
			if ( delete_post_meta( (int) $row->post_id, Post_Types::FEATURED_GALLERY_META_KEY, $row->meta_value ) ) {
				++$repaired;
			}
		}

		if ( $repaired > 0 ) {
			\FotoGrids\FotoGrids_Cache::flush_all();
		}
	}
}
