<?php
/**
 * Formatted-text parser, sanitizer and serializer.
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
 * Turns stored caption and description markup into a sanitized node tree,
 * and the tree into HTML or plain text.
 *
 * Mirrors shared/formatted-text/document.ts and serialize.ts; the shared
 * fixtures keep the two in step. Output is always rebuilt from the tree, so
 * every tag is one the profile allows and every text run is escaped.
 *
 * Options: mode ('basic' | 'plain'), links (bool), policy
 * (array{new_tab: bool, rel: string[]}|null), new_tab_label (string),
 * max_length (int).
 *
 * @since 1.3.0
 */
final class Formatter {

	/**
	 * Class of the text read out only by screen readers.
	 *
	 * @since 1.3.0
	 */
	const SCREEN_READER_CLASS = 'fg-formatted-text-sr';

	/**
	 * Link types the formatter adds itself; dropping them loses nothing.
	 *
	 * @since 1.3.0
	 */
	const IMPLIED_REL = array( 'noopener', 'noreferrer' );

	/**
	 * Deepest nesting of allowed elements; deeper ones are unwrapped.
	 *
	 * @since 1.3.0
	 */
	const MAX_DEPTH = 16;

	/**
	 * Elements that have no end tag.
	 *
	 * @since 1.3.0
	 */
	const VOID_ELEMENTS = array( 'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr' );

	/**
	 * Parses markup into sanitized nodes.
	 *
	 * @since 1.3.0
	 * @param string               $raw     Stored value.
	 * @param array<string, mixed> $profile Effective profile (Schema::profile()).
	 * @param array<string, mixed> $options Mode, link and length options.
	 * @return array{nodes: array<int, array<string, mixed>>, lossy: bool}
	 */
	public static function parse( string $raw, array $profile, array $options = array() ): array {
		$mode       = 'plain' === ( $options['mode'] ?? 'basic' ) ? 'plain' : 'basic';
		$links      = false !== ( $options['links'] ?? true );
		$policy     = isset( $options['policy'] ) && is_array( $options['policy'] ) ? $options['policy'] : null;
		$max_length = (int) ( $options['max_length'] ?? 0 );
		$input      = str_replace( array( "\r\n", "\r" ), "\n", $raw );

		if ( false === strpos( $input, '<' ) && false === strpos( $input, '&' ) && false === strpos( $input, "\n" ) ) {
			$value = (string) preg_replace( '/\A[\t\f\r ]+|[\t\f\r ]+\z/', '', $input );
			$nodes = '' === $value ? array() : array( self::text_node( $value ) );
			if ( $max_length > 0 ) {
				$nodes = self::truncate_nodes( $nodes, $max_length );
			}
			return array(
				'nodes' => $nodes,
				'lossy' => false,
			);
		}

		$built = self::build_stream( $input, $profile, $mode, $links, $policy );
		$nodes = self::clean_tree( self::to_tree( self::tidy_breaks( $built['stream'] ) ) );
		if ( $max_length > 0 ) {
			$nodes = self::truncate_nodes( $nodes, $max_length );
		}
		$label = (string) ( $options['new_tab_label'] ?? '' );
		if ( null !== $policy && '' !== $label ) {
			$nodes = self::add_screen_reader_text( $nodes, $label );
		}
		return array(
			'nodes' => $nodes,
			'lossy' => $built['lossy'],
		);
	}

	/**
	 * Serializes nodes to HTML.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes    Parsed nodes.
	 * @param bool                             $newlines Write line breaks as "\n" instead of `<br>`.
	 * @param bool                             $quotes   Also encode quotes in text, for page output.
	 * @return string
	 */
	public static function to_html( array $nodes, bool $newlines = false, bool $quotes = false ): string {
		$out = '';
		foreach ( $nodes as $node ) {
			if ( 'text' === $node['kind'] ) {
				$out .= Entities::escape_text( $node['value'], $quotes );
			} elseif ( 'break' === $node['kind'] ) {
				$out .= $newlines ? "\n" : '<br>';
			} else {
				$out .= '<' . $node['name'];
				foreach ( $node['attributes'] as $attribute ) {
					$out .= ' ' . $attribute[0] . '="' . Entities::escape_attribute( $attribute[1] ) . '"';
				}
				$out .= '>';
				if ( ! in_array( $node['name'], self::VOID_ELEMENTS, true ) ) {
					$out .= self::to_html( $node['children'], $newlines, $quotes ) . '</' . $node['name'] . '>';
				}
			}
		}
		return $out;
	}

