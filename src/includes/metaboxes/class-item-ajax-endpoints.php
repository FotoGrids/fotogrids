<?php
/**
 * Per-item legacy `wp_ajax_*` endpoints for the gallery item-edit modal.
 *
 * @package FotoGrids\Metaboxes
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Metaboxes;

use FotoGrids\Exif\Exif_Extractor;
use FotoGrids\Galleries\Gallery_Items;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Six `wp_ajax_*` endpoints driving the per-item edit + bulk-URL UI.
 *
 *   fotogrids_get_item_data           — read item data for the edit modal
 *   fotogrids_save_item_data          — write item data back
 *   fotogrids_get_item_urls           — read external_url / link_target for many items
 *   fotogrids_update_item_url         — write external_url for one item
 *   fotogrids_bulk_update_item_urls   — bulk apply/clear external_url
 *   fotogrids_reorder_gallery_items   — drag-reorder a gallery's items
 *
 * Eventually candidates to move to REST routes under `includes/rest/items/`;
 * see the refactor plan for that follow-up.
 *
 * @since 1.0.0
 */
final class Item_Ajax_Endpoints {

    /**
     * Wire the 6 `wp_ajax_*` endpoints.
     *
     * @since 1.0.0
     */
    public static function init(): void {
        add_action( 'wp_ajax_fotogrids_get_item_data',          [ __CLASS__, 'get_item_data' ] );
        add_action( 'wp_ajax_fotogrids_save_item_data',         [ __CLASS__, 'save_item_data' ] );
        add_action( 'wp_ajax_fotogrids_get_item_urls',          [ __CLASS__, 'get_item_urls' ] );
        add_action( 'wp_ajax_fotogrids_update_item_url',        [ __CLASS__, 'update_item_url' ] );
        add_action( 'wp_ajax_fotogrids_bulk_update_item_urls',  [ __CLASS__, 'bulk_update_item_urls' ] );
        add_action( 'wp_ajax_fotogrids_reorder_gallery_items',  [ __CLASS__, 'reorder_gallery_items' ] );
    }

