<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Shared normalisation helpers for decorator and feature modules.
 *
 * Covers the recurring patterns for reading responsive setting values that the
 * admin UI stores in two shapes:
 *
 *   - Plain scalar:  $raw = 10  (legacy or PHP default)
 *   - Unit object:   $raw = ['value' => 10, 'unit' => 'px']
 *
 * For responsive settings the outer layer is always a breakpoint keyed array:
 *
 *   $raw = ['desktop' => ..., 'tablet' => ..., 'mobile' => ...]
 *
 * Four-sided variants add a second level:
 *
 *   $raw = ['desktop' => ['top' => ..., 'right' => ..., 'bottom' => ..., 'left' => ...], ...]
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
trait Setting_Helpers {

	/**
	 * Coerce a raw setting value to bool.
	 *
	 * Treats true, 1, and '1' as truthy; everything else as false.
	 *
	 * @since  1.0.0
	 * @param  mixed $raw Raw setting value.
	 * @return bool
	 */
	protected function setting_to_bool( $raw ): bool {
		return true === $raw || 1 === $raw || '1' === $raw;
	}

	/**
	 * Normalise a single unit value to a CSS string.
	 *
	 * Handles both plain scalars and ['value' => x, 'unit' => y] objects.
	 * Returns an empty string when the value is empty or null.
	 *
	 * @since  1.0.0
	 * @param  mixed  $raw          Raw value (scalar or unit object).
	 * @param  string $default_unit Unit to append when none is stored (e.g. 'px').
	 * @return string               CSS value string, e.g. '10px', or '' when absent.
	 */
	protected function normalize_unit_value( $raw, string $default_unit ): string {
		if ( null === $raw || '' === $raw ) {
			return '';
		}

		if ( is_array( $raw ) ) {
			if ( ! isset( $raw['value'] ) || '' === $raw['value'] ) {
				return '';
			}
			$unit = isset( $raw['unit'] ) && is_string( $raw['unit'] ) ? $raw['unit'] : $default_unit;
			return (string) $raw['value'] . $unit;
		}

		return (string) $raw . $default_unit;
	}

	/**
	 * Read a single-sided responsive value for a given breakpoint.
	 *
	 * @since  1.0.0
	 * @param  mixed  $raw_responsive Breakpoint-keyed array, or null/non-array.
	 * @param  string $breakpoint     'desktop', 'tablet', or 'mobile'.
	 * @param  string $default_unit   Unit to append when none is stored.
	 * @param  string $fallback       Value to return when the breakpoint is absent/empty.
	 * @return string
	 */
	protected function resolve_responsive_value( $raw_responsive, string $breakpoint, string $default_unit, string $fallback = '' ): string {
		if ( ! is_array( $raw_responsive ) ) {
			return $fallback;
		}

		$raw = $raw_responsive[ $breakpoint ] ?? null;
		if ( null === $raw || '' === $raw ) {
			return $fallback;
		}

		$resolved = $this->normalize_unit_value( $raw, $default_unit );
		return '' !== $resolved ? $resolved : $fallback;
	}

	/**
	 * Read a four-sided responsive value for a given breakpoint.
	 *
	 * Returns a CSS shorthand string: "top right bottom left".
	 * Falls back gracefully to a plain scalar when the UI has not yet stored
	 * the four-sided shape (e.g. PHP defaults before the user edits the control).
	 *
	 * Expected shape for a device value:
	 *   ['top' => 10, 'right' => 4, 'bottom' => 4, 'left' => 4]
	 *   or ['top' => ['value' => 10, 'unit' => 'px'], ...]
	 *
	 * @since  1.0.0
	 * @param  mixed  $raw_responsive Breakpoint-keyed array, or null/non-array.
	 * @param  string $breakpoint     'desktop', 'tablet', or 'mobile'.
	 * @param  string $default_unit   Unit to append when none is stored.
	 * @return string                 CSS shorthand, e.g. '10px 4px 4px 4px', or ''.
	 */
	protected function resolve_four_sided_value( $raw_responsive, string $breakpoint, string $default_unit ): string {
		if ( ! is_array( $raw_responsive ) ) {
			return '';
		}

		$device_value = $raw_responsive[ $breakpoint ] ?? null;

		if ( ! is_array( $device_value ) ) {
			// Plain scalar fallback (PHP defaults before the user edits the control).
			if ( null !== $device_value && '' !== $device_value ) {
				return $this->normalize_unit_value( $device_value, $default_unit );
			}
			return '';
		}

		$top    = $this->normalize_unit_value( $device_value['top'] ?? 0, $default_unit );
		$right  = $this->normalize_unit_value( $device_value['right'] ?? 0, $default_unit );
		$bottom = $this->normalize_unit_value( $device_value['bottom'] ?? 0, $default_unit );
		$left   = $this->normalize_unit_value( $device_value['left'] ?? 0, $default_unit );

		return "{$top} {$right} {$bottom} {$left}";
	}

