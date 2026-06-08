<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Lightbox;

use FotoGrids\Hooks\Filters_Lightbox;
use FotoGrids\Image_Size_Manager;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Hydrates an attachment ID into a slide dict for the lightbox.
 *
 * The lightbox runs in pure JS once the slide data is in hand — no
 * server round-trip per pane. This class is the single place where an
 * attachment's WP metadata + FotoGrids item meta + EXIF + tag joins
 * resolve into the flat dict the lightbox JS expects.
 *
 * Reused by:
 *   - POST /fotogrids/v1/gallery/lightbox/slides (batch hydration on
 *     navigate-into-uncached-range).
 *
 * Future Pro hooks may add more fields (people, location, GPS) by
 * extending the returned array via a filter — but Free defines the
 * canonical contract here.
 *
 * @package FotoGrids\Render\Features\Lightbox
 * @since   1.0.0
 */
final class Lightbox_Slide_Builder {

    /**
     * Build slide dicts for an ordered list of attachment IDs.
     *
     * Batches the WP queries (one for posts, one for item_meta, one for
     * tag joins) so a 20-slide payload is 3 SQL queries + meta lookups.
     *
     * @since 1.0.0
     * @param array<int, int>      $attachment_ids
     * @param array<string, mixed> $settings  Resolved gallery settings.
     * @return array<int, array<string, mixed>> Slide dicts in input order.
     */
    public static function build_many( array $attachment_ids, array $settings ): array {
        $ids = array_values( array_unique( array_map( 'intval', $attachment_ids ) ) );
        $ids = array_filter( $ids, static fn( $id ) => $id > 0 );
        if ( empty( $ids ) ) {
            return [];
        }

        [ $thumb_size_slug, $full_size_slug ] = self::resolve_size_slugs( $settings );
        $link_meta  = self::batch_load_link_meta( $ids );
        $tag_map    = self::batch_load_tag_slugs( $ids, 'tag' );

        // Pro-tier metadata — present only if subscriber Pro filter
        // sources are active; harmless to query in Free since the table
        // exists. The lightbox UI gates display via settings.
        $people_map   = self::batch_load_tag_slugs( $ids, 'person' );
        $location_map = self::batch_load_tag_slugs( $ids, 'location' );

        $include_exif = self::should_include_exif( $settings );

        $slides = [];
        foreach ( $ids as $aid ) {
            $post = get_post( $aid );
            if ( ! $post ) {
                continue;
            }

            // Embed posts produce a video slide built from their stored data.
            if ( \FotoGrids\Galleries\Embed_Store::POST_TYPE === $post->post_type ) {
                $embed_slide = self::build_embed_slide( $aid, $full_size_slug );
                if ( null !== $embed_slide ) {
                    $slides[] = $embed_slide;
                }
                continue;
            }

            if ( $post->post_type !== 'attachment' ) {
                continue;
            }

            $thumb_resolved = Image_Size_Manager::resolve_size( $aid, $thumb_size_slug, 'thumbnail' );
            $full_resolved  = Image_Size_Manager::resolve_size( $aid, $full_size_slug,  'full' );

            $caption_title = (string) $post->post_excerpt;
            $description   = (string) $post->post_content;

            $slide = [
                'id'           => $aid,
                'thumb_url'    => (string) ( wp_get_attachment_image_url( $aid, $thumb_resolved ) ?: '' ),
                'full_url'     => (string) ( wp_get_attachment_image_url( $aid, $full_resolved )  ?: '' ),
                'alt'          => (string) get_post_meta( $aid, '_wp_attachment_image_alt', true ),
                'title'        => (string) $post->post_title,
                'caption'      => $caption_title,
                'description'  => $description,
                'tags'         => array_values( $tag_map[ $aid ]     ?? [] ),
                'people'       => array_values( $people_map[ $aid ]   ?? [] ),
                'location'     => array_values( $location_map[ $aid ] ?? [] ),
                'external_url' => (string) ( $link_meta[ $aid ]['external_url'] ?? '' ),
                'link_target'  => (string) ( $link_meta[ $aid ]['link_target']  ?? 'global' ),
            ];

            // Media Library videos carry no image src; supply video fields so
            // the lightbox renders a player. The poster (custom or native)
            // becomes the slide thumb/full image.
            if ( \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE
                === \FotoGrids\Render\Video\Video_Item_Helpers::type_for_attachment( $aid ) ) {
                $custom_data = self::load_custom_data( $aid );
                $poster      = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
                    \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE,
                    $aid,
                    $custom_data,
                    $full_resolved
                );
                $slide['item_type']      = \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE;
                $slide['video_src']      = (string) ( wp_get_attachment_url( $aid ) ?: '' );
                $slide['embed_provider'] = '';
                $slide['embed_id']       = '';
                $slide['embed_settings'] = $custom_data;
                $slide['thumb_url']      = $poster;
                $slide['full_url']       = $poster;
            }

            if ( $include_exif ) {
                $slide['exif'] = self::load_exif( $aid, $settings );
            }

            $slides[] = $slide;
        }

