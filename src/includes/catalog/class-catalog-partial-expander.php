<?php
declare(strict_types=1);

namespace FotoGrids\Catalog;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Expands `use` nodes in catalog files into plain settings using reusable
 * partial definitions from the `_partials/` directory.
 *
 * Each partial declares a cluster of related fields (typography, button styling,
 * image filters, …) once. A catalog file references it with a `use` node plus
 * a `key_prefix` and optional overrides; the expander stamps the cluster out
 * as ordinary settings, so the assembler, the browser, and the defaults layer
 * never see partials.
 *
 * @package FotoGrids\Catalog
 * @since   1.0.0
 */
final class Catalog_Partial_Expander {

	/**
	 * Loaded partial definitions, keyed by partial id.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static array $partials = array();

	private static bool $loaded = false;

	/**
	 * Maximum depth of nested `use` expansion (a partial composing another
	 * partial). Guards against a partial that references itself.
	 *
	 * @var int
	 */
	private const MAX_EXPANSION_DEPTH = 5;

	/**
	 * Resolved cluster defaults collected during expansion, keyed by setting key.
	 *
	 * @var array<string, mixed>
	 */
	private static array $cluster_defaults = array();

	/**
	 * Expands every `use` node inside a decoded catalog file in place.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Decoded catalog file contents.
	 * @return  array<string, mixed> The file with all `use` nodes expanded.
	 */
	public static function expand_file( array $catalog_file ): array {
		self::load_partials();

		if ( isset( $catalog_file['settings'] ) && is_array( $catalog_file['settings'] ) ) {
			$catalog_file['settings'] = self::expand_settings( $catalog_file['settings'], 0 );
		}

		return $catalog_file;
	}

	/**
	 * Returns the cluster defaults collected so far across all expanded files.
	 *
	 * @since   1.0.0
	 * @return  array<string, mixed>
	 */
	public static function cluster_defaults(): array {
		return self::$cluster_defaults;
	}

	/**
	 * Resets internal state. Test-only.
	 *
	 * @since   1.0.0
	 * @return  void
	 */
	public static function reset_for_tests(): void {
		self::$partials         = array();
		self::$cluster_defaults = array();
		self::$loaded           = false;
	}

	/**
	 * Walks a settings array, expanding `use` nodes and recursing into nested
	 * `settings` / `subTabs` containers.
	 *
	 * @since   1.0.0
	 * @param   array<int, mixed> $settings Settings list.
	 * @param   int               $depth    Current nested-expansion depth.
	 * @return  array<int, mixed>
	 */
	private static function expand_settings( array $settings, int $depth ): array {
		$expanded = array();

		foreach ( $settings as $setting ) {
			if ( ! is_array( $setting ) ) {
				$expanded[] = $setting;
				continue;
			}

			if ( isset( $setting['use'] ) && is_string( $setting['use'] ) ) {
				$produced = self::expand_use_node( $setting );

				// A partial may itself emit `use` nodes (e.g. button_styling
				// composing use:font) or nested containers; expand those too.
				if ( $depth < self::MAX_EXPANSION_DEPTH ) {
					$produced = self::expand_settings( $produced, $depth + 1 );
				}

				foreach ( $produced as $produced_setting ) {
					$expanded[] = $produced_setting;
				}
				continue;
			}

			if ( isset( $setting['settings'] ) && is_array( $setting['settings'] ) ) {
				$setting['settings'] = self::expand_settings( $setting['settings'], $depth );
			}

			if ( isset( $setting['subTabs'] ) && is_array( $setting['subTabs'] ) ) {
				$setting['subTabs'] = self::expand_subtabs( $setting['subTabs'], $depth );
			}

			$expanded[] = $setting;
		}

		return $expanded;
	}

	/**
	 * Expands `use` nodes inside a subTabs map.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $sub_tabs SubTabs map.
	 * @param   int                  $depth    Current nested-expansion depth.
	 * @return  array<string, mixed>
	 */
	private static function expand_subtabs( array $sub_tabs, int $depth ): array {
		foreach ( $sub_tabs as $sub_tab_id => $sub_tab ) {
			if ( is_array( $sub_tab ) && isset( $sub_tab['settings'] ) && is_array( $sub_tab['settings'] ) ) {
				$sub_tab['settings']     = self::expand_settings( $sub_tab['settings'], $depth );
				$sub_tabs[ $sub_tab_id ] = $sub_tab;
			}
		}

		return $sub_tabs;
	}