	/**
	 * Position of the last occurrence of a name in the open-element stack.
	 *
	 * @since 1.3.0
	 * @param string[] $open Open element names.
	 * @param string   $name Element name.
	 * @return int Index, or -1.
	 */
	private static function last_index( array $open, string $name ): int {
		for ( $i = count( $open ) - 1; $i >= 0; $i-- ) {
			if ( $open[ $i ] === $name ) {
				return $i;
			}
		}
		return -1;
	}

	/**
	 * Serializes nodes to plain text with "\n" line breaks.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Parsed nodes.
	 * @return string
	 */
	public static function to_text( array $nodes ): string {
		$out = '';
		foreach ( $nodes as $node ) {
			if ( 'text' === $node['kind'] ) {
				$out .= $node['value'];
			} elseif ( 'break' === $node['kind'] ) {
				$out .= "\n";
			} elseif ( ! in_array( array( 'class', self::SCREEN_READER_CLASS ), $node['attributes'], true ) ) {
				$out .= self::to_text( $node['children'] );
			}
		}
		return $out;
	}

	/**
	 * Builds a text node.
	 *
	 * @since 1.3.0
	 * @param string $value Text.
	 * @return array<string, mixed>
	 */
	private static function text_node( string $value ): array {
		return array(
			'kind'  => 'text',
			'value' => $value,
		);
	}

	/**
	 * Whether a URL is relative or uses an allowed protocol.
	 *
	 * @since 1.3.0
	 * @param string   $value     Decoded attribute value.
	 * @param string[] $protocols Allowed protocols.
	 * @return bool
	 */
	private static function is_allowed_url( string $value, array $protocols ): bool {
		$compact = preg_replace( '/[\x{0000}-\x{0020}\x{007F}-\x{009F}]/u', '', $value );
		if ( ! is_string( $compact ) || '' === $compact ) {
			return false;
		}
		if ( ! preg_match( '/^([A-Za-z][A-Za-z0-9+.\-]*):/', $compact, $scheme ) ) {
			return true;
		}
		return in_array( strtolower( $scheme[1] ), $protocols, true );
	}

	/**
	 * Keeps the attributes the element's spec allows, in spec order.
	 *
	 * @since 1.3.0
	 * @param array<int, array{0: string, 1: string}> $attributes Decoded attributes.
	 * @param array<string, array<string, mixed>>     $specs      Attribute specs.
	 * @param string[]                                $protocols  Allowed protocols.
	 * @return array{attributes: array<int, array{0: string, 1: string}>, lossy: bool}
	 */
	private static function sanitize_attributes( array $attributes, array $specs, array $protocols ): array {
		$given = array();
		$lossy = false;
		foreach ( $attributes as $attribute ) {
			$given[ $attribute[0] ] = $attribute[1];
			if ( Schema::is_floor_attribute( $attribute[0] ) || ! array_key_exists( $attribute[0], $specs ) ) {
				$lossy = true;
			}
		}

		$out = array();
		foreach ( $specs as $name => $spec ) {
			$name = (string) $name;
			if ( ! array_key_exists( $name, $given ) ) {
				continue;
			}
			$raw = $given[ $name ];
			if ( 'url' === $spec['type'] ) {
				$value = (string) preg_replace( '/\A[\t\n\f\r ]+|[\t\n\f\r ]+\z/', '', $raw );
				if ( self::is_allowed_url( $value, $protocols ) ) {
					$out[] = array( $name, $value );
				} else {
					$lossy = true;
				}
			} elseif ( 'enum' === $spec['type'] ) {
				$value = strtolower( (string) preg_replace( '/\A[\t\n\f\r ]+|[\t\n\f\r ]+\z/', '', $raw ) );
				if ( in_array( $value, $spec['values'] ?? array(), true ) ) {
					$out[] = array( $name, $value );
				} else {
					$lossy = true;
				}
			} elseif ( 'tokens' === $spec['type'] ) {
				$tokens  = array();
				$implied = false;
				foreach ( (array) preg_split( '/[\t\n\f\r ]+/', strtolower( $raw ) ) as $token ) {
					if ( '' === $token ) {
						continue;
					}
					if ( in_array( $token, $spec['values'] ?? array(), true ) ) {
						if ( ! in_array( $token, $tokens, true ) ) {
							$tokens[] = $token;
						}
					} elseif ( 'rel' === $name && in_array( $token, self::IMPLIED_REL, true ) ) {
						$implied = true;
					} else {
						$lossy = true;
					}
				}
				if ( $tokens || ! $implied ) {
					$out[] = array( $name, implode( ' ', $tokens ) );
				}
			} else {
				$out[] = array( $name, (string) preg_replace( '/[\x00-\x08\x0B\x0E-\x1F\x7F]/', '', $raw ) );
			}
		}
		return array(
			'attributes' => $out,
			'lossy'      => $lossy,
		);
	}

