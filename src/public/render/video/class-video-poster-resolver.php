<?php
/**
 * Resolves a poster image URL for a video gallery item.
 *
 * @package FotoGrids\Render\Video
 * @since   1.1.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Video;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Poster resolution for file and embed video items.
 *
 * Resolves the still image shown in the gallery grid (and used as the lightbox
 * poster) for a video item, walking a priority chain so there is always
 * something to show:
 *
 *   1. Custom poster — poster_id (attachment) or poster_url stored in the
 *      item's custom_data. Set by the admin.
 *   2. File video: WordPress's native attachment poster (the video's featured
 *      image / "Video Thumbnail").
 *   3. Embed: the oEmbed thumbnail captured at create time (custom_data).
 *   4. Empty string — the renderer falls back to a CSS placeholder tile.
 *
 * Frame extraction from the video file is intentionally not performed here; it
 * is an opportunistic, host-dependent upload-time concern. The resolver only
 * consumes posters that already exist.
 *
 * @package FotoGrids\Render\Video
 * @since   1.1.0
 */
final class Video_Poster_Resolver {

    /**
     * Resolve a poster URL for a video item.
     *
     * @since 1.1.0
     * @param string               $item_type     One of the video item_type values.
     * @param int                  $attachment_id Attachment ID for file videos; 0 for embeds.
     * @param array<string, mixed> $custom_data   Decoded custom_data for the item.
     * @param string               $size          WP image size slug for the custom/file poster.
     * @return string Poster URL, or empty string when none is resolvable.
     */
    public static function resolve(
        string $item_type,
        int $attachment_id,
        array $custom_data,
        string $size = 'large'
    ): string {
        $custom = self::resolve_custom_poster( $custom_data, $size );
        if ( '' !== $custom ) {
            return $custom;
        }

        if ( Video_Item_Helpers::TYPE_FILE === $item_type && $attachment_id > 0 ) {
            $native = self::resolve_attachment_poster( $attachment_id, $size );
            if ( '' !== $native ) {
                return $native;
            }
        }

        if ( Video_Item_Helpers::is_embed( $item_type ) ) {
            $thumb = isset( $custom_data['thumbnail_url'] ) ? (string) $custom_data['thumbnail_url'] : '';
            if ( '' !== $thumb ) {
                return $thumb;
            }
        }

        return '';
    }

    /**
     * Resolve an admin-set custom poster from custom_data.
     *
     * Prefers poster_id (a Media Library attachment) over a raw poster_url so
     * the chosen image benefits from WP's responsive sizes.
     *
     * @since 1.1.0
     * @param array<string, mixed> $custom_data Decoded custom_data for the item.
     * @param string               $size        WP image size slug.
     * @return string
     */
    private static function resolve_custom_poster( array $custom_data, string $size ): string {
        $poster_id = isset( $custom_data['poster_id'] ) ? (int) $custom_data['poster_id'] : 0;
        if ( $poster_id > 0 ) {
            $url = wp_get_attachment_image_url( $poster_id, $size );
            if ( is_string( $url ) && '' !== $url ) {
                return $url;
            }
        }

        $poster_url = isset( $custom_data['poster_url'] ) ? (string) $custom_data['poster_url'] : '';
        return $poster_url;
    }

    /**
     * Resolve WordPress's native poster for a video attachment.
     *
     * Reads the video attachment's featured image (the "Video Thumbnail" set
     * in the Media Library), which WordPress stores as the attachment's
     * _thumbnail_id.
     *
     * @since 1.1.0
     * @param int    $attachment_id The video attachment ID.
     * @param string $size          WP image size slug.
     * @return string
     */
    private static function resolve_attachment_poster( int $attachment_id, string $size ): string {
        $poster_id = (int) get_post_thumbnail_id( $attachment_id );
        if ( $poster_id <= 0 ) {
            return '';
        }

        $url = wp_get_attachment_image_url( $poster_id, $size );
        return is_string( $url ) ? $url : '';
    }
}
