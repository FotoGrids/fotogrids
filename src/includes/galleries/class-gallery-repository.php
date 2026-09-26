<?php
/**
 * Read-side repository for FotoGrids galleries.
 *
 * @package FotoGrids\Galleries
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Galleries;

use FotoGrids\Collection_Defaults;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Reads galleries, their item ids, their full item rows, and their resolved
 * settings.
 *
 * `get_settings()` preserves the historical contract of exposing a synthetic
 * `_password_encrypted` key (consumed by the Password gate). The public
 * `password` key is always blanked out.
 *
 * `get_items()` reads the item data for the whole gallery in one query through
 * Item_Meta and assembles each item row from the resulting map.
 *
 * @since 1.0.0
 */
final class Gallery_Repository {

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * This class is part of the FotoGrids custom-table data layer. Every
	 * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
	 * (or a WP core table such as $wpdb->posts) -- a trusted identifier that
	 * WP placeholders cannot bind. All user-supplied *values* are passed
	 * through $wpdb->prepare(); where SQL is assembled incrementally or uses
	 * a generated %d IN() list, the prepare call is a separate statement the
	 * sniff cannot follow. Custom tables have no WP_Query / core-API
	 * equivalent and no object-cache layer applies at this level.
	 * ---------------------------------------------------------------------
	 */
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

	/**
	 * Get a gallery post by ID, with post-type validation.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return \WP_Post|null Gallery post, or null when not found / wrong type.
	 */
	public static function get( int $gallery_id ): ?\WP_Post {
		$gallery = get_post( $gallery_id );

		if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
			return null;
		}

