<?php
/**
 * Forgiving markup tokenizer for formatted text.
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
 * Splits markup into text, start, end and dropped tokens.
 *
 * Mirrors shared/formatted-text/tokenize.ts; the shared fixtures keep
 * the two in step. Anything that cannot be read as a tag becomes text,
 * comments and declarations become dropped tokens, and raw-text element
 * content is skipped. Text and attribute values are returned decoded.
 *
 * @since 1.3.0
 */
final class Tokenizer {

	const WHITESPACE = "\t\n\f\r ";

	/**
	 * Tokenizes markup.
	 *
	 * @since 1.3.0
	 * @param string   $input    Markup.
	 * @param string[] $raw_text Lower-case names of raw-text elements.
	 * @return array<int, array<string, mixed>>
	 */
	public static function tokenize( string $input, array $raw_text ): array {
		$tokens = array();
		$text   = '';
		$length = strlen( $input );
		$i      = 0;

		while ( $i < $length ) {
			if ( '<' !== $input[ $i ] ) {
				$next  = strpos( $input, '<', $i );
				$end   = false === $next ? $length : $next;
				$text .= substr( $input, $i, $end - $i );
				$i     = $end;
				continue;
			}

			$following = $input[ $i + 1 ] ?? '';

			if ( 0 === substr_compare( $input, '<!--', $i, 4 ) ) {
				self::flush( $tokens, $text );
				$close    = strpos( $input, '-->', $i + 4 );
				$i        = false === $close ? $length : $close + 3;
				$tokens[] = array( 'type' => 'dropped' );
				continue;
			}

			if ( '!' === $following || '?' === $following ) {
				self::flush( $tokens, $text );
				$close    = strpos( $input, '>', $i + 2 );
				$i        = false === $close ? $length : $close + 1;
				$tokens[] = array( 'type' => 'dropped' );
				continue;
			}

			if ( '/' === $following && self::is_tag_start( $input[ $i + 2 ] ?? '' ) ) {
				self::flush( $tokens, $text );
				$name     = self::read_name( $input, $i + 2 )[0];
				$close    = strpos( $input, '>', $i + 2 );
				$i        = false === $close ? $length : $close + 1;
				$tokens[] = array(
					'type' => 'end',
					'name' => $name,
				);
				continue;
			}

			if ( self::is_tag_start( $following ) ) {
				$tag = self::read_start_tag( $input, $i + 1 );
				self::flush( $tokens, $text );
				if ( null === $tag ) {
					$tokens[] = array( 'type' => 'dropped' );
					break;
				}
				$tokens[] = $tag['token'];
				$i        = $tag['next'];
				if ( in_array( $tag['token']['name'], $raw_text, true ) ) {
					$end = self::find_raw_text_end( $input, $i, $tag['token']['name'] );
					if ( $end > $i ) {
						$tokens[] = array( 'type' => 'dropped' );
					}
					$i = $end;
				}
				continue;
			}

			$text .= '<';
			++$i;
		}

		self::flush( $tokens, $text );
		return $tokens;
	}

	/**
	 * Appends pending text as a decoded text token.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $tokens Token list.
	 * @param string                           $text   Pending raw text; cleared.
	 * @return void
	 */
	private static function flush( array &$tokens, string &$text ): void {
		if ( '' !== $text ) {
			$tokens[] = array(
				'type'  => 'text',
				'value' => Entities::decode( $text ),
			);
			$text     = '';
		}
	}

	/**
	 * Whether a character can start a tag name.
	 *
	 * @since 1.3.0
	 * @param string $char Single character.
	 * @return bool
	 */
	private static function is_tag_start( string $char ): bool {
		return 1 === preg_match( '/^[A-Za-z]$/', $char );
	}

	/**
	 * Whether a character is HTML whitespace.
	 *
	 * @since 1.3.0
	 * @param string $char Single character.
	 * @return bool
	 */
	private static function is_space( string $char ): bool {
		return '' !== $char && false !== strpos( self::WHITESPACE, $char );
	}

