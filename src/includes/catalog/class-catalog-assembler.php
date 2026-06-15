<?php
declare(strict_types=1);

namespace FotoGrids\Catalog;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Assembles Catalog files into the final settings tree consumed by the admin UI.
 *
 * Each Catalog file declares an optional `placement` block describing where its
 * contribution slots into the existing settings tree. The assembler walks every
 * Catalog file in origin-precedence order (Free → Pro → third-party in registration
 * order) and applies each file's placement to a working tree.
 *
 * Placement modes (the `placement.mode` field):
 *
 *  - `insert_tab`        Adds a new top-level tab. Positioned via `before` / `after`
 *                        / `at_start` / `at_end` (default). Use when a feature is
 *                        large enough to warrant its own tab in the sidebar.
 *
 *  - `insert_subtab`     Adds a new subtab inside an existing tab. Required:
 *                        `parent_tab`. Position via `before` / `after` / `at_start`
 *                        / `at_end` (default) referring to sibling subtab IDs. Use
 *                        when a feature has 3+ related settings that share a heading.
 *
 *  - `insert_section`    Adds a `setting_group` block inside an existing subtab
 *                        (or directly inside a tab that has no subtabs). Required:
 *                        `parent_tab`; optional: `parent_subtab`. Position via
 *                        `before` / `after` / `at_start` / `at_end` (default)
 *                        referring to sibling setting keys. Use when a feature has
 *                        a small number of settings that live alongside existing
 *                        ones without warranting a whole subtab.
 *
 *  - `extend_options`    Appends options to an existing field's `options` array.
 *                        Required: `extend_setting` (field key), `extend_options`
 *                        (array of option records). Use to add Pro/extension
 *                        choices to a Free dropdown, button-group, or hover-grid
 *                        without owning the whole field.
 *
 *  - `replace`           Replaces an existing tab, subtab, or setting wholesale.
 *                        Required: `target_id`. Destructive - prefer `extend_options`
 *                        or `insert_*` where possible. Multiple `replace` operations
 *                        on the same target resolve last-wins with a dev-mode warning.
 *
 *  - `hide`              Hides an existing tab, subtab, or setting from the UI.
 *                        Required: `target_id`. Useful for opinionated sites that
 *                        want to remove a built-in tab. Hidden items still exist
 *                        in the catalog (so saved values continue to render).
 *
 * Conflict resolution rules:
 *
 *  1. Placements are sorted by origin-precedence: `fotogrids` (Free) →
 *     `fotogrids-pro` → third-party in their JSON-file registration order.
 *
 *  2. When two placements target the same insertion point (same `after`/`before`
 *     anchor inside the same parent), they are inserted in precedence order -
 *     the higher-precedence one wins the anchor position, the lower one follows
 *     immediately. A dev-mode warning is logged so contributors can resolve it.
 *
 *  3. When two `replace` placements target the same `target_id`, the higher-
 *     precedence one wins. A dev-mode warning is logged.
 *
 *  4. If an `after` / `before` / `parent_tab` / `parent_subtab` / `target_id`
 *     anchor doesn't exist in the tree (e.g. a Pro file references a Free
 *     section that was removed), the placement falls back to `at_end` of the
 *     nearest valid parent. A dev-mode warning is logged.
 *
 *  5. Files without any `placement` block default to `placement.mode = insert_tab`
 *     with `at_end` position. This is the legacy behavior - every Free catalog
 *     file is one top-level tab.
 *
 * Group-level conditional visibility:
 *
 * Placement may include a `visible_when` predicate. When present, the assembled
 * section/subtab/tab is only rendered when the predicate matches the current
 * settings. Predicate shape:
 *
 *     "visible_when": { "setting": "layout", "equals": "carousel" }
 *     "visible_when": { "setting": "layout", "in": ["carousel", "video_playlist"] }
 *     "visible_when": { "setting": "enable_watermark", "truthy": true }
 *
 * The predicate is preserved as `visible_when` on the produced node so the JS
 * runtime can re-evaluate it as settings change.
 *
 * Setting-level `depends_on` (for individual fields *inside* a section) is a
 * separate, finer-grained mechanism handled by the JS renderer at field-render
 * time. Use `visible_when` for whole sections, `depends_on` for individual
 * fields within a section.
 *
 * @package FotoGrids\Catalog
 * @since   1.0.0
 */
final class Catalog_Assembler {

