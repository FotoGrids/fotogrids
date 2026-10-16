<?php
/**
 * Encoders for values written into HTML attributes.
 *
 * @package FotoGrids\Sanitization
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Sanitization;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Encodes stored text and JSON so the browser reads back exactly the value
 * that was written.
 *
 * `esc_attr()` leaves existing character references alone, so a stored
 * `&quot;` would reach the browser as a bare quote. These encoders escape
 * every `&`, which `esc_attr()` then keeps as it is.
 *
 * @since 1.3.0
 */
final class Attribute_Value {

	/**
	 * JSON flags that leave no character an attribute escaper could alter.
	 *
	 * @since 1.3.0
	 */
	const JSON_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;

	/**
	 * Encodes a stored string for an attribute.
	 *
	 * @since 1.3.0
	 * @param string $value Stored value, read back unchanged by `element.dataset`.
	 * @return string
	 */
	public static function text( string $value ): string {
		return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8', true );
	}

	/**
	 * Encodes data as JSON with no characters an attribute escaper could alter.
	 *
	 * @since 1.3.0
	 * @param mixed $data Data to encode.
	 * @return string
	 */
	public static function json( $data ): string {
		return (string) wp_json_encode( $data, self::JSON_FLAGS );
	}
}
