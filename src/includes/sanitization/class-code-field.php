<?php
/**
 * Sanitiser for raw code-field input (CSS / JS / similar).
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
 * Sanitises raw code-field input for safe storage in post meta.
 *
 * Intentionally narrower than `sanitize_textarea_field`:
 *
 *  - Removes null bytes and ASCII control characters (except tab, newline, CR)
 *    which have no legitimate use in source code and are common in obfuscation
 *    payloads.
 *  - Preserves ALL printable characters, including `<`, `>`, `&`, quotes, and
 *    every character valid in CSS or JavaScript.
 *
 * `sanitize_textarea_field` strips HTML tags and encodes entities, which
 * corrupts legitimate code - e.g. JS comparisons (`a < b`), arrow functions
 * (`=>`), template literal expressions, or any CSS selector containing `>`.
 * This class avoids that corruption.
 *
 * NOTE: this sanitises for *storage* only. Render-time sanitisation
 * (preventing breakout from `<style>` / `<script>` tags) is handled separately
 * by the Custom_Css and Custom_Js feature classes.
 *
 * @since 1.0.0
 */
final class Code_Field {

	/**
	 * Sanitise a raw code string for storage.
	 *
	 * @since 1.0.0
	 * @param string $raw Raw code input.
	 * @return string Sanitised code, safe for storage in post meta.
	 */
	public static function sanitize( string $raw ): string {
		// Strip null bytes and ASCII control characters, preserving tab (\x09),
		// newline (\x0A), and carriage return (\x0D) which are valid in code.
		$sanitized = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $raw );

		return is_string( $sanitized ) ? $sanitized : '';
	}
}