	/**
	 * Fills in target and rel on a link that carries no choice of its own.
	 *
	 * @since 1.3.0
	 * @param array<int, array{0: string, 1: string}> $attributes Sanitized attributes.
	 * @param array<string, mixed>                    $policy     Keys: new_tab, rel.
	 * @param array<string, array<string, mixed>>     $specs      Attribute specs.
	 * @return array<int, array{0: string, 1: string}>
	 */
	private static function apply_link_policy( array $attributes, array $policy, array $specs ): array {
		$current = array();
		foreach ( $attributes as $attribute ) {
			$current[ $attribute[0] ] = $attribute[1];
		}
		if ( ! array_key_exists( 'target', $current ) && ! empty( $policy['new_tab'] ) ) {
			$current['target'] = '_blank';
		}
		if ( array_key_exists( 'rel', $current ) ) {
			$rel = array_values( array_filter( explode( ' ', $current['rel'] ), 'strlen' ) );
		} else {
			$link_rel = Schema::floor()['linkRel'];
			$rel      = array();
			foreach ( is_array( $policy['rel'] ?? null ) ? $policy['rel'] : array() as $token ) {
				if ( is_string( $token ) && in_array( $token, $link_rel, true ) ) {
					$rel[] = $token;
				}
			}
		}
		if ( '_blank' === ( $current['target'] ?? '' ) && ! in_array( 'noopener', $rel, true ) ) {
			$rel[] = 'noopener';
		}
		if ( ! empty( $rel ) ) {
			$current['rel'] = implode( ' ', $rel );
		} else {
			unset( $current['rel'] );
		}

		$order = array_map( 'strval', array_keys( $specs ) );
		foreach ( array( 'target', 'rel' ) as $name ) {
			if ( ! in_array( $name, $order, true ) ) {
				$order[] = $name;
			}
		}
		$out = array();
		foreach ( $order as $name ) {
			if ( array_key_exists( $name, $current ) ) {
				$out[] = array( $name, $current[ $name ] );
			}
		}
		return $out;
	}

