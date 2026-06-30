<?php
/**
 * Recursive sanitiser for nested array setting values.
 *
 * @package FotoGrids\Sanitization
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Sanitization;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Deep-sanitises array-typed settings (responsive objects, token lists,
 * colour maps, etc.).
 *
 * Array settings are stored as JSON and their leaves are simple scalars -
 * numbers, slugs, colour strings, tokens - never markup or source code, so
 * each string leaf is passed through sanitize_text_field while numeric and
 * boolean leaves keep their type. Array keys are sanitised too.
 *
 * @since 1.0.0
 */
final class Array_Field {

	/**
	 * Recursively sanitise an array (or scalar) settings value.
	 *
	 * @since 1.0.0
	 * @param mixed $value Raw decoded value.
	 * @return mixed Sanitised value of the same shape.
	 */
	public static function deep( $value ) {
		if ( is_array( $value ) ) {
			$clean = array();
			foreach ( $value as $key => $item ) {
				$clean_key           = is_int( $key ) ? $key : sanitize_text_field( (string) $key );
				$clean[ $clean_key ] = self::deep( $item );
			}
			return $clean;
		}

		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
			return $value;
		}

		return sanitize_text_field( (string) $value );
	}
}
