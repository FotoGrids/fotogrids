<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Item_View;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Loads album items as gallery-summary Item_Views.
 *
 * For an album rendering its child galleries, each "item" in the render
 * context is a gallery, not an attachment. This loader returns an
 * Item_View per gallery, with:
 *
 *   • id          = the gallery's post ID
 *   • thumb_url   = the gallery's featured-image URL (set via the WP
 *                   featured image picker on the gallery CPT). If none
 *                   is set, falls back to the first attachment's
 *                   medium URL.
 *   • full_url    = same as thumb_url (albums have no lightbox; the
 *                   field is only populated to keep Item_View shape).
 *   • title       = gallery's post_title
 *   • caption     = gallery's post_excerpt
 *   • description = gallery's post_content
 *
 * Click behaviour (where the item links to) is handled by the
 * Album_To_View_Page and Album_To_Gallery_Ajax decorators, not by this
 * loader.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Album_Item_Loader {

	/**
	 * Build Item_Views from a list of gallery post IDs.
	 *
	 * Signature matches Context_Builder's items_loader contract:
	 * receives an array of IDs, returns an array of Item_View.
	 *
	 * @since  1.0.0
	 * @param  array<int, mixed> $gallery_ids Gallery post IDs.
	 * @param  string            $thumb_size  WP image size slug used for the album's gallery-cover thumbs.
	 * @return array<int, Item_View>
	 */
	public static function load( array $gallery_ids, string $thumb_size = 'medium' ): array {
		$items = array();

		foreach ( $gallery_ids as $raw_id ) {
			$gallery_id = (int) $raw_id;
			if ( $gallery_id <= 0 ) {
				continue;
			}

			$gallery_post = get_post( $gallery_id );
			if ( ! $gallery_post || 'fotogrids_gallery' !== $gallery_post->post_type ) {
				continue;
			}

			$thumb = self::resolve_thumbnail( $gallery_id, $thumb_size );
			if ( '' === $thumb['url'] ) {
				// A gallery with no featured image and no items at all gets
				// skipped - there is literally nothing to show for it.
				continue;
			}

			$items[] = new Item_View(
				$gallery_id,
				$thumb['url'],
				$thumb['url'],
				(string) $gallery_post->post_title,
				(string) $gallery_post->post_title,
				(string) $gallery_post->post_excerpt,
				(string) $gallery_post->post_content,
				'',
				'',
				$thumb['width'],
				$thumb['height'],
				array(
					'item_count' => self::count_items( $gallery_id ),
				),
				array(),
				array(),
				array(),
				array(),
				array(),
				array(),
				array(),
				$thumb_size,
			);
		}

		return $items;
	}

	/**
	 * Resolve the gallery's thumbnail (featured image first, then the first
	 * attachment's image at the requested size) as an associative array with
	 * url + intrinsic dimensions.
	 *
	 * @since  1.0.0
	 * @param  int    $gallery_id Gallery post ID.
	 * @param  string $thumb_size WP image size slug.
	 * @return array{url: string, width: int|null, height: int|null}
	 */
	private static function resolve_thumbnail( int $gallery_id, string $thumb_size ): array {
		$featured_id = (int) get_post_thumbnail_id( $gallery_id );
		if ( $featured_id > 0 ) {
			$src = wp_get_attachment_image_src( $featured_id, $thumb_size );
			if ( is_array( $src ) && ! empty( $src[0] ) ) {
				return array(
					'url'    => (string) $src[0],
					'width'  => isset( $src[1] ) ? (int) $src[1] : null,
					'height' => isset( $src[2] ) ? (int) $src[2] : null,
				);
			}
		}

		if ( ! class_exists( '\FotoGrids\Galleries\Gallery_Repository' ) ) {
			return array(
				'url'    => '',
				'width'  => null,
				'height' => null,
			);
		}

		$item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
		if ( ! is_array( $item_ids ) || empty( $item_ids ) ) {
			return array(
				'url'    => '',
				'width'  => null,
				'height' => null,
			);
		}

		$first_id = (int) reset( $item_ids );
		if ( $first_id <= 0 ) {
			return array(
				'url'    => '',
				'width'  => null,
				'height' => null,
			);
		}

		$src = wp_get_attachment_image_src( $first_id, $thumb_size );
		if ( ! is_array( $src ) || empty( $src[0] ) ) {
			return array(
				'url'    => '',
				'width'  => null,
				'height' => null,
			);
		}

		return array(
			'url'    => (string) $src[0],
			'width'  => isset( $src[1] ) ? (int) $src[1] : null,
			'height' => isset( $src[2] ) ? (int) $src[2] : null,
		);
	}

	/**
	 * Count items in a gallery; used as item_count meta on the album
	 * item so a future decorator can render "12 items" badges without
	 * re-querying.
	 *
	 * @since  1.0.0
	 * @param  int $gallery_id Gallery post ID.
	 * @return int
	 */
	private static function count_items( int $gallery_id ): int {
		if ( ! class_exists( '\FotoGrids\Galleries\Gallery_Repository' ) ) {
			return 0;
		}
		return \FotoGrids\Galleries\Gallery_Repository::get_item_count( $gallery_id );
	}
}