	/**
	 * Turns tokens into a balanced stream of text, break, open and close items.
	 *
	 * @since 1.3.0
	 * @param string                    $input   Markup with "\n" line endings.
	 * @param array<string, mixed>      $profile Effective profile.
	 * @param string                    $mode    'basic' or 'plain'.
	 * @param bool                      $links   Whether links are kept.
	 * @param array<string, mixed>|null $policy  Link policy, or null to leave links as stored.
	 * @return array{stream: array<int, array<string, mixed>>, lossy: bool}
	 */
	private static function build_stream( string $input, array $profile, string $mode, bool $links, ?array $policy ): array {
		$floor     = Schema::floor();
		$tokens    = Tokenizer::tokenize( $input, $floor['rawText'] );
		$stream    = array();
		$open      = array();
		$plain     = 'plain' === $mode;
		$elements  = is_array( $profile['elements'] ?? null ) ? $profile['elements'] : array();
		$drop_with = array_merge( $profile['dropWithContent'] ?? array(), $floor['rawText'] );
		$breaks    = $profile['breakBefore'] ?? array();
		$protocols = $profile['protocols'] ?? array();
		$lossy     = false;
		$dropping  = null;
		$depth     = 0;

		$is_allowed = static function ( string $name ) use ( $plain, $elements ): bool {
			return ! $plain && 'br' !== $name && array_key_exists( $name, $elements );
		};

		$close_to = static function ( int $index ) use ( &$open, &$stream ): void {
			for ( $n = count( $open ); $n > $index; $n-- ) {
				$stream[] = array(
					't'    => 'close',
					'name' => array_pop( $open ),
				);
			}
		};

		foreach ( $tokens as $token ) {
			if ( 'dropped' === $token['type'] ) {
				$lossy = true;
				continue;
			}

			if ( null !== $dropping ) {
				if ( 'start' === $token['type'] && $token['name'] === $dropping && ! in_array( $token['name'], self::VOID_ELEMENTS, true ) ) {
					++$depth;
				} elseif ( 'end' === $token['type'] && $token['name'] === $dropping ) {
					--$depth;
					if ( 0 === $depth ) {
						$dropping = null;
					}
				}
				continue;
			}

			if ( 'text' === $token['type'] ) {
				foreach ( explode( "\n", $token['value'] ) as $index => $part ) {
					if ( $index > 0 ) {
						$stream[] = array( 't' => 'br' );
					}
					if ( '' !== $part ) {
						$stream[] = array(
							't' => 'text',
							'v' => $part,
						);
					}
				}
				continue;
			}

			$name = $token['name'];

			if ( 'br' === $name ) {
				if ( 'start' === $token['type'] && ! empty( $token['attributes'] ) ) {
					$lossy = true;
				}
				$stream[] = array( 't' => 'br' );
				continue;
			}

			if ( 'start' === $token['type'] ) {
				if ( $is_allowed( $name ) ) {
					$specs      = is_array( $elements[ $name ]['attributes'] ?? null ) ? $elements[ $name ]['attributes'] : array();
					$clean      = self::sanitize_attributes( $token['attributes'], $specs, $protocols );
					$lossy      = $lossy || $clean['lossy'];
					$attributes = $clean['attributes'];

					if ( 'a' === $name ) {
						$outer = self::last_index( $open, 'a' );
						if ( -1 !== $outer ) {
							$lossy = true;
							$close_to( $outer );
						}
						$has_href = false;
						foreach ( $attributes as $attribute ) {
							if ( 'href' === $attribute[0] ) {
								$has_href = true;
							}
						}
						if ( ! $has_href ) {
							$lossy = true;
							continue;
						}
						if ( ! $links ) {
							continue;
						}
						if ( null !== $policy ) {
							$attributes = self::apply_link_policy( $attributes, $policy, $specs );
						}
					}

					$is_void = in_array( $name, self::VOID_ELEMENTS, true );
					if ( ! $is_void && count( $open ) >= self::MAX_DEPTH ) {
						$lossy = true;
						continue;
					}
					$stream[] = array(
						't'          => 'open',
						'name'       => $name,
						'attributes' => $attributes,
					);
					if ( $is_void ) {
						$stream[] = array(
							't'    => 'close',
							'name' => $name,
						);
						continue;
					}
					$open[] = $name;
					continue;
				}

				$lossy = true;
				if ( in_array( $name, $drop_with, true ) && empty( $token['selfClosing'] ) && ! in_array( $name, self::VOID_ELEMENTS, true ) ) {
					$dropping = $name;
					$depth    = 1;
					continue;
				}
				if ( in_array( $name, $breaks, true ) ) {
					$stream[] = array( 't' => 'br' );
				}
				continue;
			}

			$index = self::last_index( $open, $name );
			if ( -1 !== $index ) {
				$close_to( $index );
				continue;
			}
			if ( in_array( $name, $breaks, true ) ) {
				$stream[] = array( 't' => 'br' );
			}
			$lossy = true;
		}

		$close_to( 0 );
		return array(
			'stream' => $stream,
			'lossy'  => $lossy,
		);
	}