	/**
	 * Expands a single `use` node into one or more settings, following the
	 * partial's `layout`.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $node A `use` node.
	 * @return  array<int, array<string, mixed>>
	 */
	private static function expand_use_node( array $node ): array {
		$partial_id = (string) $node['use'];
		$partial    = self::$partials[ $partial_id ] ?? null;

		if ( null === $partial ) {
			self::warn( sprintf( 'Unknown partial "%s"; skipping use node.', $partial_id ) );
			return array();
		}

		$key_prefix = isset( $node['key_prefix'] ) ? (string) $node['key_prefix'] : '';
		if ( '' === $key_prefix ) {
			self::warn( sprintf( 'Partial "%s" used without key_prefix; skipping.', $partial_id ) );
			return array();
		}

		$include = isset( $node['include'] ) && is_array( $node['include'] ) ? $node['include'] : null;
		$exclude = isset( $node['exclude'] ) && is_array( $node['exclude'] ) ? $node['exclude'] : null;

		if ( null !== $include && null !== $exclude ) {
			self::warn(
				sprintf( 'Partial "%s" use node has both include and exclude; ignoring both.', $partial_id )
			);
			$include = null;
			$exclude = null;
		}

		$active = self::active_field_ids( $partial, $include, $exclude );

		return self::render_layout( $partial, $node, $key_prefix, $active );
	}

	/**
	 * Determines which field ids are active for a use node, preserving the
	 * partial's declared field order.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed>    $partial     Partial definition.
	 * @param   array<int, mixed>|null  $include_ids Allowed field ids, or null.
	 * @param   array<int, mixed>|null  $exclude_ids Excluded field ids, or null.
	 * @return  array<int, string>
	 */
	private static function active_field_ids( array $partial, ?array $include_ids, ?array $exclude_ids ): array {
		$all = array_keys( is_array( $partial['fields'] ?? null ) ? $partial['fields'] : array() );

		if ( null !== $include_ids ) {
			$wanted = array_map( 'strval', $include_ids );
			return array_values( array_filter( $all, static fn( string $id ): bool => in_array( $id, $wanted, true ) ) );
		}

		if ( null !== $exclude_ids ) {
			$unwanted = array_map( 'strval', $exclude_ids );
			return array_values( array_filter( $all, static fn( string $id ): bool => ! in_array( $id, $unwanted, true ) ) );
		}

		return $all;
	}

	/**
	 * Renders a partial's layout into settings, honoring the active field set.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $partial    Partial definition.
	 * @param   array<string, mixed> $node       The use node.
	 * @param   string               $key_prefix Key prefix.
	 * @param   array<int, string>   $active     Active field ids.
	 * @return  array<int, array<string, mixed>>
	 */
	private static function render_layout( array $partial, array $node, string $key_prefix, array $active ): array {
		$layout = is_array( $partial['layout'] ?? null ) ? $partial['layout'] : array_keys( $partial['fields'] ?? array() );
		$out    = array();

		foreach ( $layout as $entry ) {
			if ( is_string( $entry ) ) {
				if ( ! in_array( $entry, $active, true ) ) {
					continue;
				}
				$field = self::build_field( $partial, $node, $key_prefix, $entry, true );
				if ( null !== $field ) {
					$out[] = $field;
				}
				continue;
			}

			if ( is_array( $entry ) && isset( $entry['wrap'] ) ) {
				$group = self::build_group( $partial, $node, $key_prefix, $entry, $active );
				if ( null !== $group ) {
					$out[] = $group;
				}
				continue;
			}

			if ( is_array( $entry ) && isset( $entry['use_partial'] ) ) {
				if ( ! self::layout_entry_included( (string) $entry['use_partial'], $node ) ) {
					continue;
				}
				$out[] = self::build_composed_use( $entry, $node, $key_prefix );
				continue;
			}

			if ( is_array( $entry ) && isset( $entry['state_subtabs'] ) && is_array( $entry['state_subtabs'] ) ) {
				if ( ! self::layout_entry_included( 'states', $node ) ) {
					continue;
				}
				$subtabs_node = self::build_state_subtabs( $node, $key_prefix, $entry['state_subtabs'] );
				if ( null !== $subtabs_node ) {
					$out[] = $subtabs_node;
				}
			}
		}

		return $out;
	}

