<?php
/**
 * REST handlers for watermark variant status and regeneration.
 *
 * @package FotoGrids\Watermark
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Watermark;

use FotoGrids\Settings\Watermark_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Reports which gallery images still need a watermark and regenerates them.
 *
 * Scope is optional: with no gallery_id the status covers every image used in
 * any gallery (the site-wide banner); with a gallery_id it covers just that
 * gallery's images (the per-gallery notice + missing list). Regeneration runs
 * one attachment per request so the client can drive a progress bar, mirroring
 * the regenerate-thumbnails tool.
 *
 * @since 1.0.0
 */
final class Watermark_Regenerate_Data {

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
     * Status: counts plus, for a single gallery, the per-item state list.
     *
     * GET /admin/watermark/status?gallery_id=123
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_status( \WP_REST_Request $request ): \WP_REST_Response {
        $gallery_id = (int) $request->get_param( 'gallery_id' );

        $settings = Watermark_Settings_Store::get();
        $enabled  = ! empty( $settings['enable_watermark'] );
        $hash     = Watermark_Settings_Store::current_config_hash();

        $attachment_ids = $gallery_id > 0
            ? self::attachment_ids_for_gallery( $gallery_id )
            : self::all_gallery_attachment_ids();

        $counts      = array( 'total' => 0, 'current' => 0, 'missing' => 0, 'stale' => 0 );
        $items       = array();
        $pending_ids = array();

        foreach ( $attachment_ids as $attachment_id ) {
            $state = Watermark_Generator::variant_state( $attachment_id, $hash );

            $counts['total']++;
            $counts[ $state ]++;

            if ( $state !== 'current' ) {
                $pending_ids[] = $attachment_id;
            }

            // The per-item list is only needed for the per-gallery surface.
            if ( $gallery_id > 0 ) {
                $items[] = array(
                    'attachment_id' => $attachment_id,
                    'filename'      => basename( (string) get_attached_file( $attachment_id ) ),
                    'state'         => $state,
                );
            }
        }

        $pending = $counts['missing'] + $counts['stale'];

        return rest_ensure_response( array(
            'enabled'     => $enabled,
            'config_hash' => $hash,
            'counts'      => $counts,
            'pending'     => $pending,
            'pending_ids' => $pending_ids,
            // Every attachment, regardless of state, for a force-regenerate.
            'all_ids'     => array_values( $attachment_ids ),
            'items'       => $items,
        ) );
    }

    /**
     * Regenerate the watermark variants for one attachment.
     *
     * POST /admin/watermark/regenerate { attachment_id }
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function regenerate_attachment( \WP_REST_Request $request ) {
        $attachment_id = (int) $request->get_param( 'attachment_id' );

        if ( ! wp_attachment_is_image( $attachment_id ) ) {
            return new \WP_Error(
                'invalid_attachment',
                __( 'Attachment is not an image.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        $result = Watermark_Generator::generate_for_attachment( $attachment_id );
        $state  = Watermark_Generator::variant_state( $attachment_id );

        return rest_ensure_response( array(
            'attachment_id' => $attachment_id,
            'state'         => $state,
            'result'        => $result,
        ) );
    }

    /**
     * Attachment IDs (real images) used by one gallery.
     *
     * @since 1.0.0
     * @param int $gallery_id Gallery ID.
     * @return int[]
     */
    private static function attachment_ids_for_gallery( int $gallery_id ): array {
        $raw     = get_post_meta( $gallery_id, 'fotogrids_gallery_items', true );
        $decoded = self::decode_id_list( $raw );

        return self::filter_image_ids( $decoded );
    }

    /**
     * Attachment IDs (real images) used by any gallery on the site.
     *
     * @since 1.0.0
     * @return int[]
     */
    private static function all_gallery_attachment_ids(): array {
        global $wpdb;

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $rows = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s",
                'fotogrids_gallery_items'
            )
        );

        $ids = array();
        foreach ( $rows as $raw ) {
            foreach ( self::decode_id_list( $raw ) as $id ) {
                $ids[ $id ] = true;
            }
        }

        return self::filter_image_ids( array_keys( $ids ) );
    }

    /**
     * Decode a gallery_items meta value (JSON or serialized array) to int IDs.
     *
     * @since 1.0.0
     * @param mixed $raw Stored meta value.
     * @return int[]
     */
    private static function decode_id_list( $raw ): array {
        $decoded = is_string( $raw ) ? json_decode( $raw, true ) : null;

        if ( ! is_array( $decoded ) ) {
            $decoded = maybe_unserialize( $raw );
        }

        if ( ! is_array( $decoded ) ) {
            return array();
        }

        return array_map( 'intval', $decoded );
    }

    /**
     * Keep only positive IDs that are real image attachments.
     *
     * Gallery item lists also contain video-file attachments and embed posts,
     * which have no watermarkable sub-sizes.
     *
     * @since 1.0.0
     * @param int[] $ids Candidate IDs.
     * @return int[]
     */
    private static function filter_image_ids( array $ids ): array {
        $images = array();

        foreach ( $ids as $id ) {
            $id = (int) $id;
            if ( $id > 0 && wp_attachment_is_image( $id ) ) {
                $images[] = $id;
            }
        }

        return array_values( array_unique( $images ) );
    }

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
