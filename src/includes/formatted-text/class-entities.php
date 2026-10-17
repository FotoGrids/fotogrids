<?php
/**
 * Character-reference decoding and escaping for formatted text.
 *
 * @package FotoGrids\Formatted_Text
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Formatted_Text;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Decodes character references and escapes output.
 *
 * Mirrors shared/formatted-text/entities.ts.
 *
 * @since 1.3.0
 */
final class Entities {

	const PATTERN = '/&(#[0-9]{1,8}|#[xX][0-9a-fA-F]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/';

	/**
	 * Decodes character references that end in a semicolon.
	 *
	 * @since 1.3.0
	 * @param string $value Text or attribute value.
	 * @return string
	 */
	public static function decode( string $value ): string {
		if ( false === strpos( $value, '&' ) ) {
			return $value;
		}
		return (string) preg_replace_callback(
			self::PATTERN,
			static function ( array $found ): string {
				$body = $found[1];
				if ( '#' === $body[0] ) {
					return self::decode_numeric( $body );
				}
				$decoded = html_entity_decode( $found[0], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
				return $decoded === $found[0] ? $found[0] : $decoded;
			},
			$value
		);
	}

	/**
	 * Decodes a numeric reference body such as `#8217` or `#x2014`.
	 *
	 * @since 1.3.0
	 * @param string $body Reference body without `&` and `;`.
	 * @return string
	 */
	private static function decode_numeric( string $body ): string {
		$code = ( 'x' === $body[1] || 'X' === $body[1] ) ? (int) hexdec( substr( $body, 2 ) ) : (int) substr( $body, 1 );
		if ( 0 === $code || $code > 0x10FFFF || ( $code >= 0xD800 && $code <= 0xDFFF ) ) {
			return "\u{FFFD}";
		}
		if ( $code < 0x80 ) {
			return chr( $code );
		}
		if ( $code < 0x800 ) {
			return chr( 0xC0 | ( $code >> 6 ) ) . chr( 0x80 | ( $code & 0x3F ) );
		}
		if ( $code < 0x10000 ) {
			return chr( 0xE0 | ( $code >> 12 ) ) . chr( 0x80 | ( ( $code >> 6 ) & 0x3F ) ) . chr( 0x80 | ( $code & 0x3F ) );
		}
		return chr( 0xF0 | ( $code >> 18 ) ) . chr( 0x80 | ( ( $code >> 12 ) & 0x3F ) ) . chr( 0x80 | ( ( $code >> 6 ) & 0x3F ) ) . chr( 0x80 | ( $code & 0x3F ) );
	}

	/**
	 * Escapes text for an HTML text node.
	 *
	 * Encoding quotes as well keeps the text exactly as stored when WordPress
	 * runs wptexturize() over the page, as it does for escaped text elsewhere.
	 *
	 * @since 1.3.0
	 * @param string $value  Plain text.
	 * @param bool   $quotes Also encode double and single quotes.
	 * @return string
	 */
	public static function escape_text( string $value, bool $quotes = false ): string {
		$out = str_replace( array( '&', '<', '>' ), array( '&amp;', '&lt;', '&gt;' ), $value );
		return $quotes ? str_replace( array( '"', "'" ), array( '&quot;', '&#039;' ), $out ) : $out;
	}

	/**
	 * Escapes text for a double-quoted HTML attribute value.
	 *
	 * @since 1.3.0
	 * @param string $value Plain text.
	 * @return string
	 */
	public static function escape_attribute( string $value ): string {
		return str_replace( '"', '&quot;', self::escape_text( $value ) );
	}
}