	/**
	 * Reset state for tests.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private array $tree = array();

	/**
	 * Origin slugs in registration order, used for precedence sorting.
	 *
	 * @var array<int, string>
	 */
	private array $registered_origins = array( 'fotogrids' );

	/**
	 * Dev-mode warnings collected during assembly.
	 *
	 * @var array<int, string>
	 */
	private array $warnings = array();

	/**
	 * Assemble the final settings tree from a flat list of Catalog files.
	 *
	 * @since   1.0.0
	 * @param   array<int, array<string, mixed>> $catalog_files Raw decoded Catalog JSON files, in
	 *                                                          discovery order. Each file may include
	 *                                                          a top-level `origin` slug (default
	 *                                                          'fotogrids') and an optional `placement`
	 *                                                          block.
	 * @return  array{tree: array<string, array<string, mixed>>, warnings: array<int, string>}
	 */
	public function assemble( array $catalog_files ): array {
		$this->tree     = array();
		$this->warnings = array();

		$sorted_files = $this->sort_by_origin_precedence( $catalog_files );

		foreach ( $sorted_files as $catalog_file ) {
			$this->apply_file( $catalog_file );
		}

		return array(
			'tree'     => $this->tree,
			'warnings' => $this->warnings,
		);
	}

	/**
	 * Sort the catalog files by origin precedence, preserving registration order
	 * within the same origin.
	 *
	 * @since   1.0.0
	 * @param   array<int, array<string, mixed>> $catalog_files Raw catalog files.
	 * @return  array<int, array<string, mixed>>
	 */
	private function sort_by_origin_precedence( array $catalog_files ): array {
		$registration_index = array();
		foreach ( $catalog_files as $registration_position => $catalog_file ) {
			$registration_index[ $registration_position ] = $catalog_file['origin'] ?? 'fotogrids';
		}

		$indexed_files = array_values( $catalog_files );

		usort(
			$indexed_files,
			function ( array $left_file, array $right_file ) use ( $catalog_files ): int {
				$left_origin  = $left_file['origin'] ?? 'fotogrids';
				$right_origin = $right_file['origin'] ?? 'fotogrids';

				$left_origin_rank  = $this->origin_precedence_rank( $left_origin );
				$right_origin_rank = $this->origin_precedence_rank( $right_origin );

				if ( $left_origin_rank !== $right_origin_rank ) {
					return $left_origin_rank <=> $right_origin_rank;
				}

				// Same origin → preserve registration order.
				$left_position  = array_search( $left_file, $catalog_files, true );
				$right_position = array_search( $right_file, $catalog_files, true );

				return (int) $left_position <=> (int) $right_position;
			}
		);

		return $indexed_files;
	}

	/**
	 * Numeric precedence rank for an origin slug.
	 *
	 * @since   1.0.0
	 * @param   string $origin Origin slug.
	 * @return  int
	 */
	private function origin_precedence_rank( string $origin ): int {
		if ( 'fotogrids' === $origin ) {
			return 0;
		}

		if ( 'fotogrids-pro' === $origin ) {
			return 1;
		}

		return 2;
	}

	/**
	 * Apply one Catalog file's placement to the working tree.
	 *
	 * Dispatches on `placement.mode`. Files without an explicit placement
	 * default to `insert_tab` with `at_end` position - the legacy behavior.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Decoded Catalog file contents.
	 * @return  void
	 */
	private function apply_file( array $catalog_file ): void {
		$placement = $catalog_file['placement'] ?? array(
			'mode'     => 'insert_tab',
			'position' => 'at_end',
		);

		$mode = $placement['mode'] ?? 'insert_tab';

		switch ( $mode ) {
			case 'insert_tab':
				$this->apply_insert_tab( $catalog_file, $placement );
				break;

			case 'insert_subtab':
				$this->apply_insert_subtab( $catalog_file, $placement );
				break;

			case 'insert_section':
				$this->apply_insert_section( $catalog_file, $placement );
				break;

			case 'extend_options':
				$this->apply_extend_options( $catalog_file, $placement );
				break;

			case 'replace':
				$this->apply_replace( $catalog_file, $placement );
				break;

			case 'hide':
				$this->apply_hide( $placement );
				break;

			default:
				$this->warn(
					sprintf(
						'Unknown placement mode "%s" on group "%s"; ignoring.',
						$mode,
						$catalog_file['id'] ?? '(unknown)'
					)
				);
		}
	}