	/**
	 * Decides whether an optional layout entry (font / states / a singular field)
	 * is emitted, honoring the use node's `include` / `exclude` lists. With
	 * neither list, everything is included.
	 *
	 * @since   1.0.0
	 * @param   string               $entry_id Layout entry identifier.
	 * @param   array<string, mixed> $node     The use node.
	 * @return  bool
	 */
	private static function layout_entry_included( string $entry_id, array $node ): bool {
		$include = isset( $node['include'] ) && is_array( $node['include'] ) ? array_map( 'strval', $node['include'] ) : null;
		$exclude = isset( $node['exclude'] ) && is_array( $node['exclude'] ) ? array_map( 'strval', $node['exclude'] ) : null;

		if ( null !== $include && null !== $exclude ) {
			return true;
		}
		if ( null !== $include ) {
			return in_array( $entry_id, $include, true );
		}
		if ( null !== $exclude ) {
			return ! in_array( $entry_id, $exclude, true );
		}
		return true;
	}

	/**
	 * Builds a nested `use` node for a composed partial (e.g. button_styling
	 * composing font), inheriting the outer key prefix and forwarding the
	 * outer node's `params`, `label`, and any per-composition overrides.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $entry      The `use_partial` layout entry.
	 * @param   array<string, mixed> $node       The outer use node.
	 * @param   string               $key_prefix Key prefix.
	 * @return  array<string, mixed>
	 */
	private static function build_composed_use( array $entry, array $node, string $key_prefix ): array {
		$child = array(
			'use'        => (string) $entry['use_partial'],
			'key_prefix' => $key_prefix,
		);

		if ( isset( $node['params'] ) && is_array( $node['params'] ) ) {
			$child['params'] = $node['params'];
		}
		if ( isset( $node['label'] ) ) {
			$child['label'] = $node['label'];
		}

		$composed_key = (string) ( $entry['use_partial'] );
		if ( isset( $node['composed'][ $composed_key ] ) && is_array( $node['composed'][ $composed_key ] ) ) {
			$child = array_replace( $child, $node['composed'][ $composed_key ] );
		}

		return $child;
	}

