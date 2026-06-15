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
use FotoGrids\Hooks\Filters_Features;

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
 * shutter_speed, iso). Pro extends with lens, focal_length, date_taken,
 * copyright, orientation, flash, white_balance, exposure_mode — gated by the
 * `fotogrids/features/pro/is_active` filter.
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

		// Lens.
		if ( in_array( 'lens', $enabled_fields, true ) && ! empty( $image_meta['lens'] ) ) {
			$exif_data['lens'] = sanitize_text_field( $image_meta['lens'] );
		}

		// Focal length.
		if ( in_array( 'focal_length', $enabled_fields, true ) && ! empty( $image_meta['focal_length'] ) ) {
			$focal_length              = $image_meta['focal_length'];
			$exif_data['focal_length'] = is_numeric( $focal_length )
				? number_format( (float) $focal_length, 0 ) . 'mm'
				: sanitize_text_field( $focal_length );
		}

		// Date taken.
		if ( in_array( 'date_taken', $enabled_fields, true ) && ! empty( $image_meta['created_timestamp'] ) ) {
			$timestamp               = $image_meta['created_timestamp'];
			$exif_data['date_taken'] = is_numeric( $timestamp )
				? gmdate( 'Y-m-d H:i:s', (int) $timestamp )
				: sanitize_text_field( $timestamp );
		}

		// Copyright.
		if ( in_array( 'copyright', $enabled_fields, true ) && ! empty( $image_meta['copyright'] ) ) {
			$exif_data['copyright'] = sanitize_text_field( $image_meta['copyright'] );
		}

		// Orientation.
		if ( in_array( 'orientation', $enabled_fields, true ) && ! empty( $image_meta['orientation'] ) ) {
			$exif_data['orientation'] = sanitize_text_field( $image_meta['orientation'] );
		}

		// Flash.
		if ( in_array( 'flash', $enabled_fields, true ) && isset( $image_meta['flash'] ) ) {
			$flash = $image_meta['flash'];
			if ( is_numeric( $flash ) ) {
				$exif_data['flash'] = ( $flash > 0 ) ? __( 'Yes', 'fotogrids' ) : __( 'No', 'fotogrids' );
			} else {
				$exif_data['flash'] = sanitize_text_field( $flash );
			}
		}

		// White balance.
		if ( in_array( 'white_balance', $enabled_fields, true ) && ! empty( $image_meta['white_balance'] ) ) {
			$exif_data['white_balance'] = sanitize_text_field( $image_meta['white_balance'] );
		}

		// Exposure mode.
		if ( in_array( 'exposure_mode', $enabled_fields, true ) && ! empty( $image_meta['exposure_mode'] ) ) {
			$exif_data['exposure_mode'] = sanitize_text_field( $image_meta['exposure_mode'] );
		}

		return $exif_data;
	}

	/**
	 * Build the EXIF-field whitelist for a gallery, from its settings.
	 *
	 * Free returns up to 4 fields. Pro extends with 8 more, gated on
	 * `Filters_Features::PRO_IS_ACTIVE`.
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

		// Free fields.
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

		// Pro fields (only if Pro is active).
		if ( (bool) apply_filters( Filters_Features::PRO_IS_ACTIVE, false ) ) {
			$pro_keys = array(
				'lens',
				'focal_length',
				'date_taken',
				'copyright',
				'orientation',
				'flash',
				'white_balance',
				'exposure_mode',
			);
			foreach ( $pro_keys as $key ) {
				if ( ! empty( $settings[ 'exif_' . $key ] ) ) {
					$enabled_fields[] = $key;
				}
			}
		}

		return $enabled_fields;
	}
}