	/**
	 * Apply an `insert_tab` placement.
	 *
	 * Adds the catalog file as a new top-level tab. Position is controlled by
	 * the placement's `before` / `after` / `position` keys (in that priority).
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Catalog file contents.
	 * @param   array<string, mixed> $placement Placement descriptor.
	 * @return  void
	 */
	private function apply_insert_tab( array $catalog_file, array $placement ): void {
		$tab_id = $catalog_file['id'] ?? '';
		if ( '' === $tab_id ) {
			$this->warn( 'insert_tab: catalog file has no id; skipping.' );
			return;
		}

		$tab_node = $this->build_tab_node( $catalog_file, $placement );

		$this->tree = $this->insert_at_position(
			$this->tree,
			$tab_id,
			$tab_node,
			$placement
		);
	}

	/**
	 * Apply an `insert_subtab` placement.
	 *
	 * Wraps the catalog file's settings into a new subtab inside an existing tab.
	 * Required: `placement.parent_tab`. Position is relative to sibling subtabs.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Catalog file contents.
	 * @param   array<string, mixed> $placement Placement descriptor.
	 * @return  void
	 */
	private function apply_insert_subtab( array $catalog_file, array $placement ): void {
		$parent_tab_id = $placement['parent_tab'] ?? '';
		if ( '' === $parent_tab_id || ! isset( $this->tree[ $parent_tab_id ] ) ) {
			$this->warn(
				sprintf(
					'insert_subtab: parent_tab "%s" not found for group "%s"; falling back to insert_tab.',
					$parent_tab_id,
					$catalog_file['id'] ?? '(unknown)'
				)
			);
			$this->apply_insert_tab(
				$catalog_file,
				array(
					'mode'     => 'insert_tab',
					'position' => 'at_end',
				)
			);
			return;
		}

		$subtab_id = $catalog_file['id'] ?? '';
		if ( '' === $subtab_id ) {
			$this->warn( 'insert_subtab: catalog file has no id; skipping.' );
			return;
		}

		$subtab_node = array(
			'id'       => $subtab_id,
			'label'    => $catalog_file['label'] ?? $subtab_id,
			'icon'     => $catalog_file['icon'] ?? null,
			'settings' => $catalog_file['settings'] ?? array(),
			'origin'   => $catalog_file['origin'] ?? 'fotogrids',
		);

		$visible_when = $placement['visible_when'] ?? null;
		if ( null !== $visible_when ) {
			$subtab_node['visible_when'] = $visible_when;
		}

		$parent_tab                   = $this->tree[ $parent_tab_id ];
		$existing_subtabs             = is_array( $parent_tab['subTabs'] ?? null ) ? $parent_tab['subTabs'] : array();
		$existing_subtabs             = $this->insert_at_position( $existing_subtabs, $subtab_id, $subtab_node, $placement );
		$parent_tab['subTabs']        = $existing_subtabs;
		$this->tree[ $parent_tab_id ] = $parent_tab;
	}

	/**
	 * Apply an `insert_section` placement.
	 *
	 * Wraps the catalog file's settings into a `setting_group` and inserts it
	 * inside the target tab/subtab's `settings` array. Position is relative
	 * to sibling setting keys.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Catalog file contents.
	 * @param   array<string, mixed> $placement Placement descriptor.
	 * @return  void
	 */
	private function apply_insert_section( array $catalog_file, array $placement ): void {
		$parent_tab_id    = $placement['parent_tab'] ?? '';
		$parent_subtab_id = $placement['parent_subtab'] ?? null;

		if ( '' === $parent_tab_id || ! isset( $this->tree[ $parent_tab_id ] ) ) {
			$this->warn(
				sprintf(
					'insert_section: parent_tab "%s" not found for group "%s"; falling back to insert_tab.',
					$parent_tab_id,
					$catalog_file['id'] ?? '(unknown)'
				)
			);
			$this->apply_insert_tab(
				$catalog_file,
				array(
					'mode'     => 'insert_tab',
					'position' => 'at_end',
				)
			);
			return;
		}

		$section_id = $catalog_file['id'] ?? '';
		if ( '' === $section_id ) {
			$this->warn( 'insert_section: catalog file has no id; skipping.' );
			return;
		}

		$section_node = array(
			'type'     => 'setting_group',
			'key'      => $section_id,
			'label'    => $catalog_file['label'] ?? '',
			'settings' => $catalog_file['settings'] ?? array(),
			'origin'   => $catalog_file['origin'] ?? 'fotogrids',
		);

		$visible_when = $placement['visible_when'] ?? null;
		if ( null !== $visible_when ) {
			$section_node['visible_when'] = $visible_when;
		}

		$parent_tab = $this->tree[ $parent_tab_id ];

		if ( null !== $parent_subtab_id ) {
			$subtabs = is_array( $parent_tab['subTabs'] ?? null ) ? $parent_tab['subTabs'] : array();
			if ( ! isset( $subtabs[ $parent_subtab_id ] ) ) {
				$this->warn(
					sprintf(
						'insert_section: parent_subtab "%s" not found in tab "%s" for group "%s"; falling back to tab end.',
						$parent_subtab_id,
						$parent_tab_id,
						$section_id
					)
				);
				$parent_subtab_id = null;
			}
		}

		if ( null !== $parent_subtab_id ) {
			$subtab                                     = $parent_tab['subTabs'][ $parent_subtab_id ];
			$existing_settings                          = is_array( $subtab['settings'] ?? null ) ? $subtab['settings'] : array();
			$subtab['settings']                         = $this->insert_setting_at_position(
				$existing_settings,
				$section_node,
				$placement
			);
			$parent_tab['subTabs'][ $parent_subtab_id ] = $subtab;
		} else {
			$existing_settings      = is_array( $parent_tab['settings'] ?? null ) ? $parent_tab['settings'] : array();
			$parent_tab['settings'] = $this->insert_setting_at_position(
				$existing_settings,
				$section_node,
				$placement
			);
		}

		$this->tree[ $parent_tab_id ] = $parent_tab;
	}