	/**
	 * Reads a tag name.
	 *
	 * @since 1.3.0
	 * @param string $input Markup.
	 * @param int    $from  Offset of the first name character.
	 * @return array{0: string, 1: int} Lower-case name and the offset after it.
	 */
	private static function read_name( string $input, int $from ): array {
		$length = strlen( $input );
		$end    = $from;
		while ( $end < $length && ! self::is_space( $input[ $end ] ) && '/' !== $input[ $end ] && '>' !== $input[ $end ] ) {
			++$end;
		}
		return array( strtolower( substr( $input, $from, $end - $from ) ), $end );
	}

	/**
	 * Reads a start tag beginning after its `<`.
	 *
	 * @since 1.3.0
	 * @param string $input Markup.
	 * @param int    $from  Offset after `<`.
	 * @return array{token: array<string, mixed>, next: int}|null Null when the input ends inside the tag.
	 */
	private static function read_start_tag( string $input, int $from ): ?array {
		$length           = strlen( $input );
		list( $name, $i ) = self::read_name( $input, $from );
		$attributes       = array();
		$seen             = array();
		$self_closing     = false;

		while ( $i < $length ) {
			$char = $input[ $i ];
			if ( self::is_space( $char ) ) {
				++$i;
				continue;
			}
			if ( '>' === $char ) {
				return array(
					'token' => array(
						'type'        => 'start',
						'name'        => $name,
						'attributes'  => $attributes,
						'selfClosing' => $self_closing,
					),
					'next'  => $i + 1,
				);
			}
			if ( '/' === $char ) {
				$self_closing = '>' === ( $input[ $i + 1 ] ?? '' );
				++$i;
				continue;
			}
			$self_closing = false;

			$name_end = $i + 1;
			while ( $name_end < $length && ! self::is_space( $input[ $name_end ] ) && '/' !== $input[ $name_end ] && '>' !== $input[ $name_end ] && '=' !== $input[ $name_end ] ) {
				++$name_end;
			}
			$attr_name = strtolower( substr( $input, $i, $name_end - $i ) );
			$i         = $name_end;
			while ( $i < $length && self::is_space( $input[ $i ] ) ) {
				++$i;
			}

			$value = '';
			if ( '=' === ( $input[ $i ] ?? '' ) ) {
				++$i;
				while ( $i < $length && self::is_space( $input[ $i ] ) ) {
					++$i;
				}
				$quote = $input[ $i ] ?? '';
				if ( '"' === $quote || "'" === $quote ) {
					$close = strpos( $input, $quote, $i + 1 );
					if ( false === $close ) {
						return null;
					}
					$value = substr( $input, $i + 1, $close - $i - 1 );
					$i     = $close + 1;
				} else {
					$value_end = $i;
					while ( $value_end < $length && ! self::is_space( $input[ $value_end ] ) && '>' !== $input[ $value_end ] ) {
						++$value_end;
					}
					$value = substr( $input, $i, $value_end - $i );
					$i     = $value_end;
				}
			}

			if ( ! isset( $seen[ $attr_name ] ) ) {
				$seen[ $attr_name ] = true;
				$attributes[]       = array( $attr_name, Entities::decode( $value ) );
			}
		}
		return null;
	}

	/**
	 * Finds where the content of a raw-text element ends.
	 *
	 * @since 1.3.0
	 * @param string $input Markup.
	 * @param int    $from  Offset after the start tag.
	 * @param string $name  Element name.
	 * @return int Offset of the matching end tag, or the input length.
	 */
	private static function find_raw_text_end( string $input, int $from, string $name ): int {
		if ( preg_match( '#</' . preg_quote( $name, '#' ) . '(?=[\t\n\f\r />]|$)#i', $input, $match, PREG_OFFSET_CAPTURE, $from ) ) {
			return (int) $match[0][1];
		}
		return strlen( $input );
	}
}
