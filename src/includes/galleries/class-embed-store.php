<?php
/**
 * Storage helper for video embed posts (fotogrids_embed).
 *
 * @package FotoGrids\Galleries
 * @since   1.1.0
 */

declare(strict_types=1);

namespace FotoGrids\Galleries;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Reads and writes fotogrids_embed posts.
 *
 * Embeds are stored as posts so their IDs can sit in a gallery's item list
 * alongside attachment IDs. This class is the single place that knows the post
 * meta layout for an embed, so REST handlers, the render loader, the metabox,
 * and the lightbox slide builder all share one representation.
 *
 * Post fields:
 *   post_title    — caption
 *   post_type     — fotogrids_embed
 *   _thumbnail_id — custom poster attachment (WP-native)
 *
 * Post meta:
 *   fotogrids_embed_item_type     — video_youtube | video_vimeo
 *   fotogrids_embed_video_id      — platform video ID
 *   fotogrids_embed_url           — full embed URL
 *   fotogrids_embed_thumbnail_url — resolved oEmbed thumbnail
 *   fotogrids_embed_poster_url    — custom poster URL (when no poster_id)
 *   fotogrids_embed_settings      — JSON playback settings
 *
 * @since 1.1.0
 */
final class Embed_Store {

    public const POST_TYPE = 'fotogrids_embed';

    private const META_ITEM_TYPE     = 'fotogrids_embed_item_type';
    private const META_VIDEO_ID      = 'fotogrids_embed_video_id';
    private const META_URL           = 'fotogrids_embed_url';
    private const META_THUMBNAIL_URL = 'fotogrids_embed_thumbnail_url';
    private const META_POSTER_URL    = 'fotogrids_embed_poster_url';
    private const META_SETTINGS      = 'fotogrids_embed_settings';

    /**
     * Whether a post ID is a video embed post.
     *
     * @since 1.1.0
     * @param int $post_id Post ID.
     * @return bool
     */
    public static function is_embed( int $post_id ): bool {
        return self::POST_TYPE === get_post_type( $post_id );
    }

    /**
     * Create an embed post.
     *
     * @since 1.1.0
     * @param array{
     *   item_type:string, video_id:string, url:string, caption:string,
     *   thumbnail_url:string, settings:array, poster_id:int, poster_url:string
     * } $data Embed data.
     * @return int New post ID, or 0 on failure.
     */
    public static function create( array $data ): int {
        $post_id = wp_insert_post( array(
            'post_type'   => self::POST_TYPE,
            'post_status' => 'publish',
            'post_title'  => (string) ( $data['caption'] ?? '' ),
        ), true );

        if ( is_wp_error( $post_id ) || ! $post_id ) {
            return 0;
        }

        self::write_meta( (int) $post_id, $data );

        return (int) $post_id;
    }

    /**
     * Update an existing embed post.
     *
     * @since 1.1.0
     * @param int   $post_id Embed post ID.
     * @param array $data    Embed data (same shape as create()).
     * @return bool
     */
    public static function update( int $post_id, array $data ): bool {
        if ( ! self::is_embed( $post_id ) ) {
            return false;
        }

        wp_update_post( array(
            'ID'         => $post_id,
            'post_title' => (string) ( $data['caption'] ?? '' ),
        ) );

        self::write_meta( $post_id, $data );

        return true;
    }

    /**
     * Delete an embed post.
     *
     * @since 1.1.0
     * @param int $post_id Embed post ID.
     * @return bool
     */
    public static function delete( int $post_id ): bool {
        if ( ! self::is_embed( $post_id ) ) {
            return false;
        }
        return (bool) wp_delete_post( $post_id, true );
    }

    /**
     * Load an embed's full data array from its post.
     *
     * @since 1.1.0
     * @param int $post_id Embed post ID.
     * @return array<string, mixed>|null Data array, or null when not an embed.
     */
    public static function get( int $post_id ): ?array {
        $post = get_post( $post_id );
        if ( ! $post || self::POST_TYPE !== $post->post_type ) {
            return null;
        }

        $settings_raw = get_post_meta( $post_id, self::META_SETTINGS, true );
        $settings     = is_string( $settings_raw ) ? json_decode( $settings_raw, true ) : array();
        if ( ! is_array( $settings ) ) {
            $settings = array();
        }

        $poster_id = (int) get_post_thumbnail_id( $post_id );

        return array(
            'id'            => $post_id,
            'item_type'     => (string) get_post_meta( $post_id, self::META_ITEM_TYPE, true ),
            'video_id'      => (string) get_post_meta( $post_id, self::META_VIDEO_ID, true ),
            'url'           => (string) get_post_meta( $post_id, self::META_URL, true ),
            'thumbnail_url' => (string) get_post_meta( $post_id, self::META_THUMBNAIL_URL, true ),
            'poster_id'     => $poster_id,
            'poster_url'    => (string) get_post_meta( $post_id, self::META_POSTER_URL, true ),
            'caption'       => (string) $post->post_title,
            'settings'      => $settings,
        );
    }

    /**
     * Write embed meta from a data array. Poster handling: poster_id sets the
     * post thumbnail; poster_url is stored as a fallback. A zero/empty poster
     * clears both.
     *
     * @since 1.1.0
     * @param int   $post_id Embed post ID.
     * @param array $data    Embed data.
     * @return void
     */
    private static function write_meta( int $post_id, array $data ): void {
        if ( isset( $data['item_type'] ) ) {
            update_post_meta( $post_id, self::META_ITEM_TYPE, (string) $data['item_type'] );
        }
        if ( isset( $data['video_id'] ) ) {
            update_post_meta( $post_id, self::META_VIDEO_ID, (string) $data['video_id'] );
        }
        if ( isset( $data['url'] ) ) {
            update_post_meta( $post_id, self::META_URL, (string) $data['url'] );
        }
        if ( isset( $data['thumbnail_url'] ) ) {
            update_post_meta( $post_id, self::META_THUMBNAIL_URL, (string) $data['thumbnail_url'] );
        }
        if ( isset( $data['settings'] ) && is_array( $data['settings'] ) ) {
            update_post_meta( $post_id, self::META_SETTINGS, wp_json_encode( $data['settings'] ) );
        }

        if ( array_key_exists( 'poster_id', $data ) ) {
            $poster_id = (int) $data['poster_id'];
            if ( $poster_id > 0 ) {
                set_post_thumbnail( $post_id, $poster_id );
            } else {
                delete_post_thumbnail( $post_id );
            }
        }
        if ( array_key_exists( 'poster_url', $data ) ) {
            $poster_url = (string) $data['poster_url'];
            if ( '' !== $poster_url ) {
                update_post_meta( $post_id, self::META_POSTER_URL, esc_url_raw( $poster_url ) );
            } else {
                delete_post_meta( $post_id, self::META_POSTER_URL );
            }
        }
    }
}
