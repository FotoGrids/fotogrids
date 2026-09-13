<?php
/**
 * Registry of every EXIF field FotoGrids can read, display and translate.
 *
 * @package FotoGrids\Exif
 * @since   1.2.0
 */

declare(strict_types=1);

namespace FotoGrids\Exif;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * The single definition of the EXIF field vocabulary.
 *
 * Every surface that names an EXIF field reads it from here: the gallery
 * settings panel (over `/admin/exif-fields`), the item editor, the lightbox,
 * the caption sources and `Exif_Extractor`. A field is added once, in
 * `definitions()`, and appears on all of them.
 *
 * Each definition carries:
 *
 *  - `label`      Translated, user-visible name.
 *  - `group`      Grouping key, used for ordering in pickers.
 *  - `tags`       EXIF tag names to try, in order; the first present wins.
 *  - `format`     Formatter method on `Exif_Formatter`, or null for a
 *                 sanitised passthrough.
 *  - `default_on` Whether a new gallery displays the field.
 *
 * @since 1.2.0
 */
final class Exif_Fields {

	/**
	 * Field keys a new gallery displays, in display order.
	 *
	 * @since 1.2.0
	 */
	public const DEFAULT_FIELDS = array( 'camera', 'lens', 'aperture', 'shutter_speed', 'iso', 'focal_length' );

	/**
	 * Group keys, in the order pickers should present them.
	 *
	 * @since 1.2.0
	 */
	public const GROUPS = array( 'camera', 'exposure', 'image', 'rights', 'location' );

	/**
	 * Every EXIF field FotoGrids understands, keyed by field key.
	 *
	 * @since  1.2.0
	 * @return array<string, array{label:string, group:string, tags:string[], format:?string, default_on:bool}>
	 */
	public static function definitions(): array {
		return array(
			'camera'                => array(
				'label'      => __( 'Camera', 'fotogrids' ),
				'group'      => 'camera',
				'tags'       => array( 'Model' ),
				'format'     => 'camera',
				'default_on' => true,
			),
			'lens'                  => array(
				'label'      => __( 'Lens', 'fotogrids' ),
				'group'      => 'camera',
				'tags'       => array( 'UndefinedTag:0xA434', 'LensModel', 'UndefinedTag:0xA432', 'LensInfo' ),
				'format'     => 'lens',
				'default_on' => true,
			),
			'software'              => array(
				'label'      => __( 'Software', 'fotogrids' ),
				'group'      => 'camera',
				'tags'       => array( 'Software' ),
				'format'     => null,
				'default_on' => false,
			),
			'aperture'              => array(
				'label'      => __( 'Aperture', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'FNumber' ),
				'format'     => 'aperture',
				'default_on' => true,
			),
			'shutter_speed'         => array(
				'label'      => __( 'Shutter Speed', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'ExposureTime' ),
				'format'     => 'shutter_speed',
				'default_on' => true,
			),
			'iso'                   => array(
				'label'      => __( 'ISO', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'ISOSpeedRatings', 'PhotographicSensitivity' ),
				'format'     => 'iso',
				'default_on' => true,
			),
			'focal_length'          => array(
				'label'      => __( 'Focal Length', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'FocalLength' ),
				'format'     => 'focal_length',
				'default_on' => true,
			),
			'focal_length_35mm'     => array(
				'label'      => __( 'Focal Length (35mm)', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'FocalLengthIn35mmFilm' ),
				'format'     => 'focal_length',
				'default_on' => false,
			),
			'exposure_compensation' => array(
				'label'      => __( 'Exposure Compensation', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'ExposureBiasValue' ),
				'format'     => 'exposure_compensation',
				'default_on' => false,
			),
			'exposure_program'      => array(
				'label'      => __( 'Exposure Program', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'ExposureProgram' ),
				'format'     => 'exposure_program',
				'default_on' => false,
			),
			'exposure_mode'         => array(
				'label'      => __( 'Exposure Mode', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'ExposureMode' ),
				'format'     => 'exposure_mode',
				'default_on' => false,
			),
			'metering_mode'         => array(
				'label'      => __( 'Metering Mode', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'MeteringMode' ),
				'format'     => 'metering_mode',
				'default_on' => false,
			),
			'flash'                 => array(
				'label'      => __( 'Flash', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'Flash' ),
				'format'     => 'flash',
				'default_on' => false,
			),
			'white_balance'         => array(
				'label'      => __( 'White Balance', 'fotogrids' ),
				'group'      => 'exposure',
				'tags'       => array( 'WhiteBalance' ),
				'format'     => 'white_balance',
				'default_on' => false,
			),
			'date_taken'            => array(
				'label'      => __( 'Date Taken', 'fotogrids' ),
				'group'      => 'image',
				'tags'       => array( 'DateTimeOriginal', 'DateTimeDigitized', 'DateTime' ),
				'format'     => 'date_taken',
				'default_on' => false,
			),
			'orientation'           => array(
				'label'      => __( 'Orientation', 'fotogrids' ),
				'group'      => 'image',
				'tags'       => array( 'Orientation' ),
				'format'     => 'orientation',
				'default_on' => false,
			),
			'color_space'           => array(
				'label'      => __( 'Color Space', 'fotogrids' ),
				'group'      => 'image',
				'tags'       => array( 'ColorSpace' ),
				'format'     => 'color_space',
				'default_on' => false,
			),
			'artist'                => array(
				'label'      => __( 'Artist', 'fotogrids' ),
				'group'      => 'rights',
				'tags'       => array( 'Artist', 'Author' ),
				'format'     => null,
				'default_on' => false,
			),
			'copyright'             => array(
				'label'      => __( 'Copyright', 'fotogrids' ),
				'group'      => 'rights',
				'tags'       => array( 'Copyright' ),
				'format'     => null,
				'default_on' => false,
			),
			'gps_latitude'          => array(
				'label'      => __( 'Latitude', 'fotogrids' ),
				'group'      => 'location',
				'tags'       => array( 'GPSLatitude' ),
				'format'     => 'gps_latitude',
				'default_on' => false,
			),
			'gps_longitude'         => array(
				'label'      => __( 'Longitude', 'fotogrids' ),
				'group'      => 'location',
				'tags'       => array( 'GPSLongitude' ),
				'format'     => 'gps_longitude',
				'default_on' => false,
			),
			'gps_altitude'          => array(
				'label'      => __( 'Altitude', 'fotogrids' ),
				'group'      => 'location',
				'tags'       => array( 'GPSAltitude' ),
				'format'     => 'gps_altitude',
				'default_on' => false,
			),
		);
	}

