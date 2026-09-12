<?php
/**
 * Turns raw EXIF tag values into display-ready strings.
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
 * Formatters for the EXIF field registry.
 *
 * One public method per `format` key in `Exif_Fields::definitions()`. Each
 * takes the raw tag value and returns a display string, or an empty string
 * when the value carries no meaning.
 *
 * @since 1.2.0
 */
final class Exif_Formatter {

	/**
	 * Format a raw tag value using a named formatter.
	 *
	 * @since  1.2.0
	 * @param  string|null $format Formatter name, or null for a plain passthrough.
	 * @param  mixed       $value  Raw EXIF tag value.
	 * @param  array       $exif   The full raw EXIF map, for formatters that need siblings.
	 * @return string
	 */
	public static function apply( ?string $format, $value, array $exif = array() ): string {
		if ( null === $format ) {
			return self::text( $value );
		}

		if ( ! is_callable( array( self::class, $format ) ) ) {
			return self::text( $value );
		}

		return (string) call_user_func( array( self::class, $format ), $value, $exif );
	}

	/**
	 * Sanitised passthrough for values that need no conversion.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Raw value.
	 * @return string
	 */
	public static function text( $value ): string {
		if ( is_array( $value ) ) {
			$value = reset( $value );
		}

		if ( ! is_scalar( $value ) ) {
			return '';
		}

		return sanitize_text_field( trim( (string) $value ) );
	}

	/**
	 * Camera name, with the manufacturer prefixed unless the model repeats it.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Model tag.
	 * @param  array $exif  Full EXIF map.
	 * @return string
	 */
	public static function camera( $value, array $exif = array() ): string {
		$model = self::text( $value );
		$make  = self::text( $exif['Make'] ?? '' );

		if ( '' === $model ) {
			return $make;
		}

		if ( '' === $make || 0 === stripos( $model, $make ) ) {
			return $model;
		}

		return $make . ' ' . $model;
	}

	/**
	 * Lens name, dropping the placeholder values some bodies write.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Lens tag.
	 * @return string
	 */
	public static function lens( $value ): string {
		$lens = self::text( $value );

		if ( '' === $lens || '----' === $lens || '0' === $lens ) {
			return '';
		}

		return $lens;
	}

	/**
	 * Aperture as an f-number.
	 *
	 * @since  1.2.0
	 * @param  mixed $value FNumber tag.
	 * @return string
	 */
	public static function aperture( $value ): string {
		$decimal = self::to_decimal( $value );

		if ( null === $decimal || $decimal <= 0.0 ) {
			return '';
		}

		$rounded = round( $decimal, 1 );

		return 'f/' . ( floor( $rounded ) === $rounded
			? number_format_i18n( $rounded, 0 )
			: number_format_i18n( $rounded, 1 ) );
	}

	/**
	 * Shutter speed, as a fraction below one second and as seconds above it.
	 *
	 * @since  1.2.0
	 * @param  mixed $value ExposureTime tag.
	 * @return string
	 */
	public static function shutter_speed( $value ): string {
		$decimal = self::to_decimal( $value );

		if ( null === $decimal || $decimal <= 0.0 ) {
			return '';
		}

		if ( $decimal < 1.0 ) {
			/* translators: %s: shutter-speed denominator, e.g. 250 in 1/250s. */
			return sprintf( __( '1/%ss', 'fotogrids' ), number_format_i18n( round( 1 / $decimal ) ) );
		}

		/* translators: %s: shutter speed in seconds. */
		return sprintf( __( '%ss', 'fotogrids' ), number_format_i18n( $decimal, 1 ) );
	}

	/**
	 * ISO sensitivity.
	 *
	 * @since  1.2.0
	 * @param  mixed $value ISO tag, sometimes an array of readings.
	 * @return string
	 */
	public static function iso( $value ): string {
		if ( is_array( $value ) ) {
			$value = reset( $value );
		}

		$iso = (int) $value;

		// Sensitivity is written plain - a photographer reads ISO 1600, not 1,600.
		return $iso > 0 ? (string) $iso : '';
	}

	/**
	 * Focal length in millimetres.
	 *
	 * @since  1.2.0
	 * @param  mixed $value FocalLength tag.
	 * @return string
	 */
	public static function focal_length( $value ): string {
		$decimal = self::to_decimal( $value );

		if ( null === $decimal || $decimal <= 0.0 ) {
			return '';
		}

		$rounded = round( $decimal, 1 );
		$number  = floor( $rounded ) === $rounded
			? number_format_i18n( $rounded, 0 )
			: number_format_i18n( $rounded, 1 );

		/* translators: %s: focal length in millimetres. */
		return sprintf( __( '%s mm', 'fotogrids' ), $number );
	}

	/**
	 * Exposure compensation in EV, signed.
	 *
	 * @since  1.2.0
	 * @param  mixed $value ExposureBiasValue tag.
	 * @return string
	 */
	public static function exposure_compensation( $value ): string {
		$decimal = self::to_decimal( $value );

		if ( null === $decimal ) {
			return '';
		}

		$rounded = round( $decimal, 1 );
		$number  = number_format_i18n( abs( $rounded ), floor( abs( $rounded ) ) === abs( $rounded ) ? 0 : 1 );
		$sign    = $rounded > 0 ? '+' : ( $rounded < 0 ? '-' : '' );

		/* translators: %s: signed exposure compensation, e.g. +0.7. */
		return sprintf( __( '%s EV', 'fotogrids' ), $sign . $number );
	}

