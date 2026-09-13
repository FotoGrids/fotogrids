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
 *  - `extract()` reads an attachment's raw EXIF tags and returns the requested
 *    fields, formatted for display.
 *  - `enabled_fields_for_gallery()` translates a gallery's `display_exif` and
 *    `exif_fields` settings into the field whitelist `extract()` expects.
 *
 * The field vocabulary itself lives in `Exif_Fields`. Add-ons extend the
 * whitelist and the extracted values through the
 * `fotogrids/data/exif/enabled_fields` and `fotogrids/data/exif/extract`
 * filters.
 *
 * @since 1.0.0
 */
final class Exif_Extractor {

	/**
	 * Extract and normalise EXIF data from an image attachment.
	 *
	 * @since 1.0.0
	 * @param int      $attachment_id  Attachment ID.
	 * @param string[] $enabled_fields Field keys to extract, from `Exif_Fields`.
	 * @return array<string, string> Normalised EXIF data with only the
	 *                               requested fields populated.
	 */
	public static function extract( int $attachment_id, array $enabled_fields = array() ): array {
		if ( empty( $enabled_fields ) ) {
			return array();
		}

		$requested = Exif_Fields::sanitize_keys( $enabled_fields );

		if ( empty( $requested ) ) {
			return array();
		}

		$tags = Exif_Reader::read( $attachment_id );

		$exif_data = array();

		if ( ! empty( $tags ) ) {
			foreach ( $requested as $field_key ) {
				$definition = Exif_Fields::get( $field_key );

				if ( null === $definition ) {
					continue;
				}

				$value = self::first_present_tag( $tags, $definition['tags'] );

				if ( null === $value ) {
					continue;
				}

				$formatted = Exif_Formatter::apply( $definition['format'], $value, $tags );

				if ( '' !== $formatted ) {
					$exif_data[ $field_key ] = $formatted;
				}
			}
		}

		/**
		 * Allow add-ons to populate values for any additional EXIF field keys
		 * they enabled via Filters_Data::EXIF_ENABLED_FIELDS.
		 *
		 * @see Filters_Data::EXIF_EXTRACT
		 */
		return (array) apply_filters( Filters_Data::EXIF_EXTRACT, $exif_data, $enabled_fields, $tags, $attachment_id );
	}

	/**
	 * Build the EXIF-field whitelist for a gallery, from its settings.
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

		$enabled_fields = Exif_Fields::sanitize_keys( self::parse_field_setting( $settings['exif_fields'] ?? array() ) );

		/**
		 * Allow add-ons to enable additional EXIF field keys from the gallery's
		 * settings.
		 *
		 * @see Filters_Data::EXIF_ENABLED_FIELDS
		 */
		return (array) apply_filters( Filters_Data::EXIF_ENABLED_FIELDS, $enabled_fields, $settings, $gallery_id );
	}

	/**
	 * Read the `exif_fields` setting, which persists as an array or as JSON.
	 *
	 * @since  1.2.0
	 * @param  mixed $raw Stored setting value.
	 * @return array<int, mixed>
	 */
	public static function parse_field_setting( $raw ): array {
		if ( is_array( $raw ) ) {
			return $raw;
		}

		if ( ! is_string( $raw ) || '' === trim( $raw ) ) {
			return array();
		}

		$raw = trim( $raw );

		if ( 0 === strpos( $raw, '[' ) ) {
			$decoded = json_decode( $raw, true );

			return is_array( $decoded ) ? $decoded : array();
		}

		return array_filter( array_map( 'trim', explode( ',', $raw ) ) );
	}

	/**
	 * The first of a field's candidate tags that carries a value.
	 *
	 * @since  1.2.0
	 * @param  array<string, mixed> $tags       Raw EXIF tag map.
	 * @param  string[]             $candidates Tag names, in precedence order.
	 * @return mixed Null when none is present.
	 */
	private static function first_present_tag( array $tags, array $candidates ) {
		foreach ( $candidates as $tag ) {
			if ( ! array_key_exists( $tag, $tags ) ) {
				continue;
			}

			$value = $tags[ $tag ];

			if ( null === $value || '' === $value || array() === $value ) {
				continue;
			}

			return $value;
		}

		return null;
	}
}