	/**
	 * Finds the nearest text item from an offset, stopping at a break.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $stream Stream.
	 * @param int                              $from   Start offset.
	 * @param int                              $step   1 or -1.
	 * @return int Offset, or -1.
	 */
	private static function adjacent_text( array $stream, int $from, int $step ): int {
		$count = count( $stream );
		for ( $i = $from; $i >= 0 && $i < $count; $i += $step ) {
			if ( 'text' === $stream[ $i ]['t'] ) {
				return $i;
			}
			if ( 'br' === $stream[ $i ]['t'] ) {
				return -1;
			}
		}
		return -1;
	}

	/**
	 * Trims whitespace around breaks, keeps at most two breaks in a row, and
	 * drops leading and trailing breaks.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $stream Stream.
	 * @return array<int, array<string, mixed>>
	 */
	private static function tidy_breaks( array $stream ): array {
		foreach ( $stream as $index => $item ) {
			if ( 'br' !== $item['t'] ) {
				continue;
			}
			$before = self::adjacent_text( $stream, $index - 1, -1 );
			if ( -1 !== $before ) {
				$stream[ $before ]['v'] = (string) preg_replace( '/[\t ]+\z/', '', $stream[ $before ]['v'] );
			}
			$after = self::adjacent_text( $stream, $index + 1, 1 );
			if ( -1 !== $after ) {
				$stream[ $after ]['v'] = (string) preg_replace( '/\A[\t ]+/', '', $stream[ $after ]['v'] );
			}
		}

		$out       = array();
		$run       = 0;
		$seen_text = false;
		foreach ( $stream as $item ) {
			if ( 'text' === $item['t'] ) {
				if ( '' === $item['v'] ) {
					continue;
				}
				$run       = 0;
				$seen_text = true;
				$out[]     = $item;
			} elseif ( 'br' === $item['t'] ) {
				if ( ! $seen_text ) {
					continue;
				}
				++$run;
				if ( $run <= 2 ) {
					$out[] = $item;
				}
			} else {
				$out[] = $item;
			}
		}

		for ( $i = count( $out ) - 1; $i >= 0; $i-- ) {
			if ( 'text' === $out[ $i ]['t'] ) {
				break;
			}
			if ( 'br' === $out[ $i ]['t'] ) {
				array_splice( $out, $i, 1 );
			}
		}

		$first = null;
		$last  = null;
		foreach ( $out as $i => $item ) {
			if ( 'text' === $item['t'] ) {
				if ( null === $first ) {
					$first = $i;
				}
				$last = $i;
			}
		}
		if ( null !== $first ) {
			$out[ $first ]['v'] = (string) preg_replace( '/\A[\t\n\f\r ]+/', '', $out[ $first ]['v'] );
		}
		if ( null !== $last ) {
			$out[ $last ]['v'] = (string) preg_replace( '/[\t\n\f\r ]+\z/', '', $out[ $last ]['v'] );
		}

		return array_values(
			array_filter(
				$out,
				static function ( array $item ): bool {
					return 'text' !== $item['t'] || '' !== $item['v'];
				}
			)
		);
	}