	/**
	 * Apply an `extend_options` placement.
	 *
	 * Appends the placement's `extend_options` array to an existing field's
	 * options. Used to add Pro choices to a Free dropdown/button-group without
	 * owning the field. Walks the entire tree to find the target field.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Catalog file contents.
	 * @param   array<string, mixed> $placement Placement descriptor.
	 * @return  void
	 */
	private function apply_extend_options( array $catalog_file, array $placement ): void {
		$target_setting_key = $placement['extend_setting'] ?? '';
		$extra_options      = $placement['extend_options'] ?? array();

		if ( '' === $target_setting_key || ! is_array( $extra_options ) || empty( $extra_options ) ) {
			$this->warn(
				sprintf(
					'extend_options: missing extend_setting or extend_options on group "%s".',
					$catalog_file['id'] ?? '(unknown)'
				)
			);
			return;
		}

		$target_found = false;
		self::array_walk_recursive_subtree(
			$this->tree,
			function ( array &$node ) use ( $target_setting_key, $extra_options, &$target_found ): void {
				if ( ( $node['key'] ?? null ) !== $target_setting_key ) {
					return;
				}

				$existing_options = is_array( $node['options'] ?? null ) ? $node['options'] : array();
				foreach ( $extra_options as $extra_option ) {
					if ( ! is_array( $extra_option ) ) {
						continue;
					}
					$existing_options[] = $extra_option;
				}
				$node['options'] = $existing_options;
				$target_found    = true;
			}
		);

		if ( ! $target_found ) {
			$this->warn(
				sprintf(
					'extend_options: target setting "%s" not found in tree (from group "%s").',
					$target_setting_key,
					$catalog_file['id'] ?? '(unknown)'
				)
			);
		}
	}

	/**
	 * Apply a `replace` placement.
	 *
	 * Replaces an existing tab, subtab, or setting by id. Destructive operation -
	 * the warning log captures multiple replacements on the same target.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Catalog file contents.
	 * @param   array<string, mixed> $placement Placement descriptor.
	 * @return  void
	 */
	private function apply_replace( array $catalog_file, array $placement ): void {
		$target_id = $placement['target_id'] ?? '';
		if ( '' === $target_id ) {
			$this->warn(
				sprintf(
					'replace: missing target_id on group "%s".',
					$catalog_file['id'] ?? '(unknown)'
				)
			);
			return;
		}

		// Try top-level tab first.
		if ( isset( $this->tree[ $target_id ] ) ) {
			$this->tree[ $target_id ] = $this->build_tab_node( $catalog_file, $placement );
			return;
		}

		// Try subtabs and settings inside tabs.
		$replaced = false;
		foreach ( $this->tree as $tab_id => $tab_node ) {
			if ( isset( $tab_node['subTabs'][ $target_id ] ) ) {
				$this->tree[ $tab_id ]['subTabs'][ $target_id ] = array(
					'id'       => $target_id,
					'label'    => $catalog_file['label'] ?? $target_id,
					'icon'     => $catalog_file['icon'] ?? null,
					'settings' => $catalog_file['settings'] ?? array(),
					'origin'   => $catalog_file['origin'] ?? 'fotogrids',
				);
				$replaced                                       = true;
				break;
			}

			$settings = $tab_node['settings'] ?? array();
			foreach ( $settings as $setting_index => $setting_node ) {
				if ( ( $setting_node['key'] ?? null ) === $target_id ) {
					$this->tree[ $tab_id ]['settings'][ $setting_index ] = array(
						'type'     => 'setting_group',
						'key'      => $target_id,
						'label'    => $catalog_file['label'] ?? '',
						'settings' => $catalog_file['settings'] ?? array(),
						'origin'   => $catalog_file['origin'] ?? 'fotogrids',
					);
					$replaced = true;
					break 2;
				}
			}
		}

		if ( ! $replaced ) {
			$this->warn(
				sprintf(
					'replace: target_id "%s" not found in tree (from group "%s").',
					$target_id,
					$catalog_file['id'] ?? '(unknown)'
				)
			);
		}
	}

