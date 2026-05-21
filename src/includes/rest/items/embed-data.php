<?php
namespace FotoGrids\REST\Items;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Embed Data Handler
 *
 * Handles REST API endpoints for video embed (virtual) items:
 *  - resolve-embed  — fetches oEmbed metadata from YouTube / Vimeo
 *  - embed          — creates a virtual item row in fotogrids_item_meta
 *
 * Virtual items have attachment_id = 0 and store all embed data in
 * the custom_data JSON column. item_type is 'video_youtube' or 'video_vimeo'.
 *
 * @since 1.1.0
 */
class Embed_Data {

    /**
     * Supported platforms and their oEmbed endpoint templates.
     *
     * @var array<string, string>
     */
    private static $oembed_endpoints = array(
        'video_youtube' => 'https://www.youtube.com/oembed?url=%s&format=json',
        'video_vimeo'   => 'https://vimeo.com/api/oembed.json?url=%s',
    );

    // -------------------------------------------------------------------------
    // resolve-embed
    // -------------------------------------------------------------------------

    /**
     * Resolve an embed URL to its oEmbed metadata.
     *
     * Fetches title and thumbnail from the platform's public oEmbed endpoint
     * (no API key required for either YouTube or Vimeo). Falls back to a
     * client-constructible YouTube thumbnail URL on HTTP failure so the modal
     * can always show something.
     *
     * @since 1.1.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function resolve_embed( $request ) {
        $url    = esc_url_raw( $request->get_param( 'url' ) );
        $source = sanitize_key( $request->get_param( 'source' ) ); // 'video_youtube' | 'video_vimeo'

        if ( empty( $url ) ) {
            return new \WP_Error(
                'embed_url_missing',
                __( 'A video URL is required.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        if ( ! isset( self::$oembed_endpoints[ $source ] ) ) {
            return new \WP_Error(
                'embed_source_invalid',
                __( 'Unsupported embed source.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $video_id = self::extract_video_id( $url, $source );

        if ( empty( $video_id ) ) {
            return new \WP_Error(
                'embed_url_invalid',
                __( 'Could not extract a video ID from the provided URL.', 'fotogrids' ),
                array( 'status' => 422 )
            );
        }

        // Fetch oEmbed metadata.
        $oembed_url      = sprintf( self::$oembed_endpoints[ $source ], rawurlencode( $url ) );
        $oembed_response = wp_remote_get( $oembed_url, array(
            'timeout'    => 8,
            'user-agent' => 'FotoGrids/' . FOTOGRIDS_VERSION . '; ' . get_bloginfo( 'url' ),
        ) );

        $title         = '';
        $thumbnail_url = '';

        if ( ! is_wp_error( $oembed_response ) && 200 === wp_remote_retrieve_response_code( $oembed_response ) ) {
            $body = json_decode( wp_remote_retrieve_body( $oembed_response ), true );
            if ( is_array( $body ) ) {
                $title         = isset( $body['title'] )         ? sanitize_text_field( $body['title'] )         : '';
                $thumbnail_url = isset( $body['thumbnail_url'] ) ? esc_url_raw( $body['thumbnail_url'] )         : '';
            }
        }

        // YouTube fallback thumbnail — constructible without any API call.
        if ( empty( $thumbnail_url ) && 'video_youtube' === $source ) {
            $thumbnail_url = 'https://img.youtube.com/vi/' . $video_id . '/hqdefault.jpg';
        }

        return rest_ensure_response( array(
            'video_id'      => $video_id,
            'title'         => $title,
            'thumbnail_url' => $thumbnail_url,
            'source'        => $source,
        ) );
    }

    // -------------------------------------------------------------------------
    // embed (create virtual item)
    // -------------------------------------------------------------------------

    /**
     * Create a virtual embed item in a gallery.
     *
     * Inserts a row into fotogrids_item_meta with attachment_id = 0 and
     * item_type set to the platform identifier. All embed settings are stored
     * as JSON in the custom_data column.
     *
     * @since 1.1.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function create_embed( $request ) {
        global $wpdb;

        $gallery_id = absint( $request->get_param( 'gallery_id' ) );
        $source     = sanitize_key( $request->get_param( 'source' ) );
        $url        = esc_url_raw( $request->get_param( 'url' ) );
        $caption    = sanitize_text_field( $request->get_param( 'caption' ) );

        // Embed-specific settings passed through as-is (already validated by
        // arg schemas in register-items-routes.php).
        $embed_settings = $request->get_param( 'embed_settings' );
        if ( ! is_array( $embed_settings ) ) {
            $embed_settings = array();
        }

        // Validate gallery exists and belongs to this post type.
        if ( ! $gallery_id ) {
            return new \WP_Error(
                'embed_gallery_missing',
                __( 'A gallery ID is required.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $gallery = get_post( $gallery_id );
        if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
            return new \WP_Error(
                'embed_gallery_not_found',
                __( 'Gallery not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        if ( ! isset( self::$oembed_endpoints[ $source ] ) ) {
            return new \WP_Error(
                'embed_source_invalid',
                __( 'Unsupported embed source.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        if ( empty( $url ) ) {
            return new \WP_Error(
                'embed_url_missing',
                __( 'A video URL is required.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $video_id = self::extract_video_id( $url, $source );
        if ( empty( $video_id ) ) {
            return new \WP_Error(
                'embed_url_invalid',
                __( 'Could not extract a video ID from the provided URL.', 'fotogrids' ),
                array( 'status' => 422 )
            );
        }

        // Work out the next position in this gallery.
        $table    = $wpdb->prefix . 'fotogrids_item_meta';
        $position = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM $table WHERE gallery_id = %d",
            $gallery_id
        ) );

        // Build custom_data payload.
        $custom_data = wp_json_encode( array_merge(
            array(
                'embed_url'   => $url,
                'video_id'    => $video_id,
            ),
            self::sanitize_embed_settings( $embed_settings, $source )
        ) );

        $inserted = $wpdb->insert(
            $table,
            array(
                'attachment_id' => 0,
                'gallery_id'    => $gallery_id,
                'position'      => $position,
                'item_type'     => $source,
                'caption'       => $caption,
                'custom_data'   => $custom_data,
            ),
            array( '%d', '%d', '%d', '%s', '%s', '%s' )
        );

        if ( false === $inserted ) {
            return new \WP_Error(
                'embed_db_error',
                __( 'Failed to save the video embed. Please try again.', 'fotogrids' ),
                array( 'status' => 500 )
            );
        }

        $item_id = $wpdb->insert_id;

        /**
         * Fires after a virtual embed item has been created.
         *
         * @since 1.1.0
         * @param int    $item_id    The newly inserted row ID.
         * @param int    $gallery_id The gallery it belongs to.
         * @param string $source     The platform identifier (video_youtube|video_vimeo).
         */
        do_action( 'fotogrids/actions/item/added', $item_id, $gallery_id, $source );

