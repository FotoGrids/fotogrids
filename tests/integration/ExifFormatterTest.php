<?php
/**
 * EXIF formatter guard.
 *
 * Runs `Exif_Formatter` over raw tag values shaped the way `exif_read_data()`
 * actually returns them - rationals as "n/d" strings, BYTE tags as raw
 * one-character strings, GPS coordinates as degree/minute/second triples - and
 * asserts the display strings.
 *
 * WordPress-independent: the handful of WordPress functions the formatters
 * touch are stubbed (matching the isolated suite).
 *
 * @package FotoGrids\Tests
 * @since   1.2.0
 */

declare(strict_types=1);

$plugin_root = dirname( __DIR__, 2 );

if ( ! defined( 'WPINC' ) ) {
	define( 'WPINC', 'wp-includes' );
}

if ( ! function_exists( '__' ) ) {
	/**
	 * Translation stub.
	 *
	 * @param  string $text   Text to return.
	 * @param  string $domain Text domain, unused.
	 * @return string
	 */
	function __( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	/**
	 * Sanitisation stub.
	 *
	 * @param  string $value Value to clean.
	 * @return string
	 */
	function sanitize_text_field( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
		return trim( (string) preg_replace( '/[\r\n\t]+/', ' ', (string) $value ) );
	}
}

if ( ! function_exists( 'number_format_i18n' ) ) {
	/**
	 * Number-format stub.
	 *
	 * @param  float $number   Number to format.
	 * @param  int   $decimals Decimal places.
	 * @return string
	 */
	function number_format_i18n( $number, $decimals = 0 ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
		return number_format( (float) $number, (int) $decimals );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	/**
	 * Option stub returning fixed date and time formats.
	 *
	 * @param  string $name Option name.
	 * @return string
	 */
	function get_option( $name ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
		return 'date_format' === $name ? 'Y-m-d' : 'H:i';
	}
}

if ( ! function_exists( 'wp_date' ) ) {
	/**
	 * Date stub formatting in UTC.
	 *
	 * @param  string $format    Date format.
	 * @param  int    $timestamp Unix timestamp.
	 * @return string
	 */
	function wp_date( $format, $timestamp = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
		return gmdate( (string) $format, (int) $timestamp );
	}
}

require_once $plugin_root . '/src/includes/exif/class-exif-formatter.php';

use FotoGrids\Exif\Exif_Formatter;

$failures = array();

/**
 * Assert one formatter's output.
 *
 * @param  string $format   Formatter name.
 * @param  mixed  $value    Raw tag value.
 * @param  string $expected Expected display string.
 * @param  array  $exif     Sibling tags.
 * @param  string $label    What the case covers.
 * @return void
 */
$assert = static function ( string $format, $value, string $expected, array $exif, string $label ) use ( &$failures ): void {
	$actual = Exif_Formatter::apply( $format, $value, $exif );

	if ( $actual !== $expected ) {
		$failures[] = sprintf( '%s: expected "%s", got "%s".', $label, $expected, $actual );
	}
};

// Camera: the make is prefixed unless the model already repeats it.
$assert( 'camera', 'Mark II', 'FGTEST Mark II', array( 'Make' => 'FGTEST' ), 'camera prefixes the make' );
$assert( 'camera', 'NIKON CORPORATION Z9', 'NIKON CORPORATION Z9', array( 'Make' => 'NIKON CORPORATION' ), 'camera does not double the make' );
$assert( 'camera', '', 'FGTEST', array( 'Make' => 'FGTEST' ), 'camera falls back to the make alone' );

// Lens: placeholder values some bodies write are dropped.
$assert( 'lens', 'FG 50mm f/1.8', 'FG 50mm f/1.8', array(), 'lens passes a real name through' );
$assert( 'lens', '----', '', array(), 'lens drops the ---- placeholder' );

// Rationals arrive as "n/d" strings.
$assert( 'aperture', '28/10', 'f/2.8', array(), 'aperture from a rational' );
$assert( 'aperture', '4/1', 'f/4', array(), 'aperture drops a trailing zero' );
$assert( 'aperture', '0/1', '', array(), 'aperture rejects zero' );
$assert( 'shutter_speed', '1/250', '1/250s', array(), 'sub-second shutter stays fractional' );
$assert( 'shutter_speed', '2/1', '2.0s', array(), 'shutter above a second reads in seconds' );
$assert( 'focal_length', '500/10', '50 mm', array(), 'focal length from a rational' );

// Sensitivity is written plain, with no thousands separator.
$assert( 'iso', 1600, '1600', array(), 'ISO carries no thousands separator' );
$assert( 'iso', array( 400, 400 ), '400', array(), 'ISO reads the first of an array' );
$assert( 'iso', 0, '', array(), 'ISO rejects zero' );

// Exposure compensation is signed, and zero carries no sign.
$assert( 'exposure_compensation', '7/10', '+0.7 EV', array(), 'positive exposure compensation' );
$assert( 'exposure_compensation', '-4/10', '-0.4 EV', array(), 'negative exposure compensation' );
$assert( 'exposure_compensation', '0/10', '0 EV', array(), 'zero exposure compensation is unsigned' );

// Enumerations, including the ones where zero is meaningful.
$assert( 'exposure_program', 3, 'Aperture priority', array(), 'exposure program 3' );
$assert( 'exposure_mode', 0, 'Auto', array(), 'exposure mode 0 is meaningful' );
$assert( 'metering_mode', 2, 'Center-weighted average', array(), 'metering mode 2' );
$assert( 'white_balance', 0, 'Auto', array(), 'white balance 0 is meaningful' );
$assert( 'color_space', 65535, 'Uncalibrated', array(), 'color space 65535' );
$assert( 'orientation', 6, 'Rotated 90° CW', array(), 'orientation 6' );
$assert( 'orientation', 0, '', array(), 'orientation 0 is absent, not a value' );

// Flash is a bit field, not an enumeration.
$assert( 'flash', 0x19, 'Fired, auto', array(), 'flash fired, auto mode' );
$assert( 'flash', 0x09, 'Fired, forced', array(), 'flash fired, forced mode' );
$assert( 'flash', 0x01, 'Fired', array(), 'flash fired, mode unset' );
$assert( 'flash', 0x00, 'Did not fire', array(), 'flash did not fire' );
$assert( 'flash', 0x20, 'No flash function', array(), 'no flash function' );

// Dates arrive colon-separated, which strtotime() cannot read as-is.
$assert( 'date_taken', '2026:07:14 18:32:05', '2026-07-14 18:32', array(), 'EXIF date is normalised before parsing' );
$assert( 'date_taken', 'not a date', '', array(), 'unparseable date yields nothing' );

// GPS: degree/minute/second triples, with the hemisphere in a sibling tag.
$dms_lat = array( '32/1', '5/1', '70908/10000' );
$dms_lon = array( '34/1', '46/1', '174480/10000' );
$assert( 'gps_latitude', $dms_lat, '32.085303', array( 'GPSLatitudeRef' => 'N' ), 'northern latitude is positive' );
$assert( 'gps_latitude', $dms_lat, '-32.085303', array( 'GPSLatitudeRef' => 'S' ), 'southern latitude is negative' );
$assert( 'gps_longitude', $dms_lon, '34.771513', array( 'GPSLongitudeRef' => 'E' ), 'eastern longitude is positive' );
$assert( 'gps_longitude', $dms_lon, '-34.771513', array( 'GPSLongitudeRef' => 'W' ), 'western longitude is negative' );
$assert( 'gps_latitude', 'not a triple', '', array( 'GPSLatitudeRef' => 'N' ), 'a non-triple latitude yields nothing' );

// GPSAltitudeRef is an EXIF BYTE: exif_read_data() hands back "\x01", not "1",
// so an integer cast alone reads below-sea-level as above.
$assert( 'gps_altitude', '425/10', '42.5 m', array( 'GPSAltitudeRef' => "\x00" ), 'altitude above sea level' );
$assert( 'gps_altitude', '180/10', '-18.0 m', array( 'GPSAltitudeRef' => "\x01" ), 'BYTE altitude ref marks below sea level' );
$assert( 'gps_altitude', '180/10', '-18.0 m', array( 'GPSAltitudeRef' => 1 ), 'integer altitude ref marks below sea level' );
$assert( 'gps_altitude', '180/10', '-18.0 m', array( 'GPSAltitudeRef' => '1' ), 'numeric-string altitude ref marks below sea level' );

if ( ! empty( $failures ) ) {
	echo "FAIL: EXIF formatter output is wrong.\n";
	foreach ( $failures as $failure ) {
		echo ' - ' . $failure . "\n";
	}
	exit( 1 );
}

echo "OK: EXIF formatters produce the expected display strings.\n";
exit( 0 );