	/**
	 * Exposure program name.
	 *
	 * @since  1.2.0
	 * @param  mixed $value ExposureProgram tag.
	 * @return string
	 */
	public static function exposure_program( $value ): string {
		return self::from_map(
			$value,
			array(
				1 => __( 'Manual', 'fotogrids' ),
				2 => __( 'Program', 'fotogrids' ),
				3 => __( 'Aperture priority', 'fotogrids' ),
				4 => __( 'Shutter priority', 'fotogrids' ),
				5 => __( 'Creative', 'fotogrids' ),
				6 => __( 'Action', 'fotogrids' ),
				7 => __( 'Portrait', 'fotogrids' ),
				8 => __( 'Landscape', 'fotogrids' ),
			)
		);
	}

	/**
	 * Exposure mode name.
	 *
	 * @since  1.2.0
	 * @param  mixed $value ExposureMode tag.
	 * @return string
	 */
	public static function exposure_mode( $value ): string {
		return self::from_map(
			$value,
			array(
				0 => __( 'Auto', 'fotogrids' ),
				1 => __( 'Manual', 'fotogrids' ),
				2 => __( 'Auto bracket', 'fotogrids' ),
			),
			true
		);
	}

	/**
	 * Metering mode name.
	 *
	 * @since  1.2.0
	 * @param  mixed $value MeteringMode tag.
	 * @return string
	 */
	public static function metering_mode( $value ): string {
		return self::from_map(
			$value,
			array(
				1   => __( 'Average', 'fotogrids' ),
				2   => __( 'Center-weighted average', 'fotogrids' ),
				3   => __( 'Spot', 'fotogrids' ),
				4   => __( 'Multi-spot', 'fotogrids' ),
				5   => __( 'Pattern', 'fotogrids' ),
				6   => __( 'Partial', 'fotogrids' ),
				255 => __( 'Other', 'fotogrids' ),
			)
		);
	}

	/**
	 * Flash state, read from the tag's bit flags.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Flash tag.
	 * @return string
	 */
	public static function flash( $value ): string {
		if ( ! is_numeric( $value ) ) {
			return '';
		}

		$bits  = (int) $value;
		$fired = ( $bits & 0x01 ) === 0x01;

		if ( ( $bits & 0x20 ) === 0x20 ) {
			return __( 'No flash function', 'fotogrids' );
		}

		if ( ! $fired ) {
			return __( 'Did not fire', 'fotogrids' );
		}

		$mode = ( $bits >> 3 ) & 0x03;

		if ( 1 === $mode ) {
			return __( 'Fired, forced', 'fotogrids' );
		}

		if ( 3 === $mode ) {
			return __( 'Fired, auto', 'fotogrids' );
		}

		return __( 'Fired', 'fotogrids' );
	}

	/**
	 * White balance mode.
	 *
	 * @since  1.2.0
	 * @param  mixed $value WhiteBalance tag.
	 * @return string
	 */
	public static function white_balance( $value ): string {
		return self::from_map(
			$value,
			array(
				0 => __( 'Auto', 'fotogrids' ),
				1 => __( 'Manual', 'fotogrids' ),
			),
			true
		);
	}

	/**
	 * Capture date, in the site's configured date and time format.
	 *
	 * @since  1.2.0
	 * @param  mixed $value DateTimeOriginal tag.
	 * @return string
	 */
	public static function date_taken( $value ): string {
		$raw = self::text( $value );

		if ( '' === $raw ) {
			return '';
		}

		// EXIF writes `Y:m:d H:i:s`, which strtotime() cannot read as-is.
		$normalised = preg_replace( '/^(\d{4}):(\d{2}):(\d{2})/', '$1-$2-$3', $raw );
		$timestamp  = strtotime( (string) $normalised );

		if ( false === $timestamp || $timestamp <= 0 ) {
			return '';
		}

		$format = trim( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ) );

