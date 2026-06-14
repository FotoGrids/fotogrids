<?php
/**
 * Write-side operations for a gallery's items.
 *
 * @package FotoGrids\Galleries
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Galleries;

use FotoGrids\Exif\Exif_Extractor;
use FotoGrids\Hooks\Actions_Gallery;
use FotoGrids\Hooks\Actions_Item;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Mutating operations on a gallery's item set.
 *
 * Each method fires its corresponding `Actions_Item::*` / `Actions_Gallery::*`
 * action on success so listeners (statistics, cache invalidation, search
 * indexers, etc.) don't have to wrap individual call sites.
 *
 * @since 1.0.0
 */
final class Gallery_Items {

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
     * Add an attachment to a gallery.
     *
     * Writes the attachment id into the gallery's `fotogrids_gallery_items`
     * post-meta list. If `$meta` is provided OR if the gallery has EXIF
     * extraction enabled, also writes a row into `fotogrids_item_meta` with
     * the resolved EXIF + caption / description / location data.
     *
     * Seeds the FotoGrids alt (`_wp_attachment_item_alt`) from the WP Media
     * Library alt (`_wp_attachment_image_alt`) on first add — items added
     * before the user has touched the FotoGrids item editor still render with
     * the alt the user already typed in the Media Library, rather than
     * silently falling back to the title.
     *
     * @since 1.0.0
     * @param int                  $gallery_id    Gallery post ID.
     * @param int                  $attachment_id Attachment ID.
     * @param array<string, mixed> $meta          Optional initial item metadata.
     * @return bool True on success.
     */
    public static function add( int $gallery_id, int $attachment_id, array $meta = [] ): bool {
        global $wpdb;

        // Validate gallery and attachment exist.
        if ( ! Gallery_Repository::get( $gallery_id ) ) {
            return false;
        }
        if ( ! get_post( $attachment_id ) ) {
            return false;
        }

        // Seed FotoGrids alt from the WP Media Library alt if not already set.
        if ( '' === get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ) ) {
            $wp_alt = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );
            if ( '' !== (string) $wp_alt ) {
                update_post_meta( $attachment_id, '_wp_attachment_item_alt', $wp_alt );
            }
        }

        // Append to the post-meta ID list (idempotent).
        $item_ids = Gallery_Repository::get_item_ids( $gallery_id );
        if ( in_array( $attachment_id, $item_ids, true ) ) {
            return false;
        }

        $item_ids[] = $attachment_id;
        $post_meta_result = update_post_meta(
            $gallery_id,
            'fotogrids_gallery_items',
            wp_json_encode( $item_ids )
        );

        // Extract EXIF if not provided.
        if ( ! isset( $meta['exif_data'] ) ) {
            $enabled_fields = Exif_Extractor::enabled_fields_for_gallery( $gallery_id );
            if ( ! empty( $enabled_fields ) ) {
                $exif_data = Exif_Extractor::extract( $attachment_id, $enabled_fields );
                if ( ! empty( $exif_data ) ) {
                    $meta['exif_data'] = $exif_data;
                }
            }
        }

        // Persist meta row when present.
        if ( ! empty( $meta ) ) {
            $table = $wpdb->prefix . 'fotogrids_item_meta';

            $next_position = $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COALESCE(MAX(position), 0) + 1 FROM {$table} WHERE gallery_id = %d",
                    $gallery_id
                )
            );

            $wpdb->insert(
                $table,
                [
                    'attachment_id' => $attachment_id,
                    'gallery_id'    => $gallery_id,
                    'position'      => $next_position,
                    'caption'       => $meta['caption']     ?? '',
                    'description'   => $meta['description'] ?? '',
                    'location'      => $meta['location']    ?? '',
                    'exif_data'     => isset( $meta['exif_data'] )    ? wp_json_encode( $meta['exif_data'] )    : null,
                    'custom_data'   => isset( $meta['custom_data'] )  ? wp_json_encode( $meta['custom_data'] )  : null,
                    'created_at'    => current_time( 'mysql', true ),
                    'updated_at'    => current_time( 'mysql', true ),
                ]
            );
        }

        if ( $post_meta_result !== false ) {
            do_action( Actions_Item::ADDED, $attachment_id, $gallery_id, $meta );
            return true;
        }

        return false;
    }

    /**
     * Remove an attachment from a gallery.
     *
     * Strips the id out of the gallery's `fotogrids_gallery_items` list and
     * deletes the matching row from `fotogrids_item_meta`. Fires
     * `Actions_Item::REMOVED` on success.
     *
     * @since 1.0.0
     * @param int $gallery_id    Gallery post ID.
     * @param int $attachment_id Attachment ID.
     * @return bool True on success.
     */
    public static function remove( int $gallery_id, int $attachment_id ): bool {
        global $wpdb;

        $item_ids = Gallery_Repository::get_item_ids( $gallery_id );
        if ( empty( $item_ids ) ) {
            return false;
        }

        $key = array_search( $attachment_id, $item_ids, true );
        if ( $key === false ) {
            return false;
        }

        unset( $item_ids[ $key ] );
        $item_ids = array_values( $item_ids );

        $post_meta_result = update_post_meta(
            $gallery_id,
            'fotogrids_gallery_items',
            wp_json_encode( $item_ids )
        );

        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $wpdb->delete(
            $table,
            [
                'gallery_id'    => $gallery_id,
                'attachment_id' => $attachment_id,
            ],
            [ '%d', '%d' ]
        );

        if ( $post_meta_result !== false ) {
            do_action( Actions_Item::REMOVED, $attachment_id, $gallery_id );
            return true;
        }

        return false;
    }

    /**
     * Update the per-item metadata row.
     *
     * Allowed update fields: caption, description, location, position,
     * exif_data, custom_data. Fires `Actions_Item::META_UPDATED` on success.
     *
     * @since 1.0.0
     * @param int                  $gallery_id    Gallery post ID.
     * @param int                  $attachment_id Attachment ID.
     * @param array<string, mixed> $meta          New metadata.
     * @return bool True on success.
     */
    public static function update_meta( int $gallery_id, int $attachment_id, array $meta ): bool {
        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_item_meta';

        $data = [
            'updated_at' => current_time( 'mysql', true ),
        ];

        foreach ( [ 'caption', 'description', 'location', 'position' ] as $field ) {
            if ( isset( $meta[ $field ] ) ) {
                $data[ $field ] = $meta[ $field ];
            }
        }

        if ( isset( $meta['exif_data'] ) ) {
            $data['exif_data'] = wp_json_encode( $meta['exif_data'] );
        }
        if ( isset( $meta['custom_data'] ) ) {
            $data['custom_data'] = wp_json_encode( $meta['custom_data'] );
        }

        $result = $wpdb->update(
            $table,
            $data,
            [
                'gallery_id'    => $gallery_id,
                'attachment_id' => $attachment_id,
            ],
            null,
            [ '%d', '%d' ]
        );

        if ( $result !== false ) {
            do_action( Actions_Item::META_UPDATED, $attachment_id, $gallery_id, $meta );
            return true;
        }

        return false;
    }

    /**
     * Bulk reorder a gallery's items.
     *
     * Writes a new `position` for every attachment-id in `$item_order`
     * (1-indexed, in array order). Fires `Actions_Gallery::REORDERED` on
     * completion.
     *
     * @since 1.0.0
     * @param int                $gallery_id Gallery post ID.
     * @param array<int|string>  $item_order Attachment IDs in new display order.
     * @return bool Always true (per-row failures are ignored).
     */
    public static function reorder( int $gallery_id, array $item_order ): bool {
        global $wpdb;

        $table = $wpdb->prefix . 'fotogrids_item_meta';

        foreach ( $item_order as $position => $attachment_id ) {
            $wpdb->update(
                $table,
                [ 'position' => (int) $position + 1 ],
                [
                    'gallery_id'    => $gallery_id,
                    'attachment_id' => (int) $attachment_id,
                ],
                [ '%d' ],
                [ '%d', '%d' ]
            );
        }

        do_action( Actions_Gallery::REORDERED, $gallery_id, $item_order );

        return true;
    }

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