	/**
	 * Every field key, in group order.
	 *
	 * @since  1.2.0
	 * @return string[]
	 */
	public static function keys(): array {
		return array_keys( self::definitions() );
	}

	/**
	 * Whether a key names a known EXIF field.
	 *
	 * @since  1.2.0
	 * @param  string $key Field key.
	 * @return bool
	 */
	public static function exists( string $key ): bool {
		return array_key_exists( $key, self::definitions() );
	}

	/**
	 * One field definition.
	 *
	 * @since  1.2.0
	 * @param  string $key Field key.
	 * @return array{label:string, group:string, tags:string[], format:?string, default_on:bool}|null
	 */
	public static function get( string $key ): ?array {
		$definitions = self::definitions();
		return $definitions[ $key ] ?? null;
	}

	/**
	 * Field key => translated label, in group order.
	 *
	 * @since  1.2.0
	 * @return array<string, string>
	 */
	public static function labels(): array {
		return array_map(
			static fn( array $definition ): string => $definition['label'],
			self::definitions()
		);
	}

	/**
	 * The registry as picker options: `label`, `value`, `group`, `tier_required`.
	 *
	 * Consumed by the settings catalog's dynamic-options contract and by the
	 * item editor. Reading every EXIF field is a Free capability, so every
	 * option is emitted at the `free` tier.
	 *
	 * @since  1.2.0
	 * @return array<int, array{label:string, value:string, group:string, tier_required:string}>
	 */
	public static function as_options(): array {
		$options = array();

		foreach ( self::definitions() as $key => $definition ) {
			$options[] = array(
				'label'         => $definition['label'],
				'value'         => $key,
				'group'         => $definition['group'],
				'tier_required' => 'free',
			);
		}

		return $options;
	}

	/**
	 * Narrow a caller-supplied list to known keys.
	 *
	 * The caller's order is preserved, because the gallery's field order is
	 * the order the lightbox renders them in. Duplicates are dropped.
	 *
	 * @since  1.2.0
	 * @param  mixed $keys Candidate field keys.
	 * @return string[]
	 */
	public static function sanitize_keys( $keys ): array {
		if ( ! is_array( $keys ) ) {
			return array();
		}

		$known = self::definitions();
		$out   = array();

		foreach ( $keys as $key ) {
			if ( ! is_string( $key ) || ! isset( $known[ $key ] ) || in_array( $key, $out, true ) ) {
				continue;
			}
			$out[] = $key;
		}

		return $out;
	}
}
