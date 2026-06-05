<?php
/**
 * Cover-image resolution for galleries, albums, and collections.
 *
 * @package FotoGrids\Galleries
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Galleries;

use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Galleries\Gallery_Repository;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Resolves the cover-image attachment (and its URL) for any FotoGrids collection.
 *
 * Used by REST list endpoints, statistics cards, relations widgets, view-page
 * Open Graph, the gallery metabox, and anywhere else a "thumbnail for this
 * collection" is needed. All resolution rules live here so the behaviour is
 * consistent across surfaces.
 *
 * @since 1.0.0
 */
final class Cover_Resolver {

    /**
     * Resolve the cover-image attachment ID for a gallery or album.
     *
     * Dispatcher used by every cover-image consumer. Returns 0 when the post
     * is not a FotoGrids collection or has no resolvable cover.
     *
     * @since 1.0.0
     * @param int $post_id Gallery or album post ID.
     * @return int Attachment ID, or 0 when nothing resolves.
     */
    public static function for_collection( int $post_id ): int {
        if ( $post_id <= 0 ) {
            return 0;
        }

        $post_type = get_post_type( $post_id );
        if ( $post_type === 'fotogrids_gallery' ) {
            return self::for_gallery( $post_id );
        }
        if ( $post_type === 'fotogrids_album' ) {
            return self::for_album( $post_id );
        }

        return 0;
    }

    /**
     * Resolve the cover-image attachment ID for a gallery.
     *
     * Reads the gallery's `_thumbnail_id`. If it still points to an attachment
     * that exists AND is still in the gallery's `fotogrids_gallery_items`,
     * that ID wins. Otherwise the first valid item is returned.
     *
     * @since 1.0.0
     * @param int $gallery_id Gallery post ID.
     * @return int Attachment ID, or 0 when nothing resolves.
     */
    public static function for_gallery( int $gallery_id ): int {
        if ( $gallery_id <= 0 ) {
            return 0;
        }

        $item_ids = self::gallery_item_ids( $gallery_id );
        if ( empty( $item_ids ) ) {
            return 0;
        }

        $picked     = (int) get_post_thumbnail_id( $gallery_id );
        $candidates = $picked > 0 ? array_merge( [ $picked ], $item_ids ) : $item_ids;

        foreach ( $candidates as $attachment_id ) {
            $attachment_id = (int) $attachment_id;
            if ( $attachment_id <= 0 ) {
                continue;
            }
            if ( ! in_array( $attachment_id, $item_ids, true ) ) {
                continue;
            }
            $attachment = get_post( $attachment_id );
            if ( $attachment && $attachment->post_type === 'attachment' ) {
                return $attachment_id;
            }
        }

        return 0;
    }

    /**
     * Resolve the cover-image attachment ID for an album.
     *
     * Reads `fotogrids_featured_gallery`. If it still names a gallery that
     * exists AND is still a child of this album AND that gallery has a
     * resolvable cover, that wins. Otherwise the first child gallery with
     * a resolvable cover is returned.
     *
     * @since 1.0.0
     * @param int $album_id Album post ID.
     * @return int Attachment ID, or 0 when nothing resolves.
     */
    public static function for_album( int $album_id ): int {
        if ( $album_id <= 0 ) {
            return 0;
        }

        $galleries = Gallery_Album_Relations::get_galleries_for_album( $album_id );
        if ( empty( $galleries ) ) {
            return 0;
        }

        $child_ids = [];
        foreach ( $galleries as $gallery ) {
            $gid = is_object( $gallery ) ? (int) ( $gallery->ID ?? $gallery->id ?? 0 ) : (int) $gallery;
            if ( $gid > 0 ) {
                $child_ids[] = $gid;
            }
        }
        if ( empty( $child_ids ) ) {
            return 0;
        }

        $picked = (int) get_post_meta( $album_id, 'fotogrids_featured_gallery', true );
        if ( $picked > 0 && in_array( $picked, $child_ids, true ) ) {
            $cover = self::for_gallery( $picked );
            if ( $cover > 0 ) {
                return $cover;
            }
        }

        foreach ( $child_ids as $gid ) {
            $cover = self::for_gallery( $gid );
            if ( $cover > 0 ) {
                return $cover;
            }
        }

        return 0;
    }

    /**
     * Resolve the cover-image URL for a gallery or album.
     *
     * Thin convenience wrapper around `for_collection` +
     * `wp_get_attachment_image_url`. Returns an empty string when nothing resolves.
     *
     * @since 1.0.0
     * @param int    $post_id Gallery or album post ID.
     * @param string $size    Image size keyword. Default 'thumbnail'.
     * @return string Cover image URL, or empty string when nothing resolves.
     */
    public static function url_for_collection( int $post_id, string $size = 'thumbnail' ): string {
        $attachment_id = self::for_collection( $post_id );
        if ( $attachment_id <= 0 ) {
            return '';
        }

        $url = wp_get_attachment_image_url( $attachment_id, $size );
        return is_string( $url ) ? $url : '';
    }

    /**
     * Read a gallery's item-id list via the repository.
     *
     * @param int $gallery_id Gallery post ID.
     * @return int[] Array of attachment IDs (always integers, may be empty).
     */
    private static function gallery_item_ids( int $gallery_id ): array {
        return Gallery_Repository::get_item_ids( $gallery_id );
    }
}
