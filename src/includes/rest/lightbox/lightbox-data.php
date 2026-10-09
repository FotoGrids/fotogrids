<?php
namespace FotoGrids\REST\Lightbox;

use FotoGrids\Metadata_Manager;
use FotoGrids\Render\Lightbox\Shared\Lightbox_Info_Scope;

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
 *   exif:        object|null,      // only the fields the gallery's EXIF block displays
 *   tags:        string[],         // tag names
 *   people:      string[],         // person names
 *   location:    { name: string, latitude?: float|null, longitude?: float|null }|null,
 * }
 *
 * Coordinates are included only when the gallery shows the location block.
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
		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return new \WP_Error(
				'fotogrids_not_found',
				__( 'Item not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$custom_meta = \FotoGrids\Galleries\Item_Meta::get( $item_id );

		// ── Description ──────────────────────────────────────────────────────
		$description = (string) $attachment->post_content;

		$info_scope  = new Lightbox_Info_Scope(
			\FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery_id ),
			$gallery_id
		);
		$exif_fields = $info_scope->exif_fields();

		// ── EXIF ─────────────────────────────────────────────────────────────
		$stored_exif = null;
		if ( $custom_meta && ! empty( $custom_meta['exif_data'] ) ) {
			$decoded = json_decode( $custom_meta['exif_data'], true );
			if ( is_array( $decoded ) ) {
				$stored_exif = $decoded;
			}
		}

		$exif = null;
		if ( ! empty( $exif_fields ) ) {
			$exif = null !== $stored_exif
				? array_intersect_key( $stored_exif, array_flip( $exif_fields ) )
				: \FotoGrids\Exif\Exif_Extractor::extract( $item_id, $exif_fields );
			$exif = empty( $exif ) ? null : $exif;
		}

		// ── Credit ───────────────────────────────────────────────────────────
		$credit = '';
		if ( 'exif' === $credit_source ) {
			// EXIF Copyright field. It is read whether or not the gallery
			// displays it in the EXIF block, because choosing EXIF as the
			// credit source is itself the request for it.
			if ( is_array( $stored_exif ) && isset( $stored_exif['copyright'] ) ) {
				$credit = (string) $stored_exif['copyright'];
			} else {
				$copyright = \FotoGrids\Exif\Exif_Extractor::extract( $item_id, array( 'copyright' ) );
				$credit    = $copyright['copyright'] ?? '';
			}
		} elseif ( 'xmp' === $credit_source ) {
			// XMP rights - read from the embedded XMP packet. wp_read_image_metadata
			// does not parse XMP, so the file is read directly.
			$credit = self::read_xmp_credit( $item_id );
		} else {
			$credit = $custom_meta ? ( $custom_meta['credit'] ?? '' ) : '';
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
			$location = array( 'name' => $loc_row->name );
			if ( $info_scope->shows( 'location' ) ) {
				$location += Metadata_Manager::coordinates_from_meta( $loc_row->meta ?? null );
			}
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

	/**
	 * Resolve a credit string from an attachment's embedded XMP packet.
	 *
	 * Reads the raw file, extracts the XMP packet, and returns the first
	 * available of dc:rights, photoshop:Credit, dc:creator. Returns an empty
	 * string when the file is unreadable or carries no XMP rights data.
	 *
	 * @since 1.0.0
	 * @param int $item_id Attachment ID.
	 * @return string
	 */
	private static function read_xmp_credit( int $item_id ): string {
		// The XMP packet only survives on the preserved original; WordPress
		// strips it from the `-scaled` file get_attached_file() returns for
		// images above big_image_size_threshold.
		$file_path = wp_get_original_image_path( $item_id );
		if ( ! $file_path ) {
			$file_path = get_attached_file( $item_id );
		}

		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return '';
		}

		$contents = (string) @file_get_contents( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents, WordPress.PHP.NoSilencedErrors.Discouraged
		if ( '' === $contents ) {
			return '';
		}

		$start = strpos( $contents, '<x:xmpmeta' );
		$end   = strpos( $contents, '</x:xmpmeta>' );
		if ( false === $start || false === $end || $end <= $start ) {
			return '';
		}
		$packet = substr( $contents, $start, ( $end - $start ) + strlen( '</x:xmpmeta>' ) );

		$patterns = array(
			'#<dc:rights>.*?<rdf:li[^>]*>(.*?)</rdf:li>#s',
			'/photoshop:Credit="([^"]+)"/',
			'#<dc:creator>.*?<rdf:li[^>]*>(.*?)</rdf:li>#s',
		);
		foreach ( $patterns as $pattern ) {
			if ( preg_match( $pattern, $packet, $m ) ) {
				$value = trim( html_entity_decode( wp_strip_all_tags( $m[1] ), ENT_QUOTES, 'UTF-8' ) );
				// Strip a leading BCP-47 default-language marker that some
				// writers embed in the element text rather than the xml:lang
				// attribute.
				$value = (string) preg_replace( '/^x-default\s+/', '', $value );
				$value = trim( $value );
				if ( '' !== $value ) {
					return sanitize_text_field( $value );
				}
			}
		}

		return '';
	}
}