    /**
     * GET item data for the edit modal.
     *
     * @since 1.0.0
     */
    public static function get_item_data(): void {
        check_ajax_referer( 'fotogrids_item_edit', 'nonce' );

        if ( ! current_user_can( 'upload_files' ) ) {
            wp_die( -1 );
        }

        $item_id = intval( $_POST['item_id'] ?? 0 );
        if ( ! $item_id ) {
            wp_send_json_error( 'Invalid item ID' );
        }

        $attachment = get_post( $item_id );
        if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
            wp_send_json_error( 'Item not found' );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $custom_meta = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE attachment_id = %d AND gallery_id = 0",
                $item_id
            )
        );

        $custom_data  = [];
        $external_url = '';
        $link_target  = 'global';
        $exif_data    = null;

        if ( $custom_meta ) {
            $external_url = $custom_meta->external_url ?? '';
            $link_target  = $custom_meta->link_target ?? 'global';
            if ( ! empty( $custom_meta->custom_data ) ) {
                $decoded_data = json_decode( $custom_meta->custom_data, true );
                if ( is_array( $decoded_data ) ) {
                    $custom_data = $decoded_data;
                }
            }
            if ( ! empty( $custom_meta->exif_data ) ) {
                $decoded_exif = json_decode( $custom_meta->exif_data, true );
                if ( is_array( $decoded_exif ) ) {
                    $exif_data = $decoded_exif;
                }
            }
        }

        // If no stored EXIF, read it live from the file so the EXIF tab is
        // always populated in the modal regardless of gallery settings.
        if ( null === $exif_data ) {
            $raw_exif = Exif_Extractor::extract(
                $item_id,
                [ 'camera', 'aperture', 'shutter_speed', 'iso', 'lens', 'focal_length', 'date_taken', 'copyright', 'orientation', 'flash', 'white_balance', 'exposure_mode' ]
            );
            if ( ! empty( $raw_exif ) ) {
                $exif_data = $raw_exif;
            }
        }

        $attachment_meta = wp_get_attachment_metadata( $item_id );
        $file_path       = get_attached_file( $item_id );
        $filename        = $file_path ? basename( $file_path ) : '';
        $filesize        = '';
        $width           = '';
        $height          = '';
        $mime_type       = get_post_mime_type( $item_id );

        if ( $file_path && file_exists( $file_path ) ) {
            $filesize = size_format( filesize( $file_path ) );
        }

        if ( $attachment_meta && isset( $attachment_meta['width'], $attachment_meta['height'] ) ) {
            $width  = $attachment_meta['width'];
            $height = $attachment_meta['height'];
        }

        $item_type  = \FotoGrids\Render\Video\Video_Item_Helpers::type_for_attachment( $item_id );
        $is_video   = \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE === $item_type;
        $video_url  = '';
        $poster_url = '';

        if ( $is_video ) {
            $video_url  = (string) ( wp_get_attachment_url( $item_id ) ?: '' );
            $poster_url = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
                $item_type,
                $item_id,
                is_array( $custom_data ) ? $custom_data : [],
                'medium'
            );
        }

        wp_send_json_success( [
            'id'            => $item_id,
            'title'         => $attachment->post_title,
            'alt'           => get_post_meta( $item_id, '_wp_attachment_item_alt', true ),
            'caption'       => $attachment->post_excerpt,
            'description'   => $attachment->post_content,
            'credit'        => $custom_meta ? ( $custom_meta->credit ?? '' ) : '',
            'external_url'  => $external_url,
            'link_target'   => $link_target,
            'custom_data'   => $custom_data,
            'exif'          => $exif_data,
            'medium_url'    => wp_get_attachment_image_url( $item_id, 'medium' ),
            'thumbnail_url' => wp_get_attachment_image_url( $item_id, 'fotogrids_masonry' ),
            'full_url'      => wp_get_attachment_image_url( $item_id, 'full' ),
            'filename'      => $filename,
            'filesize'      => $filesize,
            'width'         => $width,
            'height'        => $height,
            'mime_type'     => $mime_type,
            'item_type'     => $item_type,
            'video_url'     => $video_url,
            'poster_url'    => $poster_url,
        ] );
    }

    /**
     * Save item data from the edit modal.
     *
     * @since 1.0.0
     */
    public static function save_item_data(): void {
        check_ajax_referer( 'fotogrids_item_edit', 'nonce' );

        if ( ! current_user_can( 'upload_files' ) ) {
            wp_die( -1 );
        }

        $item_id      = intval( $_POST['item_id'] ?? 0 );
        $title        = sanitize_text_field( wp_unslash( $_POST['title'] ?? '' ) );
        $alt          = sanitize_text_field( wp_unslash( $_POST['alt'] ?? '' ) );
        $caption      = sanitize_textarea_field( wp_unslash( $_POST['caption'] ?? '' ) );
        $description  = sanitize_textarea_field( wp_unslash( $_POST['description'] ?? '' ) );
        $credit       = sanitize_text_field( wp_unslash( $_POST['credit'] ?? '' ) );
        $external_url = sanitize_url( wp_unslash( $_POST['external_url'] ?? '' ) );
        $link_target  = sanitize_text_field( wp_unslash( $_POST['link_target'] ?? 'global' ) );

        $exif_data = [];
        if ( isset( $_POST['exif'] ) ) {
            $exif_raw = json_decode( wp_unslash( $_POST['exif'] ), true );
            if ( is_array( $exif_raw ) ) {
                $exif_data = array_map( 'sanitize_text_field', $exif_raw );
            }
        }

        if ( ! $item_id ) {
            wp_send_json_error( 'Invalid item ID' );
        }

        $result = wp_update_post( [
            'ID'           => $item_id,
            'post_title'   => $title,
            'post_excerpt' => $caption,
            'post_content' => $description,
        ] );

        if ( is_wp_error( $result ) ) {
            wp_send_json_error( 'Failed to update item data' );
        }

        update_post_meta( $item_id, '_wp_attachment_item_alt', $alt );

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';

        $existing = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE attachment_id = %d AND gallery_id = 0",
                $item_id
            )
        );

        $data = [
            'attachment_id' => $item_id,
            'gallery_id'    => 0, // Global item data (not gallery-specific)
            'credit'        => $credit,
            // Note: the `location` VARCHAR column is deprecated — structured
            // location data is stored in fotogrids_item_metadata via the
            // metadata REST endpoint. Do not write to it here.
            'external_url'  => $external_url,
            'link_target'   => $link_target,
            'exif_data'     => ! empty( $exif_data ) ? wp_json_encode( $exif_data ) : null,
            'updated_at'    => current_time( 'mysql', true ),
        ];

        if ( $existing ) {
            $wpdb->update(
                $table,
                $data,
                [ 'id' => $existing->id ],
                [ '%d', '%d', '%s', '%s', '%s', '%s', '%s' ],
                [ '%d' ]
            );
        } else {
            $data['created_at'] = current_time( 'mysql', true );
            $wpdb->insert(
                $table,
                $data,
                [ '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s' ]
            );
        }

        wp_send_json_success( 'Item data updated successfully' );
    }

    /**
     * GET external URLs + link targets for a list of items (External URL
     * Manager modal).
     *
     * @since 1.0.0
     */
    public static function get_item_urls(): void {
        check_ajax_referer( 'fotogrids_settings', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_die( -1 );
        }

        $item_ids = isset( $_POST['item_ids'] ) ? array_map( 'intval', $_POST['item_ids'] ) : [];
        if ( empty( $item_ids ) ) {
            wp_send_json_success( [] );
        }

        global $wpdb;
        $table        = $wpdb->prefix . 'fotogrids_item_meta';
        $placeholders = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );

        $sql     = "SELECT attachment_id, external_url, link_target FROM {$table} WHERE attachment_id IN ({$placeholders})";
        $results = $wpdb->get_results( $wpdb->prepare( $sql, $item_ids ), ARRAY_A );

        $item_data = [];
        foreach ( $results as $row ) {
            $attachment_id = $row['attachment_id'];
            $attachment    = get_post( $attachment_id );

            $item_data[ $attachment_id ] = [
                'url'       => $row['external_url'] ?: '',
                'target'    => $row['link_target']  ?: 'global',
                'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'fotogrids_masonry' ),
                'alt'       => get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ),
                'title'     => $attachment ? $attachment->post_title : '',
            ];
        }

        // Fill in missing items with empty data so the response always covers
        // every requested id.
        foreach ( $item_ids as $item_id ) {
            if ( ! isset( $item_data[ $item_id ] ) ) {
                $attachment = get_post( $item_id );
                $item_data[ $item_id ] = [
                    'url'       => '',
                    'target'    => 'global',
                    'thumbnail' => wp_get_attachment_image_url( $item_id, 'fotogrids_masonry' ),
                    'alt'       => get_post_meta( $item_id, '_wp_attachment_item_alt', true ),
                    'title'     => $attachment ? $attachment->post_title : '',
                ];
            }
        }

        wp_send_json_success( $item_data );
    }

    /**
     * Update one item's external URL + link target. Creates the row if it
     * doesn't exist.
     *
     * @since 1.0.0
     */
    public static function update_item_url(): void {
        check_ajax_referer( 'fotogrids_settings', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_die( -1 );
        }

        $item_id = intval( $_POST['item_id'] ?? 0 );
        $url     = sanitize_url( wp_unslash( $_POST['url'] ?? '' ) );
        $target  = sanitize_text_field( wp_unslash( $_POST['target'] ?? 'global' ) );

        if ( ! $item_id ) {
            wp_send_json_error( 'Invalid item ID' );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';

        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE attachment_id = %d",
            $item_id
        ) );

        if ( $exists ) {
            $result = $wpdb->update(
                $table,
                [
                    'external_url' => $url,
                    'link_target'  => $target,
                ],
                [ 'attachment_id' => $item_id ],
                [ '%s', '%s' ],
                [ '%d' ]
            );
        } else {
            $attachment = get_post( $item_id );
            if ( ! $attachment ) {
                wp_send_json_error( 'Attachment not found' );
            }

            $result = $wpdb->insert(
                $table,
                [
                    'attachment_id' => $item_id,
                    'gallery_id'    => 0, // Global item data
                    'external_url'  => $url,
                    'link_target'   => $target,
                    'position'      => 0,
                ],
                [ '%d', '%d', '%s', '%s', '%d' ]
            );
        }

        if ( $result !== false ) {
            wp_send_json_success( 'Item URL updated successfully' );
        } else {
            wp_send_json_error( 'Failed to update item URL' );
        }
    }

    /**
     * Bulk apply/clear external URLs across a list of items.
     *
     * @since 1.0.0
     */
    public static function bulk_update_item_urls(): void {
        check_ajax_referer( 'fotogrids_settings', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_die( -1 );
        }

        $action   = sanitize_text_field( wp_unslash( $_POST['bulk_action'] ?? '' ) );
        $item_ids = isset( $_POST['item_ids'] ) ? array_map( 'intval', (array) $_POST['item_ids'] ) : [];
        $url      = sanitize_url( wp_unslash( $_POST['url'] ?? '' ) );
        $target   = sanitize_text_field( wp_unslash( $_POST['target'] ?? 'global' ) );

        if ( empty( $item_ids ) ) {
            wp_send_json_error( 'No item IDs provided' );
        }

        if ( ! in_array( $action, [ 'apply_to_all', 'clear_all' ], true ) ) {
            wp_send_json_error( 'Invalid action' );
        }

        global $wpdb;
        $table   = $wpdb->prefix . 'fotogrids_item_meta';
        $updated = 0;

        if ( $action === 'apply_to_all' ) {
            foreach ( $item_ids as $item_id ) {
                $exists = $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$table} WHERE attachment_id = %d",
                    $item_id
                ) );

                if ( $exists ) {
                    $result = $wpdb->update(
                        $table,
                        [
                            'external_url' => $url,
                            'link_target'  => $target,
                        ],
                        [ 'attachment_id' => $item_id ],
                        [ '%s', '%s' ],
                        [ '%d' ]
                    );
                } else {
                    $attachment = get_post( $item_id );
                    if ( ! $attachment ) {
                        continue;
                    }

                    $result = $wpdb->insert(
                        $table,
                        [
                            'attachment_id' => $item_id,
                            'gallery_id'    => 0,
                            'external_url'  => $url,
                            'link_target'   => $target,
                            'position'      => 0,
                        ],
                        [ '%d', '%d', '%s', '%s', '%d' ]
                    );
                }

                if ( $result !== false ) {
                    $updated++;
                }
            }
        } elseif ( $action === 'clear_all' ) {
            foreach ( $item_ids as $item_id ) {
                $result = $wpdb->update(
                    $table,
                    [
                        'external_url' => '',
                        'link_target'  => 'global',
                    ],
                    [ 'attachment_id' => $item_id ],
                    [ '%s', '%s' ],
                    [ '%d' ]
                );

                if ( $result !== false ) {
                    $updated++;
                }
            }
        }

        wp_send_json_success( [
            'updated' => $updated,
            'action'  => $action,
            /* translators: %d: number of items updated. */
            'message' => sprintf( __( 'Bulk action completed. Updated %d items.', 'fotogrids' ), $updated ),
        ] );
    }

    /**
     * Reorder a gallery's items via drag-and-drop in the metabox.
     *
     * @since 1.0.0
     */
    public static function reorder_gallery_items(): void {
        check_ajax_referer( 'fotogrids_item_edit', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( [ 'message' => __( 'Insufficient permissions', 'fotogrids' ) ] );
        }

        $gallery_id = intval( $_POST['gallery_id'] ?? 0 );
        if ( ! $gallery_id ) {
            wp_send_json_error( [ 'message' => __( 'Invalid gallery ID', 'fotogrids' ) ] );
        }

        $post = get_post( $gallery_id );
        if ( ! $post || $post->post_type !== 'fotogrids_gallery' ) {
            wp_send_json_error( [ 'message' => __( 'Invalid gallery', 'fotogrids' ) ] );
        }

        if ( ! current_user_can( 'edit_post', $gallery_id ) ) {
            wp_send_json_error( [ 'message' => __( 'Cannot edit this gallery', 'fotogrids' ) ] );
        }

        $item_order = isset( $_POST['item_order'] ) ? json_decode( wp_unslash( $_POST['item_order'] ), true ) : [];
        if ( ! is_array( $item_order ) ) {
            wp_send_json_error( [ 'message' => __( 'Invalid item order data', 'fotogrids' ) ] );
        }

        $result = Gallery_Items::reorder( (int) $gallery_id, $item_order );

        if ( $result ) {
            wp_send_json_success( [
                'message'    => __( 'Items reordered successfully', 'fotogrids' ),
                'gallery_id' => $gallery_id,
                'item_order' => $item_order,
            ] );
        } else {
            wp_send_json_error( [ 'message' => __( 'Failed to reorder items', 'fotogrids' ) ] );
        }
    }
}