        /**
         * Filter the slide list. Pro extensions can append fields to
         * each slide here (e.g. GPS coords, view-page URL, custom
         * metadata).
         *
         * @since 1.0.0
         * @param array<int, array<string, mixed>> $slides
         * @param array<int, int>                  $attachment_ids
         * @param array<string, mixed>             $settings
         */
        return (array) apply_filters( Filters_Lightbox::SLIDES, $slides, $ids, $settings );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Resolves thumb + full size slugs from gallery settings, mirroring
     * Context_Builder::resolve_size_settings. Registers custom sizes
     * on the fly if needed.
     *
     * @return array{string, string} [thumb_slug, full_slug]
     */
    private static function resolve_size_slugs( array $settings ): array {
        $raw_thumb = is_string( $settings['thumbnail_size'] ?? null )
            ? $settings['thumbnail_size']
            : Image_Size_Manager::SLUG_THUMBNAIL;
        $raw_full = is_string( $settings['full_image_size'] ?? null )
            ? $settings['full_image_size']
            : Image_Size_Manager::SLUG_FULL;

        $thumb_slug = $raw_thumb;
        if ( $raw_thumb === 'custom' ) {
            $w         = max( 1, (int) ( $settings['thumbnail_custom_size_width']  ?? 400 ) );
            $h         = max( 0, (int) ( $settings['thumbnail_custom_size_height'] ?? 300 ) );
            $crop      = (bool) ( $settings['thumbnail_custom_size_crop'] ?? true );
            $alignment = is_string( $settings['thumbnail_custom_size_crop_alignment'] ?? null )
                ? $settings['thumbnail_custom_size_crop_alignment']
                : 'center';
            $thumb_slug = Image_Size_Manager::register_custom_size( $w, $h, $crop, $alignment );
        }

        $full_slug = $raw_full;
        if ( $raw_full === 'custom' ) {
            $w         = max( 1, (int) ( $settings['full_image_custom_size_width']  ?? 1920 ) );
            $h         = max( 0, (int) ( $settings['full_image_custom_size_height'] ?? 0 ) );
            $crop      = (bool) ( $settings['full_image_custom_size_crop'] ?? false );
            $alignment = is_string( $settings['full_image_custom_size_crop_alignment'] ?? null )
                ? $settings['full_image_custom_size_crop_alignment']
                : 'center';
            $full_slug = Image_Size_Manager::register_custom_size( $w, $h, $crop, $alignment );
        }

        return [ $thumb_slug, $full_slug ];
    }

    /**
     * Batch-load external_url + link_target from fotogrids_item_meta.
     *
     * @param array<int, int> $ids
     * @return array<int, array{external_url: string, link_target: string}>
     */
    /**
     * Build a lightbox slide dict for an embed post.
     *
     * @since 1.1.0
     * @param int    $embed_id        The fotogrids_embed post ID.
     * @param string $full_size_slug  Resolved WP size slug for the poster.
     * @return array<string, mixed>|null
     */
    private static function build_embed_slide( int $embed_id, string $full_size_slug ): ?array {
        $embed = \FotoGrids\Galleries\Embed_Store::get( $embed_id );
        if ( null === $embed ) {
            return null;
        }

        $item_type = (string) $embed['item_type'];
        $caption   = (string) $embed['caption'];
        $poster    = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
            $item_type,
            0,
            array(
                'thumbnail_url' => (string) $embed['thumbnail_url'],
                'poster_id'     => (int) $embed['poster_id'],
                'poster_url'    => (string) $embed['poster_url'],
            ),
            $full_size_slug
        );