	/**
	 * Apply a `hide` placement.
	 *
	 * Marks a tab, subtab, or setting as hidden by setting `hidden = true` on
	 * the node. The JS renderer skips hidden nodes. We don't remove the node so
	 * that saved values continue to render correctly.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $placement Placement descriptor.
	 * @return  void
	 */
	private function apply_hide( array $placement ): void {
		$target_id = $placement['target_id'] ?? '';
		if ( '' === $target_id ) {
			$this->warn( 'hide: missing target_id.' );
			return;
		}

		if ( isset( $this->tree[ $target_id ] ) ) {
			$this->tree[ $target_id ]['hidden'] = true;
			return;
		}

		foreach ( $this->tree as $tab_id => $tab_node ) {
			if ( isset( $tab_node['subTabs'][ $target_id ] ) ) {
				$this->tree[ $tab_id ]['subTabs'][ $target_id ]['hidden'] = true;
				return;
			}

			$settings = $tab_node['settings'] ?? array();
			foreach ( $settings as $setting_index => $setting_node ) {
				if ( ( $setting_node['key'] ?? null ) === $target_id ) {
					$this->tree[ $tab_id ]['settings'][ $setting_index ]['hidden'] = true;
					return;
				}
			}
		}

		$this->warn( sprintf( 'hide: target_id "%s" not found.', $target_id ) );
	}

	/**
	 * Build a tab-shaped node from a catalog file.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $catalog_file Catalog file contents.
	 * @param   array<string, mixed> $placement Placement descriptor.
	 * @return  array<string, mixed>
	 */
	private function build_tab_node( array $catalog_file, array $placement ): array {
		$tab_node = $catalog_file;

		// Drop the placement block from the rendered tree - it's metadata.
		unset( $tab_node['placement'] );

		$visible_when = $placement['visible_when'] ?? null;
		if ( null !== $visible_when ) {
			$tab_node['visible_when'] = $visible_when;
		}

		return $tab_node;
	}

	/**
	 * Insert a tab/subtab node into an ordered associative array at the position
	 * dictated by the placement's `before` / `after` / `position` keys.
	 *
	 * @since   1.0.0
	 * @param   array<string, array<string, mixed>> $existing Existing ordered map.
	 * @param   string                              $new_key New entry key.
	 * @param   array<string, mixed>                $new_node New entry value.
	 * @param   array<string, mixed>                $placement Placement descriptor.
	 * @return  array<string, array<string, mixed>>
	 */
	private function insert_at_position( array $existing, string $new_key, array $new_node, array $placement ): array {
		$anchor_after  = $placement['after'] ?? null;
		$anchor_before = $placement['before'] ?? null;
		$position      = $placement['position'] ?? 'at_end';

		$existing_keys = array_keys( $existing );

		if ( is_string( $anchor_after ) && '' !== $anchor_after ) {
			$anchor_index = array_search( $anchor_after, $existing_keys, true );
			if ( false === $anchor_index ) {
				$this->warn(
					sprintf(
						'placement.after "%s" not found; falling back to at_end for "%s".',
						$anchor_after,
						$new_key
					)
				);
			} else {
				return $this->splice_associative( $existing, (int) $anchor_index + 1, $new_key, $new_node );
			}
		}

		if ( is_string( $anchor_before ) && '' !== $anchor_before ) {
			$anchor_index = array_search( $anchor_before, $existing_keys, true );
			if ( false === $anchor_index ) {
				$this->warn(
					sprintf(
						'placement.before "%s" not found; falling back to at_end for "%s".',
						$anchor_before,
						$new_key
					)
				);
			} else {
				return $this->splice_associative( $existing, (int) $anchor_index, $new_key, $new_node );
			}
		}

		if ( 'at_start' === $position ) {
			return $this->splice_associative( $existing, 0, $new_key, $new_node );
		}

		// at_end (default).
		$existing[ $new_key ] = $new_node;
		return $existing;
	}

