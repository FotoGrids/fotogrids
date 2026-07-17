<?php
/**
 * Domain-enumeration filter hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Data filter hooks.
 */
final class Filters_Data {

	/**
	 * Available metadata types beyond the built-in tag/person/location.
	 *
	 * @since 1.0.0
	 * @param string[] $default_types List of metadata type slugs.
	 */
	public const METADATA_TYPES = 'fotogrids/data/metadata/types';

	/**
	 * The EXIF field keys a gallery extracts. Free enables camera / aperture /
	 * shutter_speed / iso from its settings; add-ons hook this to enable more
	 * keys (e.g. lens, focal_length) based on the gallery's settings.
	 *
	 * @since 1.0.0
	 * @param string[]             $enabled_fields Field keys to extract.
	 * @param array<string, mixed> $settings       Resolved gallery settings.
	 * @param int                  $gallery_id     Gallery post ID.
	 */
	public const EXIF_ENABLED_FIELDS = 'fotogrids/data/exif/enabled_fields';

	/**
	 * The extracted EXIF value map for an attachment. Free populates the values
	 * for its own field keys; add-ons hook this to populate values for the
	 * additional keys they enabled via EXIF_ENABLED_FIELDS.
	 *
	 * @since 1.0.0
	 * @param array<string, string> $exif_data      Field key => display value.
	 * @param string[]              $enabled_fields Field keys requested.
	 * @param array<string, mixed>  $image_meta     Raw wp_read_image_metadata().
	 * @param int                   $attachment_id  Attachment ID.
	 */
	public const EXIF_EXTRACT = 'fotogrids/data/exif/extract';
}
