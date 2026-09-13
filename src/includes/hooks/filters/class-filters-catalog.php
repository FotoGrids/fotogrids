<?php
/**
 * Catalog source-list filter hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Catalog filter hooks.
 */
final class Filters_Catalog {

	/**
	 * List of JSON source files merged into the catalog.
	 *
	 * Pro hooks here to inject the Pro catalog.
	 *
	 * @since 1.0.0
	 * @param string[] $json_file_paths Absolute paths to JSON files.
	 */
	public const JSON_FILES = 'fotogrids/catalog/json_files';

	/**
	 * Original-to-translated map applied to the assembled catalog tree.
	 *
	 * Free contributes the map generated from its own catalog files. Pro and
	 * third-party extensions hook here to add the strings of the catalog files
	 * they contribute, translated in their own text domain.
	 *
	 * @since 1.1.1
	 * @param array<string, string> $strings Catalog string to translation.
	 */
	public const STRINGS = 'fotogrids/catalog/strings';

	/**
	 * Resolved edit-state for a catalog field/option.
	 *
	 * Free derives the state purely from the declared tier with no license
	 * check (free -> editable, higher tier -> a static teaser). Pro hooks here
	 * to apply its own per-plan license resolution and unlock the fields its
	 * license covers. Free registers no callback.
	 *
	 * @since 1.0.0
	 * @param string      $state         Resolved state ('editable' | 'teaser' | 'locked').
	 * @param string      $field_id      Catalog field id.
	 * @param string|null $option_value  Option value when resolving a per-option state.
	 * @param string      $required_tier The field/option's declared tier.
	 */
	public const FIELD_STATE = 'fotogrids/catalog/field_state';
}