        return array(
            'id'             => $embed_id,
            'thumb_url'      => $poster,
            'full_url'       => $poster,
            'alt'            => $caption,
            'title'          => $caption,
            'caption'        => $caption,
            'description'    => '',
            'tags'           => array(),
            'people'         => array(),
            'location'       => array(),
            'external_url'   => '',
            'link_target'    => 'global',
            'item_type'      => $item_type,
            'video_src'      => '',
            'embed_provider' => \FotoGrids\Render\Video\Video_Item_Helpers::provider_for_type( $item_type ),
            'embed_id'       => (string) $embed['video_id'],
            'embed_settings' => is_array( $embed['settings'] ?? null ) ? $embed['settings'] : array(),
        );
    }

    /**
     * Read and decode custom_data for one attachment's global item row.
     *
     * @since 1.1.0
     * @param int $aid Attachment ID.
     * @return array<string, mixed>
     */
    private static function load_custom_data( int $aid ): array {
        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';

        $raw = $wpdb->get_var( $wpdb->prepare(
            "SELECT custom_data FROM {$table} WHERE attachment_id = %d AND gallery_id = 0 LIMIT 1",
            $aid
        ) );

        if ( empty( $raw ) ) {
            return [];
        }

        $decoded = json_decode( (string) $raw, true );
        return is_array( $decoded ) ? $decoded : [];
    }

    private static function batch_load_link_meta( array $ids ): array {
        if ( empty( $ids ) ) {
            return [];
        }
        global $wpdb;
        $table        = $wpdb->prefix . 'fotogrids_item_meta';
        $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT attachment_id, external_url, link_target FROM {$table} WHERE gallery_id = 0 AND attachment_id IN ({$placeholders})",
                ...$ids
            ),
            ARRAY_A
        );
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        $out = [];
        if ( is_array( $rows ) ) {
            foreach ( $rows as $row ) {
                $aid = (int) $row['attachment_id'];
                $out[ $aid ] = [
                    'external_url' => (string) ( $row['external_url'] ?? '' ),
                    'link_target'  => (string) ( $row['link_target']  ?? 'global' ),
                ];
            }
        }
        return $out;
    }

    /**
     * Batch-load tag/person/location slugs (single type per call) from
     * fotogrids_item_metadata + fotogrids_tags.
     *
     * @param array<int, int> $ids
     * @param string          $type 'tag' | 'person' | 'location'
     * @return array<int, array<int, string>>
     */
    private static function batch_load_tag_slugs( array $ids, string $type ): array {
        if ( empty( $ids ) ) {
            return [];
        }
        global $wpdb;
        $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT im.attachment_id, t.slug
                 FROM {$wpdb->prefix}fotogrids_item_metadata im
                 INNER JOIN {$wpdb->prefix}fotogrids_tags t
                     ON t.id = im.metadata_id AND t.type = %s
                 WHERE im.metadata_type = %s
                   AND im.attachment_id IN ($placeholders)
                 ORDER BY t.name ASC",
                $type,
                $type,
                ...$ids
            ),
            ARRAY_A
        );
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        $out = [];
        if ( is_array( $rows ) ) {
            foreach ( $rows as $row ) {
                $aid = (int) $row['attachment_id'];
                $out[ $aid ][] = (string) $row['slug'];
            }
        }
        return $out;
    }

    private static function should_include_exif( array $settings ): bool {
        // EXIF is shown when both the info block is enabled AND the
        // EXIF block specifically appears in lightbox_info_blocks.
        $blocks = $settings['lightbox_info_blocks'] ?? [];
        if ( ! is_array( $blocks ) ) {
            return false;
        }
        return in_array( 'exif', $blocks, true );
    }

    /**
     * Load EXIF for an attachment, scoped to the fields the gallery
     * wants to display. Reads from WordPress's attachment metadata
     * (post_mime_type=image/*) — no extra table.
     *
     * @return array<string, mixed>
     */
    private static function load_exif( int $aid, array $settings ): array {
        $meta = wp_get_attachment_metadata( $aid );
        if ( ! is_array( $meta ) || empty( $meta['image_meta'] ) || ! is_array( $meta['image_meta'] ) ) {
            return [];
        }

        $allowed = $settings['lightbox_exif_fields'] ?? [];
        if ( ! is_array( $allowed ) ) {
            $allowed = [];
        }

        // Map FotoGrids EXIF field keys → WP image_meta keys.
        $map = [
            'camera'        => 'camera',
            'aperture'      => 'aperture',
            'shutter_speed' => 'shutter_speed',
            'iso'           => 'iso',
            'focal_length'  => 'focal_length',
            'orientation'   => 'orientation',
            'created_at'    => 'created_timestamp',
            'lens'          => 'lens',
        ];

        $out = [];
        foreach ( $allowed as $field ) {
            if ( ! is_string( $field ) ) {
                continue;
            }
            $wp_key = $map[ $field ] ?? $field;
            if ( ! array_key_exists( $wp_key, $meta['image_meta'] ) ) {
                continue;
            }
            $value = $meta['image_meta'][ $wp_key ];
            if ( $value === '' || $value === 0 || $value === '0' ) {
                continue;
            }
            $out[ $field ] = $value;
        }
        return $out;
    }
}
