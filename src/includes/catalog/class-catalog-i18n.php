<?php
/**
 * Translation of the assembled settings catalog tree.
 *
 * @package FotoGrids\Catalog
 * @since   1.1.1
 */

declare(strict_types=1);

namespace FotoGrids\Catalog;

use FotoGrids\Hooks\Filters_Catalog;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Translates the user-facing strings of an assembled catalog tree.
 *
 * The catalog vocabulary lives in JSON, so the strings reach PHP as data and
 * have no call site a string extractor can read. catalog-strings.php restates
 * each one as a literal __() call, which both feeds the extractor and produces
 * the original-to-translated map this class applies.
 *
 * This is also where a translation file first gets to influence the settings
 * UI, and the UI renders the description and message keys as HTML, so those
 * two are filtered to ALLOWED_HTML on the way through.
 *
 * @since 1.1.1
 */
final class Catalog_I18n {

	/**
	 * Catalog keys whose values are rendered to the user.
	 */
	private const TEXT_KEYS = array(
		'description',
		'help',
		'label',
		'message',
		'note',
		'placeholder',
		'subtitle',
		'title',
	);

	/**
	 * Text keys the settings UI renders as HTML rather than as escaped text.
	 */
	private const HTML_KEYS = array( 'description', 'message' );

	/**
	 * HTML a catalog string may carry into the settings UI.
	 */
	private const ALLOWED_HTML = array(
		'a'      => array(
			'href'   => true,
			'rel'    => true,
			'target' => true,
		),
		'br'     => array(),
		'code'   => array(),
		'em'     => array(),
		'strong' => array(),
	);

	/**
	 * Resolved translation map, or null before the first lookup.
	 *
	 * @var array<string, string>|null
	 */
	private static ?array $strings = null;

	/**
	 * Returns the tree with every user-facing string translated and the
	 * HTML-rendered ones filtered.
	 *
	 * Runs before any consumer substitutes placeholders, so the strings still
	 * match the catalog literals the map is keyed by.
	 *
	 * @since   1.1.1
	 * @param   array<string, mixed> $tree Assembled catalog tree.
	 * @return  array<string, mixed>
	 */
	public static function translate_tree( array $tree ): array {
		return self::translate_node( $tree, self::strings() );
	}

	/**
	 * Clears the resolved map. Test-support only.
	 *
	 * @since   1.1.1
	 * @return  void
	 */
	public static function reset_for_tests(): void {
		self::$strings = null;
	}

	/**
	 * Loads the generated map and lets other plugins contribute their own.
	 *
	 * @return array<string, string>
	 */
	private static function strings(): array {
		if ( null !== self::$strings ) {
			return self::$strings;
		}

		$strings = require FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/catalog-strings.php';

		if ( ! is_array( $strings ) ) {
			$strings = array();
		}

		$strings = apply_filters( Filters_Catalog::STRINGS, $strings );

		self::$strings = is_array( $strings ) ? $strings : array();

		return self::$strings;
	}

	/**
	 * Replaces the text values of one node and its descendants.
	 *
	 * @param  array<string, mixed>  $node    Node to translate.
	 * @param  array<string, string> $strings Translation map.
	 * @return array<string, mixed>
	 */
	private static function translate_node( array $node, array $strings ): array {
		foreach ( $node as $key => $value ) {
			if ( is_array( $value ) ) {
				$node[ $key ] = self::translate_node( $value, $strings );
				continue;
			}

			if ( ! is_string( $value ) || ! in_array( $key, self::TEXT_KEYS, true ) ) {
				continue;
			}

			if ( isset( $strings[ $value ] ) ) {
				$value = $strings[ $value ];
			}

			$node[ $key ] = in_array( $key, self::HTML_KEYS, true )
				? wp_kses( $value, self::ALLOWED_HTML )
				: $value;
		}

		return $node;
	}
}