        return rest_ensure_response( array(
            'id'          => $item_id,
            'gallery_id'  => $gallery_id,
            'position'    => $position,
            'item_type'   => $source,
            'caption'     => $caption,
            'custom_data' => json_decode( $custom_data, true ),
        ) );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Extract the video ID from a YouTube or Vimeo URL.
     *
     * @since 1.1.0
     * @param string $url    The embed URL.
     * @param string $source Platform identifier.
     * @return string  Video ID, or empty string on failure.
     */
    public static function extract_video_id( $url, $source ) {
        if ( 'video_youtube' === $source ) {
            // Handles: youtu.be/ID, youtube.com/watch?v=ID,
            //          youtube.com/embed/ID, youtube.com/shorts/ID
            if ( preg_match(
                '/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/',
                $url,
                $matches
            ) ) {
                return $matches[1];
            }
            return '';
        }

        if ( 'video_vimeo' === $source ) {
            // Handles: vimeo.com/ID, vimeo.com/video/ID
            if ( preg_match(
                '/vimeo\.com\/(?:video\/)?(\d+)/',
                $url,
                $matches
            ) ) {
                return $matches[1];
            }
            return '';
        }

        return '';
    }

    /**
     * Sanitize and normalise embed settings by platform.
     *
     * Only allows known boolean and string keys through; strips anything else.
     *
     * @since 1.1.0
     * @param array  $raw    Raw settings from the request.
     * @param string $source Platform identifier.
     * @return array  Sanitized settings array.
     */
    private static function sanitize_embed_settings( $raw, $source ) {
        $bool_keys = array(
            'autoplay', 'mute', 'loop', 'controls', 'captions',
            'privacy_mode', 'suggested_videos',
            'intro_title', 'intro_portrait', 'intro_byline',
        );

        $int_keys = array( 'start_time', 'end_time' );

        $string_keys = array( 'controls_color' );

        $out = array();

        foreach ( $bool_keys as $key ) {
            if ( isset( $raw[ $key ] ) ) {
                $out[ $key ] = (bool) $raw[ $key ];
            }
        }

        foreach ( $int_keys as $key ) {
            if ( isset( $raw[ $key ] ) ) {
                $value = absint( $raw[ $key ] );
                if ( $value > 0 ) {
                    $out[ $key ] = $value;
                }
            }
        }

        foreach ( $string_keys as $key ) {
            if ( isset( $raw[ $key ] ) && is_string( $raw[ $key ] ) ) {
                // Controls color — validate it's a hex colour.
                $value = sanitize_text_field( $raw[ $key ] );
                if ( preg_match( '/^#[0-9a-fA-F]{3,6}$/', $value ) ) {
                    $out[ $key ] = $value;
                }
            }
        }

        return $out;
    }
}
