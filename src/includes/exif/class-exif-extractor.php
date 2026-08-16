<?php
/**
 * EXIF extraction + per-gallery field-whitelisting.
 *
 * @package FotoGrids\Exif
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Exif;

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Filters_Data;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Extracts and normalises EXIF metadata for a FotoGrids attachment.
 *
 * Two responsibilities:
 *
 *  - `extract()` reads `wp_read_image_metadata()` for an attachment and
 *    returns the requested whitelist of fields in our normalised shape.
 *  - `enabled_fields_for_gallery()` translates a gallery's per-setting
 *    toggles (`display_exif`, `exif_camera`, `exif_aperture`, …) into the
 *    field whitelist that `extract()` expects.
 *
 * Free's whitelist covers the four core fields (camera, aperture,
 * shutter_speed, iso). Add-ons extend the whitelist and the extracted values
 * through the `fotogrids/data/exif/enabled_fields` and
 * `fotogrids/data/exif/extract` filters.
 *
 * @since 1.0.0
 */
final class Exif_Extractor {

	/**
	 * Extract and normalise EXIF data from an image attachment.
	 *
	 * @since 1.0.0
	 * @param int      $attachment_id  Attachment ID.
	 * @param string[] $enabled_fields Field keys to extract (e.g. ['camera',
	 *                                 'aperture', 'shutter_speed', 'iso']).
	 * @return array<string, string> Normalised EXIF data with only the
	 *                               requested fields populated.
	 */
	public static function extract( int $attachment_id, array $enabled_fields = array() ): array {
		if ( empty( $enabled_fields ) ) {
			return array();
		}

		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return array();
		}

		$image_meta = wp_read_image_metadata( $file_path );
		if ( ! $image_meta || empty( $image_meta ) ) {
			return array();
		}

		$exif_data = array();

		// Camera (combine credit + camera when available).
		if ( in_array( 'camera', $enabled_fields, true ) ) {
			$camera_parts = array();
			if ( ! empty( $image_meta['credit'] ) ) {
				$camera_parts[] = $image_meta['credit'];
			}
			if ( ! empty( $image_meta['camera'] ) ) {
				$camera_parts[] = $image_meta['camera'];
			}
			if ( ! empty( $camera_parts ) ) {
				$exif_data['camera'] = sanitize_text_field( implode( ' ', $camera_parts ) );
			}
		}

		// Aperture.
		if ( in_array( 'aperture', $enabled_fields, true ) && ! empty( $image_meta['aperture'] ) ) {
			$aperture              = $image_meta['aperture'];
			$exif_data['aperture'] = is_numeric( $aperture )
				? 'f/' . number_format( (float) $aperture, 1 )
				: sanitize_text_field( $aperture );
		}

		// Shutter speed (normalise sub-second to fractional notation).
		if ( in_array( 'shutter_speed', $enabled_fields, true ) && ! empty( $image_meta['shutter'] ) ) {
			$shutter = $image_meta['shutter'];
			if ( is_numeric( $shutter ) ) {
				if ( $shutter < 1 ) {
					$denominator                = round( 1 / $shutter );
					$exif_data['shutter_speed'] = '1/' . $denominator . 's';
				} else {
					$exif_data['shutter_speed'] = number_format( (float) $shutter, 1 ) . 's';
				}
			} else {
				$exif_data['shutter_speed'] = sanitize_text_field( $shutter );
			}
		}

		// ISO.
		if ( in_array( 'iso', $enabled_fields, true ) && ! empty( $image_meta['iso'] ) ) {
			$exif_data['iso'] = sanitize_text_field( $image_meta['iso'] );
		}

		/**
		 * Allow add-ons to populate values for any additional EXIF field keys
		 * they enabled via Filters_Data::EXIF_ENABLED_FIELDS.
		 *
		 * @see Filters_Data::EXIF_EXTRACT
		 */
		return (array) apply_filters( Filters_Data::EXIF_EXTRACT, $exif_data, $enabled_fields, $image_meta, $attachment_id );
	}

	/**
	 * Build the EXIF-field whitelist for a gallery, from its settings.
	 *
	 * Free enables camera / aperture / shutter_speed / iso. Add-ons extend the
	 * list via the Filters_Data::EXIF_ENABLED_FIELDS filter.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return string[] Enabled EXIF field keys (may be empty).
	 */
	public static function enabled_fields_for_gallery( int $gallery_id ): array {
		$settings = Gallery_Repository::get_settings( $gallery_id );

		if ( empty( $settings['display_exif'] ) ) {
			return array();
		}

		$enabled_fields = array();

		if ( ! empty( $settings['exif_camera'] ) ) {
			$enabled_fields[] = 'camera';
		}
		if ( ! empty( $settings['exif_aperture'] ) ) {
			$enabled_fields[] = 'aperture';
		}
		if ( ! empty( $settings['exif_shutter_speed'] ) ) {
			$enabled_fields[] = 'shutter_speed';
		}
		if ( ! empty( $settings['exif_iso'] ) ) {
			$enabled_fields[] = 'iso';
		}

		/**
		 * Allow add-ons to enable additional EXIF field keys from the gallery's
		 * settings (e.g. lens, focal_length).
		 *
		 * @see Filters_Data::EXIF_ENABLED_FIELDS
		 */
		return (array) apply_filters( Filters_Data::EXIF_ENABLED_FIELDS, $enabled_fields, $settings, $gallery_id );
	}
}
