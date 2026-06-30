<?php
/**
 * (De)serialiser for one collection setting key/value pair.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Catalog\Catalog;
use FotoGrids\Password_Crypto;
use FotoGrids\Sanitization\Array_Field;
use FotoGrids\Sanitization\Code_Field;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Maps between three representations of a per-collection setting value:
 *
 *   - raw POST input (string or array from the JS save payload)
 *   - in-memory PHP value (boolean / int / float / string / array)
 *   - stored post-meta value (always a scalar string or a JSON-encoded array)
 *
 * Centralises the type-coercion + sanitisation rules so every save / read
 * path treats the same value the same way. Used by `Collection_Save_Pipeline`
 * (writes) and any consumer that needs to interpret a freshly-read post-meta
 * value (reads).
 *
 * Three responsibilities, in three public static methods:
 *
 *   `normalize_incoming()` - raw POST → PHP value
 *   `decode_stored()`      - post-meta → PHP value
 *   `persist()`            - PHP value → post-meta write
 *
 * Plus one helper, `catalog_field_type()`, that resolves a setting key's
 * control type via the catalog so persist/normalize can branch on
 * 'codearea' vs 'password_input' etc.
 *
 * @since 1.0.0
 */
final class Setting_Value_Codec {

	/**
	 * Normalise a raw incoming POST value to its in-memory PHP shape.
	 *
	 * @since 1.0.0
	 * @param mixed  $raw_value     Raw value from the request (string or array).
	 * @param mixed  $default_value Default value shape - drives type coercion.
	 * @param string $field_type    Catalog field control type, e.g. 'codearea'.
	 * @return mixed
	 */
	public static function normalize_incoming( $raw_value, $default_value, string $field_type = '' ) {
		if ( is_array( $default_value ) ) {
			if ( is_array( $raw_value ) ) {
				return Array_Field::deep( $raw_value );
			}

			if ( is_string( $raw_value ) ) {
				$decoded_value = json_decode( wp_unslash( $raw_value ), true );
				if ( json_last_error() === JSON_ERROR_NONE ) {
					return Array_Field::deep( $decoded_value );
				}
			}

			return $default_value;
		}

		if ( is_bool( $default_value ) ) {
			return '1' === $raw_value || 'true' === $raw_value || true === $raw_value;
		}

		// button_group fields may mix numeric option values with string sentinels
		// (e.g. a "Custom" option alongside numeric presets). Always treat them as
		// strings so a sentinel like "custom" is never discarded by the numeric branch.
		if ( 'button_group' === $field_type ) {
			return sanitize_text_field( (string) $raw_value );
		}

		if ( is_numeric( $default_value ) ) {
			return is_numeric( $raw_value ) ? $raw_value + 0 : $default_value;
		}

		// codearea fields contain raw CSS/JS - use Code_Field::sanitize() which
		// strips only null bytes and control characters, preserving < > and all
		// other characters valid in source code. sanitize_textarea_field must
		// NOT be used here: it strips HTML tags and encodes entities,
		// corrupting JS comparisons, arrow functions, etc.
		if ( 'codearea' === $field_type ) {
			return Code_Field::sanitize( (string) $raw_value );
		}

		// password_input fields pass through as-is (sanitize_text_field would
		// strip special characters valid in passwords). The value is encrypted
		// - not stored as plain text - by `persist()`.
		if ( 'password_input' === $field_type ) {
			return (string) $raw_value;
		}

		return sanitize_text_field( (string) $raw_value );
	}

	/**
	 * Resolve the catalog control type for a setting key.
	 *
	 * Returns '' when the key is not in the catalog or has no control type,
	 * so callers can treat the empty string as "unknown / use defaults".
	 *
	 * @since 1.0.0
	 * @param string $setting_key Setting key (without the `fotogrids_` prefix).
	 * @return string Catalog control type, e.g. 'codearea', 'toggle'.
	 */
	public static function catalog_field_type( string $setting_key ): string {
		$entry = Catalog::get( $setting_key );
		return is_array( $entry ) ? (string) ( $entry['control'] ?? '' ) : '';
	}

