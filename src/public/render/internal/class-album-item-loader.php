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
     * @return array<int, Item_View>
     */
    public static function load( array $gallery_ids ): array {
        $items = [];

        foreach ( $gallery_ids as $raw_id ) {
            $gallery_id = (int) $raw_id;
            if ( $gallery_id <= 0 ) {
                continue;
            }

            $gallery_post = get_post( $gallery_id );
            if ( ! $gallery_post || $gallery_post->post_type !== 'fotogrids_gallery' ) {
                continue;
            }

            $thumb_url = self::resolve_thumbnail_url( $gallery_id );
            if ( $thumb_url === '' ) {
                // A gallery with no featured image and no items at all gets
                // skipped — there is literally nothing to show for it.
                continue;
            }

            $items[] = new Item_View(
                id:          $gallery_id,
                thumb_url:   $thumb_url,
                full_url:    $thumb_url,
                alt:         (string) $gallery_post->post_title,
                title:       (string) $gallery_post->post_title,
                caption:     (string) $gallery_post->post_excerpt,
                description: (string) $gallery_post->post_content,
                meta:        [
                    // Decorators that want to write album-specific data
                    // attributes (e.g. Album_To_View_Page writing the
                    // view-page URL) read this meta map.
                    'item_count' => self::count_items( $gallery_id ),
                ],
                thumb_size:  'medium',
            );
        }

        return $items;
    }

    /**
     * Resolve the gallery's thumbnail URL: featured image first, then
     * fall back to the first attachment's medium URL.
     *
     * @since  1.0.0
     * @param  int $gallery_id Gallery post ID.
     * @return string Empty string if neither source resolves.
     */
    private static function resolve_thumbnail_url( int $gallery_id ): string {
        $featured = get_the_post_thumbnail_url( $gallery_id, 'medium' );
        if ( is_string( $featured ) && $featured !== '' ) {
            return $featured;
        }

        if ( ! function_exists( 'fotogrids_get_gallery_item_ids' ) ) {
            return '';
        }

        $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );
        if ( ! is_array( $item_ids ) || empty( $item_ids ) ) {
            return '';
        }

        $first_id = (int) reset( $item_ids );
        if ( $first_id <= 0 ) {
            return '';
        }

        $url = wp_get_attachment_image_url( $first_id, 'medium' );
        return is_string( $url ) ? $url : '';
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
        if ( function_exists( 'fotogrids_get_gallery_item_count' ) ) {
            $count = fotogrids_get_gallery_item_count( $gallery_id );
            return is_numeric( $count ) ? (int) $count : 0;
        }
        if ( function_exists( 'fotogrids_get_gallery_item_ids' ) ) {
            $ids = fotogrids_get_gallery_item_ids( $gallery_id );
            return is_array( $ids ) ? count( $ids ) : 0;
        }
        return 0;
    }
}