	/**
	 * Builds a `setting_subtabs` node with one subtab per active state, each
	 * holding a `use` of the state sub-partial with a state-infixed key prefix.
	 *
	 * Which states render is driven by the use node's `states` list (defaulting
	 * to the spec's `states`). Each state's key infix, label, and icon come from
	 * the spec's `state_meta`. The emitted nested `use` nodes are expanded by the
	 * caller's recursive pass.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $node       The use node.
	 * @param   string               $key_prefix Key prefix.
	 * @param   array<string, mixed> $spec       The `state_subtabs` layout spec.
	 * @return  array<string, mixed>|null
	 */
	private static function build_state_subtabs( array $node, string $key_prefix, array $spec ): ?array {
		$state_meta = is_array( $spec['state_meta'] ?? null ) ? $spec['state_meta'] : array();

		// The use node may override an existing state's meta (e.g. a custom icon)
		// or define a new state the partial doesn't carry (e.g. dropdown "open").
		// Merge per state so partial defaults survive for keys the node omits.
		if ( isset( $node['state_meta'] ) && is_array( $node['state_meta'] ) ) {
			foreach ( $node['state_meta'] as $state_id => $override ) {
				if ( ! is_array( $override ) ) {
					continue;
				}
				$existing                = is_array( $state_meta[ $state_id ] ?? null ) ? $state_meta[ $state_id ] : array();
				$state_meta[ $state_id ] = array_replace( $existing, $override );
			}
		}

		$default_list = is_array( $spec['states'] ?? null ) ? $spec['states'] : array_keys( $state_meta );
		$states       = is_array( $node['states'] ?? null ) ? $node['states'] : $default_list;

		$sub_partial = (string) ( $spec['use'] ?? '' );
		$subtabs_key = $key_prefix . (string) ( $spec['key_suffix'] ?? 'state_subtabs' );

		$sub_tabs = array();
		foreach ( $states as $state ) {
			$state = (string) $state;
			$meta  = is_array( $state_meta[ $state ] ?? null ) ? $state_meta[ $state ] : null;
			if ( null === $meta ) {
				self::warn( sprintf( 'button states: no state_meta for "%s"; skipping.', $state ) );
				continue;
			}

			$infix     = (string) ( $meta['infix'] ?? '' );
			$child_use = array(
				'use'        => $sub_partial,
				'key_prefix' => $key_prefix . $infix,
			);

			$shared_overrides = is_array( $node['overrides'] ?? null ) ? $node['overrides'] : array();
			$state_overrides  = is_array( $node['state_overrides'][ $state ] ?? null ) ? $node['state_overrides'][ $state ] : array();
			$merged_overrides = self::merge_field_overrides( $shared_overrides, $state_overrides );
			if ( count( $merged_overrides ) > 0 ) {
				$child_use['overrides'] = $merged_overrides;
			}
			if ( isset( $node['colors'] ) && is_array( $node['colors'] ) ) {
				$child_use['include'] = $node['colors'];
			}
			if ( isset( $node['key_map'] ) && is_array( $node['key_map'] ) ) {
				$child_use['key_map'] = $node['key_map'];
			}

			$sub_tab = array(
				'id'    => $state,
				'label' => (string) ( $meta['label'] ?? $state ),
				'icon'  => (string) ( $meta['icon'] ?? '' ),
			);

			$state_condition = $node['state_conditions'][ $state ] ?? null;
			if ( is_array( $state_condition ) ) {
				$sub_tab['condition'] = $state_condition;
			}

			$sub_tab['settings'] = array( $child_use );
			$sub_tabs[ $state ]  = $sub_tab;
		}

		if ( count( $sub_tabs ) === 0 ) {
			return null;
		}

		$subtabs_node = array(
			'key'  => $subtabs_key,
			'type' => 'setting_subtabs',
		);

		if ( isset( $node['states_label'] ) ) {
			$subtabs_node['label'] = (string) $node['states_label'];
		} elseif ( isset( $spec['label'] ) ) {
			$subtabs_node['label'] = (string) $spec['label'];
		}

		$node_attrs = is_array( $spec['node_attrs'] ?? null ) ? $spec['node_attrs'] : array();
		foreach ( $node_attrs as $attr_key => $attr_value ) {
			$subtabs_node[ $attr_key ] = $attr_value;
		}

		$subtabs_node['subTabs'] = $sub_tabs;

		if ( isset( $node['condition'] ) && is_array( $node['condition'] ) ) {
			$subtabs_node['condition'] = $node['condition'];
		}

		return $subtabs_node;
	}

	/**
	 * Merges two field-override maps (field id => attribute overrides), with the
	 * second map's per-field attributes winning over the first.
	 *
	 * Used to combine a state-subtabs wrapper's shared `overrides` (applied to
	 * every state) with a per-state `state_overrides` entry.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $base    Shared overrides applied to all states.
	 * @param   array<string, mixed> $per_state Per-state overrides (win on conflict).
	 * @return  array<string, mixed>
	 */
	private static function merge_field_overrides( array $base, array $per_state ): array {
		$merged = $base;
		foreach ( $per_state as $field_id => $attrs ) {
			if ( is_array( $attrs ) && is_array( $merged[ $field_id ] ?? null ) ) {
				$merged[ $field_id ] = array_replace( $merged[ $field_id ], $attrs );
			} else {
				$merged[ $field_id ] = $attrs;
			}
		}
		return $merged;
	}