		return $gallery;
	}

	/**
	 * Get a gallery's resolved settings (defaults merged with saved post meta).
	 *
	 * Adds a synthetic `_password_encrypted` key with the raw ciphertext from
	 * `fotogrids_password` post meta - the Password gate calls
	 * `Password_Crypto::verify()` against this. The public `password` key in
	 * the returned array is always `''` so the ciphertext never leaks into
	 * REST responses or the public JS bundle.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return array<string, mixed> Gallery settings.
	 */
	public static function get_settings( int $gallery_id ): array {
		$defaults = Collection_Defaults::resolve_gallery();
		$settings = $defaults;

		foreach ( $defaults as $key => $default_value ) {
			$saved_value = get_post_meta( $gallery_id, 'fotogrids_' . $key, true );

			if ( '' === $saved_value ) {
				continue;
			}

			if ( is_string( $saved_value ) ) {
				$decoded = json_decode( $saved_value, true );
				if ( is_array( $decoded ) ) {
					$settings[ $key ] = is_array( $default_value )
						? array_merge( $default_value, $decoded )
						: $decoded;
				} else {
					$settings[ $key ] = $saved_value;
				}
			} else {
				$settings[ $key ] = $saved_value;
			}
		}

		// Password handling (see class docblock).
		$encrypted                       = (string) get_post_meta( $gallery_id, 'fotogrids_password', true );
		$settings['_password_encrypted'] = $encrypted;
		$settings['password']            = '';

		return $settings;
	}

	/**
	 * Read a gallery's item-id list (attachment IDs in display order).
	 *
	 * Stored as a JSON string under the `fotogrids_gallery_items` post meta
	 * key. Tolerates the historical array shape too.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return int[] Attachment IDs (may be empty).
	 */
	public static function get_item_ids( int $gallery_id ): array {
		$raw = get_post_meta( $gallery_id, 'fotogrids_gallery_items', true );

		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
				return array_map( 'intval', $decoded );
			}
		} elseif ( is_array( $raw ) ) {
			return array_map( 'intval', $raw );
		}

		return array();
	}

	/**
	 * Persist a gallery's item-id list (mixed attachment + embed post IDs).
	 *
	 * @since 1.1.0
	 * @param int   $gallery_id Gallery post ID.
	 * @param int[] $item_ids   Ordered item IDs.
	 * @return void
	 */
	public static function set_item_ids( int $gallery_id, array $item_ids ): void {
		$clean = array_values( array_map( 'intval', $item_ids ) );
		update_post_meta( $gallery_id, 'fotogrids_gallery_items', wp_json_encode( $clean ) );
	}

	/**
	 * Append an item ID to the end of a gallery's item list.
	 *
	 * No-op when the ID is already present.
	 *
	 * @since 1.1.0
	 * @param int $gallery_id Gallery post ID.
	 * @param int $item_id    Item ID (attachment or embed post).
	 * @return void
	 */
	public static function append_item_id( int $gallery_id, int $item_id ): void {
		$ids = self::get_item_ids( $gallery_id );
		if ( in_array( $item_id, $ids, true ) ) {
			return;
		}
		$ids[] = $item_id;
		self::set_item_ids( $gallery_id, $ids );
	}

	/**
	 * Remove an item ID from a gallery's item list.
	 *
	 * @since 1.1.0
	 * @param int $gallery_id Gallery post ID.
	 * @param int $item_id    Item ID to remove.
	 * @return void
	 */
	public static function remove_item_id( int $gallery_id, int $item_id ): void {
		$ids  = self::get_item_ids( $gallery_id );
		$next = array_values( array_filter( $ids, static fn ( $id ) => (int) $id !== $item_id ) );
		if ( count( $next ) !== count( $ids ) ) {
			self::set_item_ids( $gallery_id, $next );
		}
	}

	/**
	 * Find every gallery whose item list contains the given item.
	 *
	 * Membership is a JSON array in the `fotogrids_gallery_items` post meta,
	 * so the LIKE only narrows the candidate rows; each candidate is decoded
	 * and checked for an exact id match.
	 *
	 * @since 1.1.2
	 * @param int $item_id Item ID (attachment or embed post).
	 * @return int[] Gallery post IDs, in no particular order.
	 */
	public static function find_galleries_for_item( int $item_id ): array {
		if ( $item_id <= 0 ) {
			return array();
		}

		global $wpdb;

		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta}
             WHERE meta_key = 'fotogrids_gallery_items'
               AND meta_value LIKE %s",
				'%' . $wpdb->esc_like( (string) $item_id ) . '%'
			)
		);

		$gallery_ids = array();
		foreach ( (array) $rows as $gallery_id ) {
			$ids = self::get_item_ids( (int) $gallery_id );
			if ( in_array( $item_id, $ids, true ) ) {
				$gallery_ids[] = (int) $gallery_id;
			}
		}

		return $gallery_ids;
	}

	/**
	 * Find which gallery an embed post belongs to, by scanning item lists.
	 *
	 * Embeds are one-per-gallery, so this returns the first gallery whose item
	 * list contains the embed ID. Used to clean up the list on embed delete.
	 *
	 * @since 1.1.0
	 * @param int $embed_id Embed post ID.
	 * @return int Gallery ID, or 0 when none references it.
	 */
	public static function find_gallery_for_embed( int $embed_id ): int {
		$gallery_ids = self::find_galleries_for_item( $embed_id );

		return $gallery_ids[0] ?? 0;
	}

	/**
	 * Count valid attachments referenced by a gallery's item list.
	 *
	 * Skips ids whose `get_post()` either returns null or is no longer an
	 * `attachment` post type.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return int
	 */
	public static function get_item_count( int $gallery_id ): int {
		$item_ids = self::get_item_ids( $gallery_id );
		if ( empty( $item_ids ) ) {
			return 0;
		}

		$count = 0;
		foreach ( $item_ids as $item_id ) {
			$item = get_post( (int) $item_id );
			if ( $item && in_array( $item->post_type, array( 'attachment', Embed_Store::POST_TYPE ), true ) ) {
				++$count;
			}
		}

		return $count;
	}

	/**
	 * Get a gallery's full item rows (attachment fields + item data).
	 *
	 * Only attachments are returned; embeds and missing posts are skipped.
	 * Title, caption, description and alt come from the attachment post;
	 * credit, location, EXIF, custom data and link settings from Item_Meta.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return array<int, array<string, mixed>> Item rows in display order.
	 */
	public static function get_items( int $gallery_id ): array {
		$item_ids = self::get_item_ids( $gallery_id );
		if ( empty( $item_ids ) ) {
			return array();
		}

		$item_meta = Item_Meta::get_many( $item_ids );

		$items    = array();
		$position = 0;

		foreach ( $item_ids as $attachment_id ) {
			$attachment_id = (int) $attachment_id;
			$attachment    = get_post( $attachment_id );

			if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
				continue;
			}

			$meta = $item_meta[ $attachment_id ] ?? array();

			$items[] = array(
				'id'           => $attachment_id,
				'gallery_id'   => $gallery_id,
				'position'     => $position,
				'caption'      => $attachment->post_excerpt,
				'description'  => $attachment->post_content,
				'credit'       => (string) ( $meta['credit'] ?? '' ),
				'location'     => (string) ( $meta['location'] ?? '' ),
				'exif_data'    => ! empty( $meta['exif_data'] ) ? json_decode( $meta['exif_data'], true ) : null,
				'custom_data'  => ! empty( $meta['custom_data'] ) ? json_decode( $meta['custom_data'], true ) : null,
				'url'          => wp_get_attachment_url( $attachment_id ),
				'thumbnail'    => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
				'medium'       => wp_get_attachment_image_url( $attachment_id, 'medium' ),
				'large'        => wp_get_attachment_image_url( $attachment_id, 'large' ),
				'full'         => wp_get_attachment_url( $attachment_id ),
				'alt'          => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
				'title'        => $attachment->post_title,
				'external_url' => (string) ( $meta['external_url'] ?? '' ),
				'link_target'  => (string) ( $meta['link_target'] ?? '' ),
			);

			++$position;
		}

		return $items;
	}

	/**
	 * Collect the distinct item IDs held by every gallery with one of the given statuses.
	 *
	 * @since 1.1.4
	 * @param string[] $post_statuses Gallery post statuses to include.
	 * @return int[] Item IDs (attachments and embeds), newest gallery first.
	 */
	public static function all_item_ids( array $post_statuses ): array {
		$post_statuses = array_values( array_filter( array_map( 'sanitize_key', $post_statuses ) ) );
		if ( empty( $post_statuses ) ) {
			return array();
		}

		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $post_statuses ), '%s' ) );

		$lists = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT pm.meta_value FROM {$wpdb->postmeta} pm
             INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
             WHERE pm.meta_key = 'fotogrids_gallery_items'
               AND p.post_type = 'fotogrids_gallery'
               AND p.post_status IN ({$placeholders})
             ORDER BY p.post_date DESC, p.ID DESC",
				$post_statuses
			)
		);

		$item_ids = array();
		foreach ( (array) $lists as $raw ) {
			$decoded = json_decode( (string) $raw, true );
			if ( ! is_array( $decoded ) ) {
				continue;
			}
			foreach ( $decoded as $item_id ) {
				$item_id = (int) $item_id;
				if ( $item_id > 0 ) {
					$item_ids[ $item_id ] = true;
				}
			}
		}

		return array_keys( $item_ids );
	}

	/**
	 * Count the distinct, existing items held by galleries with the given statuses.
	 *
	 * An item that appears in several galleries counts once.
	 *
	 * @since 1.1.4
	 * @param string[] $post_statuses Gallery post statuses to include.
	 * @return int
	 */
	public static function count_all_items( array $post_statuses ): int {
		$item_ids = self::all_item_ids( $post_statuses );
		if ( empty( $item_ids ) ) {
			return 0;
		}

		global $wpdb;
		$count = 0;

		foreach ( array_chunk( $item_ids, 1000 ) as $chunk ) {
			$placeholders = implode( ',', array_fill( 0, count( $chunk ), '%d' ) );
			$count       += (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type IN ('attachment', %s) AND ID IN ({$placeholders})",
					array_merge( array( Embed_Store::POST_TYPE ), $chunk )
				)
			);
		}

		return $count;
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
