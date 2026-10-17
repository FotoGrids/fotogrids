<?php
/**
 * Formatted-text schema loader and validator.
 *
 * @package FotoGrids\Formatted_Text
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Formatted_Text;

use FotoGrids\Hooks\Filters_Formatted_Text;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Loads formatting profiles from the shared schema file and validates them.
 *
 * The same file is bundled into the browser formatter, so both sides apply
 * the same rules. Every profile is validated against the floor after the
 * schema filter runs.
 *
 * @since 1.3.0
 */
final class Schema {

	/**
	 * Profile used for captions and descriptions.
	 *
	 * @since 1.3.0
	 */
	const DEFAULT_PROFILE = 'item_text';

	/**
	 * Schema file, relative to the plugin directory.
	 *
	 * @since 1.3.0
	 */
	const FILE = 'shared/formatted-text/schema.json';

	private const NAME_PATTERN = '/^[a-z][a-z0-9-]*$/';

	private const PROTOCOL_PATTERN = '/^[a-z][a-z0-9+.-]*$/';

	private const ATTRIBUTE_TYPES = array( 'url', 'text', 'enum', 'tokens' );

	/**
	 * Decoded schema file.
	 *
	 * @var array<string, mixed>|null
	 */
	private static ?array $file = null;

	/**
	 * Effective profiles by name, for the current request.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static array $profiles = array();

	/**
	 * Returns the decoded schema file.
	 *
	 * @since 1.3.0
	 * @return array<string, mixed>
	 */
	private static function file(): array {
		if ( null === self::$file ) {
			$path       = FOTOGRIDS_PLUGIN_DIR . self::FILE;
			$content    = is_readable( $path ) ? file_get_contents( $path ) : false; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file bundled with the plugin.
			$decoded    = is_string( $content ) ? json_decode( $content, true ) : null;
			self::$file = is_array( $decoded ) ? $decoded : array(
				'profiles' => array(),
				'floor'    => array(),
			);
		}
		return self::$file;
	}

	/**
	 * Returns the floor: the parts of the schema no filter can change.
	 *
	 * @since 1.3.0
	 * @return array{elements: string[], attributePrefixes: string[], attributes: string[], urlAttributes: string[], rawText: string[], linkRel: string[]}
	 */
	public static function floor(): array {
		$floor = self::file()['floor'] ?? array();
		$out   = array();
		foreach ( array( 'elements', 'attributePrefixes', 'attributes', 'urlAttributes', 'rawText', 'linkRel' ) as $key ) {
			$out[ $key ] = is_array( $floor[ $key ] ?? null ) ? array_values( array_map( 'strval', $floor[ $key ] ) ) : array();
		}
		return $out;
	}

	/**
	 * Returns the bundled definition of a profile, before filters.
	 *
	 * @since 1.3.0
	 * @param string $profile Profile name.
	 * @return array<string, mixed>
	 */
	public static function bundled( string $profile = self::DEFAULT_PROFILE ): array {
		$profiles = self::file()['profiles'] ?? array();
		$raw      = $profiles[ $profile ] ?? ( $profiles[ self::DEFAULT_PROFILE ] ?? array() );
		return self::validate( $raw );
	}

	/**
	 * Returns the effective profile after the schema filter and validation.
	 *
	 * @since 1.3.0
	 * @param string $profile Profile name.
	 * @return array{elements: array<string, array<string, mixed>>, protocols: string[], breakBefore: string[], dropWithContent: string[]}
	 */
	public static function profile( string $profile = self::DEFAULT_PROFILE ): array {
		if ( ! isset( self::$profiles[ $profile ] ) ) {
			$profiles = self::file()['profiles'] ?? array();
			$raw      = $profiles[ $profile ] ?? ( $profiles[ self::DEFAULT_PROFILE ] ?? array() );
			$filtered = apply_filters( Filters_Formatted_Text::SCHEMA, $raw, $profile );
			$valid    = self::validate( is_array( $filtered ) ? $filtered : array() );

			$allowed            = array_map( 'strtolower', wp_allowed_protocols() );
			$valid['protocols'] = array_values( array_intersect( $valid['protocols'], $allowed ) );

			self::$profiles[ $profile ] = $valid;
		}
		return self::$profiles[ $profile ];
	}

	/**
	 * Returns the effective profile when it differs from the bundled one.
	 *
	 * The browser formatter bundles the default profile, so only a filtered
	 * profile needs to be sent to the page.
	 *
	 * @since 1.3.0
	 * @param string $profile Profile name.
	 * @return array<string, mixed>|null
	 */
	public static function profile_for_client( string $profile = self::DEFAULT_PROFILE ): ?array {
		$effective = self::profile( $profile );
		return self::bundled( $profile ) === $effective ? null : $effective;
	}