	/**
	 * Builds a wrapped group (side_by_side / setting_group) from a layout entry.
	 *
	 * Returns null when no child fields are active. When only one child is
	 * active the group wrapper is dropped and the lone field is returned.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $partial    Partial definition.
	 * @param   array<string, mixed> $node       The use node.
	 * @param   string               $key_prefix Key prefix.
	 * @param   array<string, mixed> $entry      Layout group entry.
	 * @param   array<int, string>   $active     Active field ids.
	 * @return  array<string, mixed>|null
	 */
	private static function build_group( array $partial, array $node, string $key_prefix, array $entry, array $active ): ?array {
		$wrap   = (string) $entry['wrap'];
		$fields = is_array( $entry['fields'] ?? null ) ? $entry['fields'] : array();

		$children = array();
		foreach ( $fields as $field_id ) {
			$field_id = (string) $field_id;
			if ( ! in_array( $field_id, $active, true ) ) {
				continue;
			}
			$field = self::build_field( $partial, $node, $key_prefix, $field_id, false );
			if ( null !== $field ) {
				$children[] = $field;
			}
		}

		if ( count( $children ) === 0 ) {
			return null;
		}

		// A group may carry its own condition from the layout entry (e.g. a
		// "Custom Ratio" group shown only when the ratio is custom). The use
		// node's condition still applies to every group.
		$entry_condition = is_array( $entry['condition'] ?? null )
			? self::substitute_params(
				$entry['condition'],
				array_merge(
					is_array( $node['params'] ?? null ) ? $node['params'] : array(),
					array( 'key_prefix' => $key_prefix )
				)
			)
			: null;
		$group_condition = $node['condition'] ?? $entry_condition;
		if ( isset( $node['condition'], $entry_condition ) ) {
			$group_condition = array( 'all' => array( $node['condition'], $entry_condition ) );
		}

		// When only one child is active the wrapper is dropped; the lone field
		// then stands at top level, so it must carry the group's condition
		// (which would otherwise have lived on the group).
		if ( count( $children ) === 1 ) {
			$only = $children[0];
			if ( is_array( $group_condition ) && ! isset( $only['condition'] ) ) {
				$only['condition'] = $group_condition;
			}
			return $only;
		}

		$group = array(
			'type'     => $wrap,
			'settings' => $children,
		);

		if ( isset( $entry['label'] ) ) {
			$group['label'] = (string) $entry['label'];
		}

		if ( is_array( $group_condition ) ) {
			$group['condition'] = $group_condition;
		}

		return $group;
	}

	/**
	 * Builds one expanded field from a partial field template plus the use node.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $partial      Partial definition.
	 * @param   array<string, mixed> $node         The use node.
	 * @param   string               $key_prefix   Key prefix.
	 * @param   string               $field_id     Field id within the partial.
	 * @param   bool                 $is_top_level Whether the field renders as a
	 *                                             top-level sibling (vs inside a
	 *                                             group that already carries the
	 *                                             use node's condition).
	 * @return  array<string, mixed>|null
	 */
	private static function build_field( array $partial, array $node, string $key_prefix, string $field_id, bool $is_top_level ): ?array {
		$template = $partial['fields'][ $field_id ] ?? null;
		if ( ! is_array( $template ) ) {
			self::warn( sprintf( 'Partial "%s" has no field "%s".', (string) $node['use'], $field_id ) );
			return null;
		}

		$overrides = array();
		if ( isset( $node['overrides'][ $field_id ] ) && is_array( $node['overrides'][ $field_id ] ) ) {
			$overrides = $node['overrides'][ $field_id ];
		}

		$field_defaults = is_array( $partial['field_defaults'] ?? null ) ? $partial['field_defaults'] : array();
		$field          = array_replace( $field_defaults, $template, $overrides );

		$key_suffix = $field_id;
		if ( isset( $node['key_map'][ $field_id ] ) && is_string( $node['key_map'][ $field_id ] ) ) {
			$key_suffix = $node['key_map'][ $field_id ];
		}

		$field['key']   = $key_prefix . $key_suffix;
		$field['label'] = self::resolve_label( $field, $node );

		self::record_default( $field['key'], $field );

		unset( $field['label_template'], $field['label_template_empty'] );

		// By default the cluster `default` is recorded into the defaults layer and
		// stripped from the emitted field (the saved value is owned by
		// Collection_Defaults). Partials whose original fields carried an inline
		// `default` opt in to keeping it via `inline_defaults`.
		if ( empty( $partial['inline_defaults'] ) ) {
			unset( $field['default'] );
		}

		if ( $is_top_level && isset( $node['condition'] ) && is_array( $node['condition'] ) && ! isset( $field['condition'] ) ) {
			$field['condition'] = $node['condition'];
		}

		$params               = is_array( $node['params'] ?? null ) ? $node['params'] : array();
		$params['key_prefix'] = $key_prefix;
		$field                = self::substitute_params( $field, $params );

		return $field;
	}