	/**
	 * Builds a node tree from a balanced stream.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $stream Stream.
	 * @return array<int, array<string, mixed>>
	 */
	private static function to_tree( array $stream ): array {
		$root  = array( 'children' => array() );
		$stack = array( &$root );
		foreach ( $stream as $item ) {
			$parent = &$stack[ count( $stack ) - 1 ];
			if ( 'text' === $item['t'] ) {
				$last = count( $parent['children'] ) - 1;
				if ( $last >= 0 && 'text' === $parent['children'][ $last ]['kind'] ) {
					$parent['children'][ $last ]['value'] .= $item['v'];
				} else {
					$parent['children'][] = self::text_node( $item['v'] );
				}
			} elseif ( 'br' === $item['t'] ) {
				$parent['children'][] = array( 'kind' => 'break' );
			} elseif ( 'open' === $item['t'] ) {
				$parent['children'][] = array(
					'kind'       => 'element',
					'name'       => $item['name'],
					'attributes' => $item['attributes'],
					'children'   => array(),
				);
				$stack[]              = &$parent['children'][ count( $parent['children'] ) - 1 ];
			} elseif ( count( $stack ) > 1 ) {
				array_pop( $stack );
			}
			unset( $parent );
		}
		return $root['children'];
	}

	/**
	 * Whether nodes contain any non-whitespace text.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes.
	 * @return bool
	 */
	private static function has_visible_text( array $nodes ): bool {
		foreach ( $nodes as $node ) {
			if ( 'text' === $node['kind'] && '' !== preg_replace( '/[\t\n\f\r ]+/', '', $node['value'] ) ) {
				return true;
			}
			if ( 'element' === $node['kind'] && self::has_visible_text( $node['children'] ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Drops empty elements and unwraps links with no visible text.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes.
	 * @return array<int, array<string, mixed>>
	 */
	private static function clean_tree( array $nodes ): array {
		$out = array();
		foreach ( $nodes as $node ) {
			if ( 'element' !== $node['kind'] ) {
				$out[] = $node;
				continue;
			}
			$node['children'] = self::clean_tree( $node['children'] );
			if ( in_array( $node['name'], self::VOID_ELEMENTS, true ) ) {
				$out[] = $node;
				continue;
			}
			if ( empty( $node['children'] ) ) {
				continue;
			}
			if ( 'a' === $node['name'] && ! self::has_visible_text( $node['children'] ) ) {
				foreach ( $node['children'] as $child ) {
					$out[] = $child;
				}
				continue;
			}
			$out[] = $node;
		}
		return $out;
	}

	/**
	 * Counts visible characters, with a break counting as one.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes.
	 * @return int
	 */
	private static function count_units( array $nodes ): int {
		$total = 0;
		foreach ( $nodes as $node ) {
			if ( 'text' === $node['kind'] ) {
				$total += mb_strlen( $node['value'], 'UTF-8' );
			} elseif ( 'break' === $node['kind'] ) {
				++$total;
			} else {
				$total += self::count_units( $node['children'] );
			}
		}
		return $total;
	}

	/**
	 * Cuts nodes after a number of visible characters and adds an ellipsis.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes.
	 * @param int                              $max   Characters to keep.
	 * @return array<int, array<string, mixed>>
	 */
	private static function truncate_nodes( array $nodes, int $max ): array {
		if ( self::count_units( $nodes ) <= $max ) {
			return $nodes;
		}
		$remaining = $max;
		$cut       = false;
		$result    = self::truncate_walk( $nodes, $remaining, $cut );
		if ( ! self::ends_with_ellipsis( $result ) ) {
			self::trim_trailing_breaks( $result );
			self::append_ellipsis( $result );
		}
		return $result;
	}

	/**
	 * Walks nodes for truncate_nodes().
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes     Nodes.
	 * @param int                              $remaining Characters left; updated.
	 * @param bool                             $cut       Whether the cut happened; updated.
	 * @return array<int, array<string, mixed>>
	 */
	private static function truncate_walk( array $nodes, int &$remaining, bool &$cut ): array {
		$out = array();
		foreach ( $nodes as $node ) {
			if ( $cut ) {
				break;
			}
			if ( 'text' === $node['kind'] ) {
				$length = mb_strlen( $node['value'], 'UTF-8' );
				if ( $length <= $remaining ) {
					$remaining -= $length;
					$out[]      = $node;
				} else {
					if ( $remaining > 0 ) {
						$out[] = self::text_node( mb_substr( $node['value'], 0, $remaining, 'UTF-8' ) . '…' );
					}
					$remaining = 0;
					$cut       = true;
				}
			} elseif ( 'break' === $node['kind'] ) {
				if ( $remaining >= 1 ) {
					--$remaining;
					$out[] = $node;
				} else {
					$cut = true;
				}
			} else {
				$children = self::truncate_walk( $node['children'], $remaining, $cut );
				if ( ! empty( $children ) || in_array( $node['name'], self::VOID_ELEMENTS, true ) ) {
					$node['children'] = $children;
					$out[]            = $node;
				}
			}
		}
		return $out;
	}

	/**
	 * Returns a reference path to the last text node before any trailing break.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes.
	 * @return array<int, int|string>|null Path of keys, or null.
	 */
	private static function last_text_path( array $nodes ): ?array {
		for ( $i = count( $nodes ) - 1; $i >= 0; $i-- ) {
			$node = $nodes[ $i ];
			if ( 'text' === $node['kind'] ) {
				return array( $i );
			}
			if ( 'element' === $node['kind'] ) {
				$inner = self::last_text_path( $node['children'] );
				if ( null !== $inner ) {
					return array_merge( array( $i, 'children' ), $inner );
				}
			}
			if ( 'break' === $node['kind'] ) {
				return null;
			}
		}
		return null;
	}

	/**
	 * Whether the last text node ends with an ellipsis.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes.
	 * @return bool
	 */
	private static function ends_with_ellipsis( array $nodes ): bool {
		$path = self::last_text_path( $nodes );
		if ( null === $path ) {
			return false;
		}
		$node = $nodes;
		foreach ( $path as $key ) {
			$node = $node[ $key ];
		}
		$value = (string) $node['value'];
		return '…' === mb_substr( $value, -1, 1, 'UTF-8' );
	}

	/**
	 * Removes trailing breaks, including those inside trailing elements.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes; updated.
	 * @return void
	 */
	private static function trim_trailing_breaks( array &$nodes ): void {
		while ( ! empty( $nodes ) ) {
			$last = count( $nodes ) - 1;
			if ( 'break' === $nodes[ $last ]['kind'] ) {
				array_pop( $nodes );
				continue;
			}
			if ( 'element' === $nodes[ $last ]['kind'] && ! in_array( $nodes[ $last ]['name'], self::VOID_ELEMENTS, true ) ) {
				self::trim_trailing_breaks( $nodes[ $last ]['children'] );
				if ( empty( $nodes[ $last ]['children'] ) ) {
					array_pop( $nodes );
					continue;
				}
			}
			break;
		}
	}

	/**
	 * Appends an ellipsis to the last text node, or as a new node.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes; updated.
	 * @return void
	 */
	private static function append_ellipsis( array &$nodes ): void {
		$path = self::last_text_path( $nodes );
		if ( null === $path ) {
			$nodes[] = self::text_node( '…' );
			return;
		}
		$node = &$nodes;
		foreach ( $path as $key ) {
			$node = &$node[ $key ];
		}
		$node['value'] .= '…';
		unset( $node );
	}

	/**
	 * Adds the hidden "opens in a new tab" text to new-tab links.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $nodes Nodes.
	 * @param string                           $label Translated label.
	 * @return array<int, array<string, mixed>>
	 */
	public static function add_screen_reader_text( array $nodes, string $label ): array {
		foreach ( $nodes as $i => $node ) {
			if ( 'element' !== $node['kind'] ) {
				continue;
			}
			$node['children'] = self::add_screen_reader_text( $node['children'], $label );
			if ( 'a' === $node['name'] && in_array( array( 'target', '_blank' ), $node['attributes'], true ) ) {
				$node['children'][] = array(
					'kind'       => 'element',
					'name'       => 'span',
					'attributes' => array( array( 'class', self::SCREEN_READER_CLASS ) ),
					'children'   => array( self::text_node( ' ' . $label ) ),
				);
			}
			$nodes[ $i ] = $node;
		}
		return $nodes;
	}
}