	/**
	 * Decode a post-meta stored value back to its in-memory PHP shape.
	 *
	 * @since 1.0.0
	 * @param mixed $stored_value   Value as returned by `get_post_meta()`.
	 * @param mixed $default_value  Default value shape - drives type coercion.
	 * @return mixed
	 */
	public static function decode_stored( $stored_value, $default_value ) {
		if ( '' === $stored_value || null === $stored_value ) {
			return $default_value;
		}

		if ( is_array( $default_value ) ) {
			if ( is_array( $stored_value ) ) {
				return $stored_value;
			}

			if ( is_string( $stored_value ) ) {
				$decoded_value = json_decode( $stored_value, true );
				if ( json_last_error() === JSON_ERROR_NONE ) {
					return $decoded_value;
				}
			}

			return $default_value;
		}

		if ( is_bool( $default_value ) ) {
			return '1' === $stored_value || 'true' === $stored_value || true === $stored_value;
		}

		if ( is_numeric( $default_value ) ) {
			return is_numeric( $stored_value ) ? $stored_value + 0 : $default_value;
		}

		return (string) $stored_value;
	}

	/**
	 * Persist a normalised setting value into post meta.
	 *
	 * Arrays go through `wp_json_encode()`. Booleans become '0'/'1' strings.
	 * Numerics get `sanitize_text_field()`. Catalog-typed strings route
	 * through their dedicated sanitiser:
	 *
	 *   - `codearea`       → Code_Field::sanitize()
	 *   - `password_input` → Password_Crypto::encrypt() (or delete on empty;
	 *                        re-encryption guard if value already encrypted)
	 *   - default          → sanitize_text_field()
	 *
	 * @since 1.0.0
	 * @param int    $post_id       Post ID.
	 * @param string $post_meta_key Full meta key (e.g. `fotogrids_layout`).
	 * @param mixed  $setting_value Already-normalised value.
	 * @param mixed  $default_value Default value shape - drives serialisation.
	 * @param string $field_type    Catalog field control type, e.g. 'codearea'.
	 * @return void
	 */
	public static function persist( int $post_id, string $post_meta_key, $setting_value, $default_value, string $field_type = '' ): void {
		if ( is_array( $default_value ) ) {
			update_post_meta( $post_id, $post_meta_key, wp_json_encode( $setting_value ) );
			return;
		}

		if ( is_bool( $default_value ) ) {
			update_post_meta( $post_id, $post_meta_key, $setting_value ? '1' : '0' );
			return;
		}

		if ( is_numeric( $default_value ) ) {
			update_post_meta( $post_id, $post_meta_key, sanitize_text_field( (string) $setting_value ) );
			return;
		}

		// codearea fields contain raw CSS/JS - see normalize_incoming for the
		// rationale.
		if ( 'codearea' === $field_type ) {
			update_post_meta( $post_id, $post_meta_key, Code_Field::sanitize( (string) $setting_value ) );
			return;
		}

		// password_input fields are encrypted before storage so the raw
		// password is never written to the DB in plain text. An empty value
		// means "clear the password" - we delete the meta key so
		// password_is_set returns false.
		//
		// Guard: if the incoming value is already an encrypted blob (i.e. the
		// browser echoed back the ciphertext that was loaded into the field
		// on page load), skip re-encryption - just leave the stored value
		// as-is. Re-encrypting on every save causes the blob to grow
		// exponentially and eventually exhausts PHP's memory limit.
		if ( 'password_input' === $field_type ) {
			$plaintext = (string) $setting_value;
			if ( '' === $plaintext ) {
				delete_post_meta( $post_id, $post_meta_key );
			} elseif ( Password_Crypto::is_encrypted( $plaintext ) ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedElseif -- Intentional no-op: already-encrypted values are deliberately left unchanged (see comment).
				// Already encrypted - stored value unchanged; do nothing.
			} else {
				$encrypted = Password_Crypto::encrypt( $plaintext );
				if ( '' !== $encrypted ) {
					update_post_meta( $post_id, $post_meta_key, $encrypted );
				}
			}
			return;
		}

		update_post_meta( $post_id, $post_meta_key, sanitize_text_field( (string) $setting_value ) );
	}
}
