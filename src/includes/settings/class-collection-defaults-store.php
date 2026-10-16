<?php
/**
 * Site-wide defaults for new galleries and albums.
 *
 * @package FotoGrids\Settings
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Migrations\Collection_Defaults_Split;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Collection_Defaults_Store
 *
 * Reads and writes the values saved on Settings > Defaults. Galleries and
 * albums each have their own map, held together in one option:
 * `array( 'gallery' => array( key => value ), 'album' => array( key => value ) )`.
 *
 * @package FotoGrids\Settings
 * @since   1.3.0
 */
final class Collection_Defaults_Store {

	const OPTION = 'fotogrids_collection_defaults';

	/**
	 * The collection types that have defaults.
	 *
	 * @var string[]
	 */
	const TYPES = array( 'gallery', 'album' );

	/**
	 * Register the deprecated option name.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function init(): void {
		Legacy_Defaults_Option::register();
	}

	/**
	 * The collection type for a type name or post type.
	 *
	 * @since  1.3.0
	 * @param  string $type `gallery`, `album`, `fotogrids_gallery` or `fotogrids_album`.
	 * @return string|null `gallery` or `album`, or null for anything else.
	 */
	public static function type( string $type ): ?string {
		return \FotoGrids\Post_Types::kind_of( $type );
	}

	/**
	 * Every type's saved defaults.
	 *
	 * Moves defaults saved by an earlier version into this option first, when
	 * this option does not exist yet.
	 *
	 * @since  1.3.0
	 * @return array<string, array<string, mixed>> Type => saved defaults.
	 */
	public static function all(): array {
		$stored = get_option( self::OPTION, null );

		if ( null === $stored ) {
			Collection_Defaults_Split::run();
			$stored = get_option( self::OPTION, array() );
		}

		$all = array();
		foreach ( self::TYPES as $type ) {
			$all[ $type ] = is_array( $stored ) && isset( $stored[ $type ] ) && is_array( $stored[ $type ] )
				? $stored[ $type ]
				: array();
		}

		return $all;
	}

	/**
	 * One type's saved defaults.
	 *
	 * @since  1.3.0
	 * @param  string $type Collection type or post type.
	 * @return array<string, mixed> Empty for an unknown type.
	 */
	public static function get( string $type ): array {
		$type = self::type( $type );

		return null === $type ? array() : self::all()[ $type ];
	}

	/**
	 * Whether any type has a saved default.
	 *
	 * @since  1.3.0
	 * @return bool
	 */
	public static function has_any(): bool {
		return array() !== array_filter( self::all() );
	}

	/**
	 * Replace one type's saved defaults.
	 *
	 * @since  1.3.0
	 * @param  string               $type   Collection type or post type.
	 * @param  array<string, mixed> $values Sanitised defaults.
	 * @return bool True when the option holds the new values.
	 */
	public static function replace( string $type, array $values ): bool {
		$type = self::type( $type );

		if ( null === $type ) {
			return false;
		}

		$all          = self::all();
		$all[ $type ] = $values;

		update_option( self::OPTION, $all );

		// update_option() also answers false when nothing changed, so the
		// stored value decides whether the write took.
		return wp_json_encode( get_option( self::OPTION ) ) === wp_json_encode( $all );
	}

	/**
	 * Merge sanitised values over one type's saved defaults.
	 *
	 * @since  1.3.0
	 * @param  string               $type   Collection type or post type.
	 * @param  array<string, mixed> $values Sanitised defaults.
	 * @return array<string, mixed>|null The stored defaults, or null when they could not be saved.
	 */
	public static function merge( string $type, array $values ): ?array {
		$merged = array_merge( self::get( $type ), $values );

		return self::replace( $type, $merged ) ? $merged : null;
	}
}