	/**
	 * Return true when a breakpoint device value contains at least one non-zero side.
	 *
	 * Accepts both the four-sided array shape and plain scalars.
	 *
	 * @since  1.0.0
	 * @param  mixed $device_value The per-breakpoint value (one level below the breakpoint key).
	 * @return bool
	 */
	protected function breakpoint_has_value( $device_value ): bool {
		if ( null === $device_value || '' === $device_value || 0 === $device_value ) {
			return false;
		}

		if ( is_array( $device_value ) ) {
			foreach ( array( 'top', 'right', 'bottom', 'left' ) as $side ) {
				$raw = $device_value[ $side ] ?? 0;
				$num = is_array( $raw ) ? ( $raw['value'] ?? 0 ) : $raw;
				if ( (float) 0.0 !== $num ) {
					return true;
				}
			}
			return false;
		}

		return (float) 0.0 !== $device_value;
	}

	/**
	 * The typography-partial text-spacing fields and how they map to CSS.
	 *
	 * Each entry is field id => [ css property suffix, default unit ]. The
	 * default unit is only used as a fallback when a stored value carries no
	 * unit of its own. Shared by every module that consumes the typography
	 * partial so the field set stays in one place.
	 *
	 * @since  1.0.0
	 * @return array<string, array{0:string,1:string}>
	 */
	protected function text_spacing_fields(): array {
		return array(
			'line_height'    => array( 'line-height', 'em' ),
			'letter_spacing' => array( 'letter-spacing', 'em' ),
			'word_spacing'   => array( 'word-spacing', 'em' ),
		);
	}

	/**
	 * Emit responsive line-height, letter-spacing, and word-spacing CSS custom
	 * properties for one typography target.
	 *
	 * Reads the responsive_range settings the typography partial stamps under
	 * the given key prefix and appends one Responsive_Var per field that has at
	 * least one breakpoint set. Fields left untouched are skipped so the CSS
	 * fallback applies.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $vars       Variable map to append to (by reference).
	 * @param  string               $var_prefix CSS var prefix, e.g. '--fg-caption-title'.
	 * @param  array<string, mixed> $settings   Render settings array.
	 * @param  string               $key_prefix Setting key prefix, e.g. 'caption_title_'.
	 * @return void
	 */
	protected function add_text_spacing_vars( array &$vars, string $var_prefix, array $settings, string $key_prefix ): void {
		foreach ( $this->text_spacing_fields() as $field => $spec ) {
			list( $css_name, $default_unit ) = $spec;

			$raw     = $settings[ $key_prefix . $field ] ?? null;
			$desktop = $this->resolve_responsive_value( $raw, 'desktop', $default_unit );
			$tablet  = $this->resolve_responsive_value( $raw, 'tablet', $default_unit );
			$mobile  = $this->resolve_responsive_value( $raw, 'mobile', $default_unit );

			if ( '' !== $desktop || '' !== $tablet || '' !== $mobile ) {
				$vars[ $var_prefix . '-' . $css_name ] = new Responsive_Var( $desktop, $tablet, $mobile );
			}
		}
	}

	/**
	 * Read the first scalar from a setting that may be stored as a responsive
	 * array or a plain string (e.g. caption_placement, border_style).
	 *
	 * @since  1.0.0
	 * @param  mixed  $raw      Raw setting value.
	 * @param  string $fallback Value to return when nothing usable is found.
	 * @return string
	 */
	protected function setting_scalar( $raw, string $fallback ): string {
		if ( is_array( $raw ) ) {
			$first = reset( $raw );
			if ( is_string( $first ) && '' !== $first ) {
				return $first;
			}
		}

		if ( is_string( $raw ) && '' !== $raw ) {
			return $raw;
		}

		return $fallback;
	}
}