	/**
	 * Resolves a field's label from its templates and the use node's `label`.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $field Merged field (template + overrides).
	 * @param   array<string, mixed> $node  The use node.
	 * @return  string
	 */
	private static function resolve_label( array $field, array $node ): string {
		if ( isset( $field['label'] ) && is_string( $field['label'] ) ) {
			return $field['label'];
		}

		$label_param = isset( $node['label'] ) ? (string) $node['label'] : '';

		if ( '' === $label_param ) {
			if ( isset( $field['label_template_empty'] ) ) {
				return (string) $field['label_template_empty'];
			}
			if ( isset( $field['label_template'] ) ) {
				return trim( str_replace( '{{label}}', '', (string) $field['label_template'] ) );
			}
			return '';
		}

		if ( isset( $field['label_template'] ) ) {
			return str_replace( '{{label}}', $label_param, (string) $field['label_template'] );
		}

		return $label_param;
	}

	/**
	 * Recursively replaces `{{param}}` tokens in string values of a structure
	 * using the use node's `params` map.
	 *
	 * @since   1.0.0
	 * @param   mixed                 $value  Structure to walk (array or scalar).
	 * @param   array<string, mixed>  $params Token map.
	 * @return  mixed
	 */
	private static function substitute_params( $value, array $params ) {
		if ( is_string( $value ) ) {
			foreach ( $params as $token => $replacement ) {
				$value = str_replace( '{{' . $token . '}}', (string) $replacement, $value );
			}
			return $value;
		}

		if ( is_array( $value ) ) {
			$out = array();
			foreach ( $value as $key => $item ) {
				$out[ $key ] = self::substitute_params( $item, $params );
			}
			return $out;
		}

		return $value;
	}

	/**
	 * Records the resolved cluster fallback default for an expanded key.
	 *
	 * The supplied field is already merged in precedence order
	 * (field_defaults, then template, then per-instance overrides), so the
	 * `default` it carries is the authoritative cluster fallback.
	 * `Collection_Defaults` is applied later as the final layer.
	 *
	 * @since   1.0.0
	 * @param   string               $key   Expanded setting key.
	 * @param   array<string, mixed> $field Merged field definition.
	 * @return  void
	 */
	private static function record_default( string $key, array $field ): void {
		if ( array_key_exists( 'default', $field ) ) {
			self::$cluster_defaults[ $key ] = $field['default'];
		}
	}

	/**
	 * Loads partial definitions from the `_partials/` directory once.
	 *
	 * @since   1.0.0
	 * @return  void
	 */
	private static function load_partials(): void {
		if ( self::$loaded ) {
			return;
		}

		$dir = trailingslashit( FOTOGRIDS_PLUGIN_DIR . 'assets/admin/plain/collection-settings/_partials' );

		foreach ( (array) glob( $dir . '*.json' ) as $path ) {
			if ( ! is_string( $path ) ) {
				continue;
			}

			$raw = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled local plugin file (not a remote URL); WP_Filesystem is unnecessary here.
			if ( false === $raw ) {
				continue;
			}

			$decoded = json_decode( $raw, true );
			if ( ! is_array( $decoded ) || ! isset( $decoded['partial'] ) ) {
				continue;
			}

			self::$partials[ (string) $decoded['partial'] ] = $decoded;
		}

		self::$loaded = true;
	}

	/**
	 * Logs a development warning when WP_DEBUG is on.
	 *
	 * @since   1.0.0
	 * @param   string $message Message.
	 * @return  void
	 */
	private static function warn( string $message ): void {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Gated on WP_DEBUG; dev-only catalog diagnostics.
			error_log( 'FotoGrids partial expander: ' . $message );
		}
	}
}