	/**
	 * Clears the per-request cache of effective profiles.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function reset(): void {
		self::$profiles = array();
	}

	/**
	 * Whether an attribute name is banned by the floor.
	 *
	 * @since 1.3.0
	 * @param string $name Lower-case attribute name.
	 * @return bool
	 */
	public static function is_floor_attribute( string $name ): bool {
		$floor = self::floor();
		if ( in_array( $name, $floor['attributes'], true ) ) {
			return true;
		}
		foreach ( $floor['attributePrefixes'] as $prefix ) {
			if ( 0 === strpos( $name, $prefix ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Validates a profile definition and applies the floor to it.
	 *
	 * @since 1.3.0
	 * @param mixed $raw Profile definition.
	 * @return array{elements: array<string, array<string, mixed>>, protocols: string[], breakBefore: string[], dropWithContent: string[]}
	 */
	public static function validate( $raw ): array {
		$input    = is_array( $raw ) ? $raw : array();
		$floor    = self::floor();
		$elements = array();

		$raw_elements = is_array( $input['elements'] ?? null ) ? $input['elements'] : array();
		foreach ( $raw_elements as $raw_name => $raw_spec ) {
			$name = strtolower( trim( (string) $raw_name ) );
			if ( ! preg_match( self::NAME_PATTERN, $name ) || in_array( $name, $floor['elements'], true ) ) {
				continue;
			}

			$attributes     = array();
			$raw_attributes = is_array( $raw_spec ) && is_array( $raw_spec['attributes'] ?? null ) ? $raw_spec['attributes'] : array();
			foreach ( $raw_attributes as $raw_attr => $raw_attr_spec ) {
				$attr = strtolower( trim( (string) $raw_attr ) );
				if ( ! preg_match( self::NAME_PATTERN, $attr ) || self::is_floor_attribute( $attr ) ) {
					continue;
				}
				$spec = self::validate_attribute( $attr, $raw_attr_spec, $floor['urlAttributes'] );
				if ( null !== $spec ) {
					$attributes[ $attr ] = $spec;
				}
			}

			$elements[ $name ] = empty( $attributes ) ? array() : array( 'attributes' => $attributes );
		}

		$protocols = array_values(
			array_diff(
				self::string_list( $input['protocols'] ?? null, self::PROTOCOL_PATTERN ),
				array( 'javascript', 'vbscript', 'data' )
			)
		);

		return array(
			'elements'        => $elements,
			'protocols'       => $protocols,
			'breakBefore'     => self::string_list( $input['breakBefore'] ?? null, self::NAME_PATTERN ),
			'dropWithContent' => self::string_list( $input['dropWithContent'] ?? null, self::NAME_PATTERN ),
		);
	}

	/**
	 * Validates one attribute definition.
	 *
	 * @since 1.3.0
	 * @param string   $name           Lower-case attribute name.
	 * @param mixed    $raw            Attribute definition.
	 * @param string[] $url_attributes Attributes always treated as URLs.
	 * @return array<string, mixed>|null
	 */
	private static function validate_attribute( string $name, $raw, array $url_attributes ): ?array {
		if ( ! is_array( $raw ) ) {
			return null;
		}
		$type = $raw['type'] ?? null;
		if ( ! is_string( $type ) || ! in_array( $type, self::ATTRIBUTE_TYPES, true ) ) {
			return null;
		}
		if ( in_array( $name, $url_attributes, true ) ) {
			$type = 'url';
		}
		if ( 'enum' === $type || 'tokens' === $type ) {
			$values = array();
			foreach ( is_array( $raw['values'] ?? null ) ? $raw['values'] : array() as $value ) {
				if ( ! is_string( $value ) || '' === trim( $value ) ) {
					continue;
				}
				$clean = strtolower( trim( $value ) );
				if ( ! in_array( $clean, $values, true ) ) {
					$values[] = $clean;
				}
			}
			if ( empty( $values ) ) {
				return null;
			}
			return array(
				'type'   => $type,
				'values' => $values,
			);
		}
		return array( 'type' => $type );
	}

	/**
	 * Normalises a list of names, keeping only those matching the pattern.
	 *
	 * @since 1.3.0
	 * @param mixed  $value   Raw list.
	 * @param string $pattern Allowed-name pattern.
	 * @return string[]
	 */
	private static function string_list( $value, string $pattern ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$out = array();
		foreach ( $value as $entry ) {
			if ( ! is_string( $entry ) ) {
				continue;
			}
			$lower = strtolower( trim( $entry ) );
			if ( preg_match( $pattern, $lower ) && ! in_array( $lower, $out, true ) ) {
				$out[] = $lower;
			}
		}
		return $out;
	}
}