	/**
	 * Insert a setting node into a numeric-indexed array of settings at the
	 * position dictated by the placement's `before` / `after` / `position` keys.
	 * Anchors are matched against sibling `key` fields.
	 *
	 * @since   1.0.0
	 * @param   array<int, array<string, mixed>> $existing_settings Existing settings.
	 * @param   array<string, mixed>             $new_setting New setting node.
	 * @param   array<string, mixed>             $placement Placement descriptor.
	 * @return  array<int, array<string, mixed>>
	 */
	private function insert_setting_at_position( array $existing_settings, array $new_setting, array $placement ): array {
		$anchor_after  = $placement['after'] ?? null;
		$anchor_before = $placement['before'] ?? null;
		$position      = $placement['position'] ?? 'at_end';

		if ( is_string( $anchor_after ) && '' !== $anchor_after ) {
			foreach ( $existing_settings as $sibling_index => $sibling_setting ) {
				if ( ( $sibling_setting['key'] ?? null ) === $anchor_after ) {
					array_splice( $existing_settings, $sibling_index + 1, 0, array( $new_setting ) );
					return $existing_settings;
				}
			}
			$this->warn(
				sprintf(
					'placement.after "%s" (setting key) not found; falling back to at_end for "%s".',
					$anchor_after,
					$new_setting['key'] ?? '(unknown)'
				)
			);
		}

		if ( is_string( $anchor_before ) && '' !== $anchor_before ) {
			foreach ( $existing_settings as $sibling_index => $sibling_setting ) {
				if ( ( $sibling_setting['key'] ?? null ) === $anchor_before ) {
					array_splice( $existing_settings, $sibling_index, 0, array( $new_setting ) );
					return $existing_settings;
				}
			}
			$this->warn(
				sprintf(
					'placement.before "%s" (setting key) not found; falling back to at_end for "%s".',
					$anchor_before,
					$new_setting['key'] ?? '(unknown)'
				)
			);
		}

		if ( 'at_start' === $position ) {
			array_unshift( $existing_settings, $new_setting );
			return $existing_settings;
		}

		$existing_settings[] = $new_setting;
		return $existing_settings;
	}

	/**
	 * Splice an entry into an associative array at a specific index.
	 *
	 * @since   1.0.0
	 * @param   array<string, array<string, mixed>> $existing Existing ordered map.
	 * @param   int                                 $index Zero-based insertion index.
	 * @param   string                              $new_key New entry key.
	 * @param   array<string, mixed>                $new_node New entry value.
	 * @return  array<string, array<string, mixed>>
	 */
	private function splice_associative( array $existing, int $index, string $new_key, array $new_node ): array {
		$before = array_slice( $existing, 0, $index, true );
		$after  = array_slice( $existing, $index, null, true );
		return $before + array( $new_key => $new_node ) + $after;
	}

	/**
	 * Emit a dev-mode warning to the warnings array and (optionally) the error log.
	 *
	 * @since   1.0.0
	 * @param   string $message Warning message.
	 * @return  void
	 */
	private function warn( string $message ): void {
		$this->warnings[] = $message;

		\FotoGrids\Debug_Log::write( 'catalog_assembler', $message );
	}

	/**
	 * Recursively walk every associative-array node in a nested tree, applying
	 * a callback that may mutate the node. Used by `extend_options` to find
	 * a target field anywhere in the assembled tree without coupling the
	 * assembler to the tree shape.
	 *
	 * @since   1.0.0
	 * @param   array<int|string, mixed>                     $tree  Nested tree.
	 * @param   callable(array<string, mixed> &$node): void  $visit Visitor callback.
	 * @return  void
	 */
	private static function array_walk_recursive_subtree( array &$tree, callable $visit ): void {
		foreach ( $tree as &$child ) {
			if ( ! is_array( $child ) ) {
				continue;
			}

			// Only invoke on associative-array nodes (those with string keys).
			$first_key = array_key_first( $child );
			if ( is_string( $first_key ) ) {
				$visit( $child );
			}

			self::array_walk_recursive_subtree( $child, $visit );
		}
		unset( $child );
	}
}
