<?php
namespace FotoGrids\REST\Lightbox;

use FotoGrids\Metadata_Manager;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Lightbox Item Data Handler
 *
 * Returns all per-item data needed by the lightbox info panel in a single
 * request. Intentionally separate from the admin item-edit endpoint - this
 * response is shaped for the frontend, not the editor.
 *
 * Response shape:
 * {
 *   id:          int,
 *   description: string,
 *   credit:      string,           // resolved from item_meta or EXIF copyright
 *   file_info: {
 *     filename:   string,
 *     filesize:   string,          // human-readable, e.g. "2.4 MB"
 *     width:      int,
 *     height:     int,
 *     mime_type:  string,
 *   },
 *   exif:        object|null,      // key-value pairs present in stored exif_data
 *   tags:        string[],         // tag names
 *   people:      string[],         // person names
 *   location:    { name: string, meta: object|null }|null,
 * }
 *
 * @since 1.0.0
 */
class Lightbox_Data {

    /**
     * Fetch all lightbox panel data for a single attachment.
     *
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function get_item_data( \WP_REST_Request $request ) {
        $item_id       = (int) $request->get_param( 'id' );
        $credit_source = sanitize_key( $request->get_param( 'credit_source' ) ?: 'item_meta' );
        $gallery_id    = (int) $request->get_param( 'gallery_id' );

        $attachment = get_post( $item_id );
        if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
            return new \WP_Error(
                'fotogrids_not_found',
                __( 'Item not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        global $wpdb;
        $table      = $wpdb->prefix . 'fotogrids_item_meta';
        $custom_meta = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT description, credit, exif_data, location FROM {$table} WHERE attachment_id = %d AND gallery_id = 0",
                $item_id
            )
        );

        // ── Description ──────────────────────────────────────────────────────
        $description = $custom_meta ? ( $custom_meta->description ?? '' ) : $attachment->post_content;
        $description = $description ?: '';

        // ── EXIF ─────────────────────────────────────────────────────────────
        $exif = null;
        if ( $custom_meta && ! empty( $custom_meta->exif_data ) ) {
            $decoded = json_decode( $custom_meta->exif_data, true );
            if ( is_array( $decoded ) ) {
                $exif = $decoded;
            }
        }

        // If no stored EXIF, fall back to reading live from the file - but
        // only when the gallery has EXIF display enabled and has enabled fields.
        // This handles items that were added before EXIF extraction ran, or
        // whose exif_data column was never populated.
        if ( null === $exif && $gallery_id > 0 ) {
            $enabled_fields = fotogrids_get_enabled_exif_fields( $gallery_id );
            if ( ! empty( $enabled_fields ) ) {
                $live_exif = fotogrids_extract_exif_data( $item_id, $enabled_fields );
                if ( ! empty( $live_exif ) ) {
                    $exif = $live_exif;
                }
            }
        }

        // ── Credit ───────────────────────────────────────────────────────────
        $credit = '';
        if ( $credit_source === 'exif' ) {
            // EXIF Copyright field - stored under the key 'copyright' by TabEXIF.
            // If exif is missing or the copyright key is absent, return empty - no fallback.
            $credit = ( is_array( $exif ) && isset( $exif['copyright'] ) ) ? (string) $exif['copyright'] : '';
        } else {
            $credit = $custom_meta ? ( $custom_meta->credit ?? '' ) : '';
            $credit = $credit ?: '';
        }

        // ── File info ────────────────────────────────────────────────────────
        $file_path       = get_attached_file( $item_id );
        $attachment_meta = wp_get_attachment_metadata( $item_id );
        $mime_type       = get_post_mime_type( $item_id ) ?: '';

        $filesize = '';
        if ( $file_path && file_exists( $file_path ) ) {
            $bytes    = @filesize( $file_path ); // phpcs:ignore
            $filesize = $bytes !== false ? size_format( $bytes ) : '';
        }

        $width  = isset( $attachment_meta['width'] )  ? (int) $attachment_meta['width']  : 0;
        $height = isset( $attachment_meta['height'] ) ? (int) $attachment_meta['height'] : 0;

        $file_info = array(
            'filename'  => $file_path ? basename( $file_path ) : '',
            'filesize'  => $filesize,
            'width'     => $width,
            'height'    => $height,
            'mime_type' => $mime_type,
        );

        // ── Tags / People / Locations ────────────────────────────────────────
        $raw_metadata = Metadata_Manager::get_item_metadata( $item_id );

        $tags    = array_map( fn( $t ) => $t->name, $raw_metadata['tags']    ?? [] );
        $people  = array_map( fn( $t ) => $t->name, $raw_metadata['people']  ?? [] );

        // Location: take the first entry (items typically have one location).
        $location = null;
        if ( ! empty( $raw_metadata['locations'] ) ) {
            $loc_row  = $raw_metadata['locations'][0];
            $loc_meta = null;
            if ( ! empty( $loc_row->meta ) ) {
                $decoded = json_decode( $loc_row->meta, true );
                if ( is_array( $decoded ) ) {
                    $loc_meta = $decoded;
                }
            }
            $location = array(
                'name' => $loc_row->name,
                'meta' => $loc_meta,
            );
        }

        return rest_ensure_response( array(
            'id'          => $item_id,
            'description' => $description,
            'credit'      => $credit,
            'file_info'   => $file_info,
            'exif'        => $exif,
            'tags'        => $tags,
            'people'      => $people,
            'location'    => $location,
        ) );
    }
}
