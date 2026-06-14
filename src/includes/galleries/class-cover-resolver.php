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
use FotoGrids\Galleries\Embed_Store;

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
     * Reads the gallery's `_thumbnail_id`. If it still points to an image
     * attachment that exists AND is still in the gallery's
     * `fotogrids_gallery_items`, that ID wins. Otherwise the first image
     * attachment is returned.
     *
     * This returns an attachment ID only — for callers that need a raw
     * attachment (e.g. attachment-meta consumers). Video and embed covers do
     * not have an attachment, so they are skipped here; use
     * `descriptor_for_gallery()` / `url_for_collection()` when a poster URL is
     * acceptable (the common case).
     *
     * @since 1.0.0
     * @param int $gallery_id Gallery post ID.
     * @return int Attachment ID, or 0 when no image attachment resolves.
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
            // Only an image attachment can serve as a raw-attachment cover; a
            // video attachment has no image src (use the descriptor instead).
            if ( $attachment
                && $attachment->post_type === 'attachment'
                && wp_attachment_is_image( $attachment_id ) ) {
                return $attachment_id;
            }
        }

        return 0;
    }

    /**
     * Resolve a cover descriptor for a gallery.
     *
     * Unlike for_gallery(), this returns the first displayable item of ANY kind
     * so embed-only and video-only galleries get a cover. The descriptor's
     * `url` is the image URL for an image attachment, or the resolved poster
     * URL for a video / embed.
     *
     * @since 1.1.0
     * @param int    $gallery_id Gallery post ID.
     * @param string $size       Image size keyword for the resolved URL.
     * @return array{kind:string, id:int, url:string} kind is 'attachment'|'embed'|'none'.
     */
    public static function descriptor_for_gallery( int $gallery_id, string $size = 'thumbnail' ): array {
        $none = array( 'kind' => 'none', 'id' => 0, 'url' => '' );

        if ( $gallery_id <= 0 ) {
            return $none;
        }

        $item_ids = self::gallery_item_ids( $gallery_id );
        if ( empty( $item_ids ) ) {
            return $none;
        }

        $picked     = (int) get_post_thumbnail_id( $gallery_id );
        $candidates = ( $picked > 0 && in_array( $picked, $item_ids, true ) )
            ? array_merge( [ $picked ], $item_ids )
            : $item_ids;

        foreach ( $candidates as $item_id ) {
            $item_id = (int) $item_id;
            if ( $item_id <= 0 || ! in_array( $item_id, $item_ids, true ) ) {
                continue;
            }

            $post = get_post( $item_id );
            if ( ! $post ) {
                continue;
            }

            if ( Embed_Store::POST_TYPE === $post->post_type ) {
                $embed = Embed_Store::get( $item_id );
                if ( null === $embed ) {
                    continue;
                }
                $url = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
                    (string) $embed['item_type'],
                    0,
                    array(
                        'thumbnail_url' => (string) $embed['thumbnail_url'],
                        'poster_id'     => (int) $embed['poster_id'],
                        'poster_url'    => (string) $embed['poster_url'],
                    ),
                    $size
                );
                if ( '' !== $url ) {
                    return array( 'kind' => 'embed', 'id' => $item_id, 'url' => $url );
                }
                continue;
            }

            if ( 'attachment' !== $post->post_type ) {
                continue;
            }

            // Image attachment: use its image URL directly.
            if ( wp_attachment_is_image( $item_id ) ) {
                $url = (string) ( wp_get_attachment_image_url( $item_id, $size ) ?: '' );
                if ( '' !== $url ) {
                    return array( 'kind' => 'attachment', 'id' => $item_id, 'url' => $url );
                }
                continue;
            }

            // Video-file attachment: resolve its poster.
            $item_type = \FotoGrids\Render\Video\Video_Item_Helpers::type_for_attachment( $item_id );
            if ( \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE === $item_type ) {
                $custom_data = self::attachment_custom_data( $item_id );
                $url = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
                    $item_type,
                    $item_id,
                    $custom_data,
                    $size
                );
                if ( '' !== $url ) {
                    return array( 'kind' => 'attachment', 'id' => $item_id, 'url' => $url );
                }
            }
        }

        return $none;
    }

    /**
     * Read the global custom_data row for a video attachment (for its poster).
     *
     * @since 1.1.0
     * @param int $attachment_id Attachment ID.
     * @return array<string, mixed>
     */
    private static function attachment_custom_data( int $attachment_id ): array {
        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $raw   = $wpdb->get_var( $wpdb->prepare(
            "SELECT custom_data FROM {$table} WHERE attachment_id = %d AND gallery_id = 0 LIMIT 1",
            $attachment_id
        ) );
        if ( empty( $raw ) ) {
            return array();
        }
        $decoded = json_decode( (string) $raw, true );
        return is_array( $decoded ) ? $decoded : array();
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
        return self::descriptor_for_collection( $post_id, $size )['url'];
    }

    /**
     * Resolve a cover descriptor for a gallery or album.
     *
     * Poster-aware: yields a URL for image, video-file, and embed covers, so
     * embed-only and video-only collections are never blank.
     *
     * @since 1.1.0
     * @param int    $post_id Gallery or album post ID.
     * @param string $size    Image size keyword for the URL.
     * @return array{kind:string, id:int, url:string}
     */
    public static function descriptor_for_collection( int $post_id, string $size = 'thumbnail' ): array {
        $none = array( 'kind' => 'none', 'id' => 0, 'url' => '' );

        if ( $post_id <= 0 ) {
            return $none;
        }

        $post_type = get_post_type( $post_id );
        if ( 'fotogrids_gallery' === $post_type ) {
            return self::descriptor_for_gallery( $post_id, $size );
        }
        if ( 'fotogrids_album' === $post_type ) {
            return self::descriptor_for_album( $post_id, $size );
        }

        return $none;
    }

    /**
     * Resolve a cover descriptor for an album from its child galleries.
     *
     * @since 1.1.0
     * @param int    $album_id Album post ID.
     * @param string $size     Image size keyword for the URL.
     * @return array{kind:string, id:int, url:string}
     */
    public static function descriptor_for_album( int $album_id, string $size = 'thumbnail' ): array {
        $none = array( 'kind' => 'none', 'id' => 0, 'url' => '' );

        if ( $album_id <= 0 ) {
            return $none;
        }

        $galleries = Gallery_Album_Relations::get_galleries_for_album( $album_id );
        if ( empty( $galleries ) ) {
            return $none;
        }

        $child_ids = [];
        foreach ( $galleries as $gallery ) {
            $gid = is_object( $gallery ) ? (int) ( $gallery->ID ?? $gallery->id ?? 0 ) : (int) $gallery;
            if ( $gid > 0 ) {
                $child_ids[] = $gid;
            }
        }
        if ( empty( $child_ids ) ) {
            return $none;
        }

        $picked = (int) get_post_meta( $album_id, 'fotogrids_featured_gallery', true );
        if ( $picked > 0 && in_array( $picked, $child_ids, true ) ) {
            $cover = self::descriptor_for_gallery( $picked, $size );
            if ( 'none' !== $cover['kind'] ) {
                return $cover;
            }
        }

        foreach ( $child_ids as $gid ) {
            $cover = self::descriptor_for_gallery( $gid, $size );
            if ( 'none' !== $cover['kind'] ) {
                return $cover;
            }
        }

        return $none;
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

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
