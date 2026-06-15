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
		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return new \WP_Error(
				'fotogrids_not_found',
				__( 'Item not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		global $wpdb;
		$table       = $wpdb->prefix . 'fotogrids_item_meta';
		$custom_meta = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT description, credit, exif_data, location FROM {$table} WHERE attachment_id = %d AND gallery_id = 0",
				$item_id
			)
		);

		// ── Description ──────────────────────────────────────────────────────
		$description = $custom_meta ? ( $custom_meta->description ?? '' ) : $attachment->post_content;
		$description = $description ? $description : '';

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
			$enabled_fields = \FotoGrids\Exif\Exif_Extractor::enabled_fields_for_gallery( $gallery_id );
			if ( ! empty( $enabled_fields ) ) {
				$live_exif = \FotoGrids\Exif\Exif_Extractor::extract( $item_id, $enabled_fields );
				if ( ! empty( $live_exif ) ) {
					$exif = $live_exif;
				}
			}
		}

		// ── Credit ───────────────────────────────────────────────────────────
		$credit = '';
		if ( 'exif' === $credit_source ) {
			// EXIF Copyright field - stored under the key 'copyright' by TabEXIF.
			// If exif is missing or the copyright key is absent, return empty - no fallback.
			$credit = ( is_array( $exif ) && isset( $exif['copyright'] ) ) ? (string) $exif['copyright'] : '';
		} else {
			$credit = $custom_meta ? ( $custom_meta->credit ?? '' ) : '';
			$credit = $credit ? $credit : '';
		}

		// ── File info ────────────────────────────────────────────────────────
		$file_path       = get_attached_file( $item_id );
		$attachment_meta = wp_get_attachment_metadata( $item_id );
		$mime_type       = get_post_mime_type( $item_id ) ?: '';

		$filesize = '';
		if ( $file_path && file_exists( $file_path ) ) {
            $bytes    = @filesize( $file_path ); // phpcs:ignore
			$filesize = false !== $bytes ? size_format( $bytes ) : '';
		}

		$width  = isset( $attachment_meta['width'] ) ? (int) $attachment_meta['width'] : 0;
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

		$tags   = array_map( fn( $t ) => $t->name, $raw_metadata['tags'] ?? array() );
		$people = array_map( fn( $t ) => $t->name, $raw_metadata['people'] ?? array() );

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

		return rest_ensure_response(
			array(
				'id'          => $item_id,
				'description' => $description,
				'credit'      => $credit,
				'file_info'   => $file_info,
				'exif'        => $exif,
				'tags'        => $tags,
				'people'      => $people,
				'location'    => $location,
			)
		);
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