		return wp_date( $format, $timestamp ) ?: '';
	}

	/**
	 * Orientation, as the transform needed to display the image upright.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Orientation tag.
	 * @return string
	 */
	public static function orientation( $value ): string {
		return self::from_map(
			$value,
			array(
				1 => __( 'Normal', 'fotogrids' ),
				2 => __( 'Flipped horizontally', 'fotogrids' ),
				3 => __( 'Rotated 180°', 'fotogrids' ),
				4 => __( 'Flipped vertically', 'fotogrids' ),
				5 => __( 'Transposed', 'fotogrids' ),
				6 => __( 'Rotated 90° CW', 'fotogrids' ),
				7 => __( 'Transversed', 'fotogrids' ),
				8 => __( 'Rotated 90° CCW', 'fotogrids' ),
			)
		);
	}

	/**
	 * Color space name.
	 *
	 * @since  1.2.0
	 * @param  mixed $value ColorSpace tag.
	 * @return string
	 */
	public static function color_space( $value ): string {
		return self::from_map(
			$value,
			array(
				1     => __( 'sRGB', 'fotogrids' ),
				2     => __( 'Adobe RGB', 'fotogrids' ),
				65535 => __( 'Uncalibrated', 'fotogrids' ),
			)
		);
	}

	/**
	 * Latitude in signed decimal degrees.
	 *
	 * @since  1.2.0
	 * @param  mixed $value GPSLatitude tag.
	 * @param  array $exif  Full EXIF map, for the hemisphere reference.
	 * @return string
	 */
	public static function gps_latitude( $value, array $exif = array() ): string {
		return self::gps_coordinate( $value, $exif['GPSLatitudeRef'] ?? '', array( 'S', 'W' ) );
	}

	/**
	 * Longitude in signed decimal degrees.
	 *
	 * @since  1.2.0
	 * @param  mixed $value GPSLongitude tag.
	 * @param  array $exif  Full EXIF map, for the hemisphere reference.
	 * @return string
	 */
	public static function gps_longitude( $value, array $exif = array() ): string {
		return self::gps_coordinate( $value, $exif['GPSLongitudeRef'] ?? '', array( 'S', 'W' ) );
	}

	/**
	 * Altitude in metres, negative below sea level.
	 *
	 * @since  1.2.0
	 * @param  mixed $value GPSAltitude tag.
	 * @param  array $exif  Full EXIF map, for the below-sea-level reference.
	 * @return string
	 */
	public static function gps_altitude( $value, array $exif = array() ): string {
		$decimal = self::to_decimal( $value );

		if ( null === $decimal ) {
			return '';
		}

		if ( 1 === self::byte_value( $exif['GPSAltitudeRef'] ?? 0 ) ) {
			$decimal = -$decimal;
		}

		/* translators: %s: altitude in metres. */
		return sprintf( __( '%s m', 'fotogrids' ), number_format_i18n( round( $decimal, 1 ), 1 ) );
	}

	/**
	 * Convert a degrees/minutes/seconds triple to signed decimal degrees.
	 *
	 * @since  1.2.0
	 * @param  mixed    $value          GPS coordinate tag.
	 * @param  mixed    $reference      Hemisphere reference tag.
	 * @param  string[] $negative_refs  References that make the value negative.
	 * @return string
	 */
	private static function gps_coordinate( $value, $reference, array $negative_refs ): string {
		if ( ! is_array( $value ) || count( $value ) < 3 ) {
			return '';
		}

		$degrees = self::to_decimal( $value[0] );
		$minutes = self::to_decimal( $value[1] );
		$seconds = self::to_decimal( $value[2] );

		if ( null === $degrees || null === $minutes || null === $seconds ) {
			return '';
		}

		$decimal = $degrees + ( $minutes / 60 ) + ( $seconds / 3600 );

		if ( in_array( strtoupper( trim( (string) $reference ) ), $negative_refs, true ) ) {
			$decimal = -$decimal;
		}

		return (string) round( $decimal, 6 );
	}

	/**
	 * Read an EXIF BYTE tag as an integer.
	 *
	 * exif_read_data() returns a BYTE as a raw one-character string, so
	 * GPSAltitudeRef's "below sea level" arrives as "\x01" rather than "1"
	 * and a plain integer cast reads it as zero.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Raw tag value.
	 * @return int
	 */
	private static function byte_value( $value ): int {
		if ( is_int( $value ) ) {
			return $value;
		}

		if ( ! is_string( $value ) || '' === $value ) {
			return 0;
		}

		if ( is_numeric( $value ) ) {
			return (int) $value;
		}

		return 1 === strlen( $value ) ? ord( $value ) : 0;
	}

	/**
	 * Look a numeric tag value up in a label map.
	 *
	 * @since  1.2.0
	 * @param  mixed                 $value      Raw tag value.
	 * @param  array<int, string>    $map        Tag value => label.
	 * @param  bool                  $allow_zero Whether 0 is a meaningful value in this map.
	 * @return string
	 */
	private static function from_map( $value, array $map, bool $allow_zero = false ): string {
		if ( ! is_numeric( $value ) ) {
			return '';
		}

		$key = (int) $value;

		if ( 0 === $key && ! $allow_zero ) {
			return '';
		}

		return $map[ $key ] ?? '';
	}

	/**
	 * Read an EXIF rational ("1/250", "28/10") or number as a float.
	 *
	 * @since  1.2.0
	 * @param  mixed $value Raw tag value.
	 * @return float|null Null when the value is not a number.
	 */
	private static function to_decimal( $value ): ?float {
		if ( is_array( $value ) ) {
			$value = reset( $value );
		}

		if ( is_int( $value ) || is_float( $value ) ) {
			return (float) $value;
		}

		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return null;
		}

		$value = trim( $value );

		if ( preg_match( '#^(-?\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)$#', $value, $matches ) ) {
			$denominator = (float) $matches[2];

			return 0.0 === $denominator ? null : (float) $matches[1] / $denominator;
		}

		return is_numeric( $value ) ? (float) $value : null;
	}
}
