<?php
/**
 * Unit tests for Catalog_Partial_Expander.
 *
 * WP-independent: the expander only guards on WPINC and uses trailingslashit
 * (stubbed in bootstrap) plus FOTOGRIDS_PLUGIN_DIR (defined in bootstrap to
 * point at the real src/, so these tests exercise the shipped _partials JSON).
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Catalog\Catalog_Partial_Expander;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/catalog/class-catalog-partial-expander.php';

final class CatalogPartialExpanderTest extends TestCase {

	protected function setUp(): void {
		Catalog_Partial_Expander::reset_for_tests();
	}

	protected function tearDown(): void {
		Catalog_Partial_Expander::reset_for_tests();
	}

	/**
	 * Expand a single use node and return the produced settings list.
	 *
	 * @param array<string, mixed> $node Use node.
	 * @return array<int, array<string, mixed>>
	 */
	private function expand( array $node ): array {
		$file = Catalog_Partial_Expander::expand_file(
			array( 'settings' => array( $node ) )
		);
		return $file['settings'];
	}

	/**
	 * Collect every keyed field (skipping structural containers) from a tree.
	 *
	 * @param mixed $node Tree.
	 * @return array<int, string>
	 */
	private function keys( $node ): array {
		$out        = array();
		$structural = array( 'side_by_side', 'setting_group', 'setting_subtabs' );
		if ( is_array( $node ) ) {
			if ( isset( $node['key'], $node['type'] ) && ! in_array( $node['type'], $structural, true ) ) {
				$out[] = $node['key'];
			}
			foreach ( $node as $value ) {
				$out = array_merge( $out, $this->keys( $value ) );
			}
		}
		return $out;
	}

	/**
	 * Find the first node matching a key=>value pair anywhere in the tree.
	 *
	 * @param mixed  $node  Tree.
	 * @param string $field Field name to match.
	 * @param mixed  $value Value to match.
	 * @return array<string, mixed>|null
	 */
	private function find( $node, string $field, $value ): ?array {
		if ( is_array( $node ) ) {
			if ( ( $node[ $field ] ?? null ) === $value ) {
				return $node;
			}
			foreach ( $node as $child ) {
				$found = $this->find( $child, $field, $value );
				if ( null !== $found ) {
					return $found;
				}
			}
		}
		return null;
	}

	public function test_font_expands_to_sbs_plus_size(): void {
		$out = $this->expand(
			array(
				'use'        => 'typography',
				'key_prefix' => 'demo_',
				'label'      => 'Demo',
			)
		);

		// First node is the side_by_side of family/weight/style.
		$this->assertSame( 'side_by_side', $out[0]['type'] );
		$this->assertSame(
			array( 'demo_font_family', 'demo_font_weight', 'demo_font_style' ),
			array_map( static fn( $f ) => $f['key'], $out[0]['settings'] )
		);

		// Second node is font_size as a sibling.
		$this->assertSame( 'demo_font_size', $out[1]['key'] );
		$this->assertSame( 'responsive_range', $out[1]['type'] );
	}

	public function test_label_template_substitution(): void {
		$with    = $this->expand(
			array(
				'use'        => 'typography',
				'key_prefix' => 'a_',
				'label'      => 'Title',
			)
		);
		$without = $this->expand(
			array(
				'use'        => 'typography',
				'key_prefix' => 'b_',
			)
		);

		$family_with    = $this->find( $with, 'key', 'a_font_family' );
		$family_without = $this->find( $without, 'key', 'b_font_family' );

		$this->assertSame( 'Title Font Family', $family_with['label'] );
		$this->assertSame( 'Font Family', $family_without['label'] );
	}

	public function test_include_restricts_fields_in_partial_order(): void {
		$out  = $this->expand(
			array(
				'use'        => 'typography',
				'key_prefix' => 'c_',
				'include'    => array( 'font_style', 'font_family' ),
			)
		);
		$keys = $this->keys( $out );

		// Only the included fields, in the partial's declared order (family before style).
		$this->assertSame( array( 'c_font_family', 'c_font_style' ), $keys );
	}

	public function test_exclude_drops_fields(): void {
		$keys = $this->keys(
			$this->expand(
				array(
					'use'        => 'typography',
					'key_prefix' => 'd_',
					'exclude'    => array( 'font_size' ),
				)
			)
		);

		$this->assertNotContains( 'd_font_size', $keys );
		$this->assertContains( 'd_font_family', $keys );
	}

	public function test_default_is_recorded_and_stripped_for_cluster_partials(): void {
		$out    = $this->expand(
			array(
				'use'        => 'typography',
				'key_prefix' => 'e_',
			)
		);
		$family = $this->find( $out, 'key', 'e_font_family' );

		// typography partial does not opt into inline_defaults, so `default` is stripped.
		$this->assertArrayNotHasKey( 'default', $family );
		// ...but recorded into the cluster defaults map.
		$this->assertSame( 'default', Catalog_Partial_Expander::cluster_defaults()['e_font_family'] );
	}

	public function test_button_state_inline_defaults_kept(): void {
		$out = $this->expand(
			array(
				'use'        => 'button-state',
				'key_prefix' => 'btn_',
			)
		);
		$bg  = $this->find( $out, 'key', 'btn_bg' );

		// button-state opts into inline_defaults, so `default` survives in output.
		$this->assertArrayHasKey( 'default', $bg );
		$this->assertSame( '', $bg['default'] );
	}

	public function test_button_styling_composes_font_and_states(): void {
		$out  = $this->expand(
			array(
				'use'        => 'button-styling',
				'key_prefix' => 'b_',
				'exclude'    => array( 'box_shadow' ),
				'states'     => array( 'regular', 'hover', 'active' ),
			)
		);
		$keys = $this->keys( $out );

		// Composed typography (recursive use:typography expansion).
		$this->assertContains( 'b_font_family', $keys );
		// State subtabs produced per-state colour keys.
		$this->assertContains( 'b_bg', $keys );
		$this->assertContains( 'b_hover_bg', $keys );
		$this->assertContains( 'b_active_bg', $keys );

		$subtabs = $this->find( $out, 'type', 'setting_subtabs' );
		$this->assertSame(
			array( 'regular', 'hover', 'active' ),
			array_keys( $subtabs['subTabs'] )
		);
	}

	public function test_state_meta_merge_overrides_icon_and_adds_state(): void {
		$out     = $this->expand(
			array(
				'use'        => 'button-styling',
				'key_prefix' => 's_',
				'exclude'    => array( 'box_shadow', 'typography' ),
				'states'     => array( 'regular', 'hover', 'open' ),
				'state_meta' => array(
					'regular' => array( 'icon' => 'caret_square_down' ),
					'open'    => array(
						'infix' => 'open_',
						'label' => 'Open',
						'icon'  => 'caret_square_up',
					),
				),
			)
		);
		$subtabs = $this->find( $out, 'type', 'setting_subtabs' );

		$this->assertSame( 'caret_square_down', $subtabs['subTabs']['regular']['icon'] );
		$this->assertSame( 'Open', $subtabs['subTabs']['open']['label'] );
		$this->assertSame( 'caret_square_up', $subtabs['subTabs']['open']['icon'] );
		// The new "open" state produced infixed keys.
		$this->assertContains( 's_open_bg', $this->keys( $out ) );
	}

	public function test_key_map_remaps_emitted_suffix(): void {
		$out  = $this->expand(
			array(
				'use'        => 'button-state',
				'key_prefix' => 'm_',
				'key_map'    => array( 'color' => 'text' ),
			)
		);
		$keys = $this->keys( $out );

		// color field id is emitted as m_text, not m_color.
		$this->assertContains( 'm_text', $keys );
		$this->assertNotContains( 'm_color', $keys );
	}

	public function test_single_active_group_field_keeps_condition(): void {
		// Regression: collapsing a wrapped group to one field must not drop the
		// use node's condition (it would otherwise have lived on the group).
		$out = $this->expand(
			array(
				'use'        => 'typography',
				'key_prefix' => 'g_',
				'include'    => array( 'font_family' ),
				'condition'  => array(
					'dependsOn' => 'toggle',
					'values'    => array( true ),
				),
			)
		);

		$this->assertCount( 1, $out );
		$this->assertArrayHasKey( 'condition', $out[0] );
		$this->assertSame( 'toggle', $out[0]['condition']['dependsOn'] );
	}

	public function test_include_and_exclude_together_is_ignored(): void {
		// Both lists present is a misconfiguration; expander ignores both and
		// emits the full set rather than guessing.
		$keys = $this->keys(
			$this->expand(
				array(
					'use'        => 'typography',
					'key_prefix' => 'h_',
					'include'    => array( 'font_family' ),
					'exclude'    => array( 'font_family' ),
				)
			)
		);

		$this->assertContains( 'h_font_family', $keys );
		$this->assertContains( 'h_font_size', $keys );
	}

	public function test_nav_colors_arrows_include_all_three_colours_per_state(): void {
		$out  = $this->expand(
			array(
				'use'          => 'nav-colors',
				'key_prefix'   => 'layout_arrow_',
				'states_label' => 'Arrow Colors',
				'colors'       => array( 'bg', 'border_color', 'arrow_color' ),
			)
		);
		$keys = $this->keys( $out );

		$this->assertContains( 'layout_arrow_bg', $keys );
		$this->assertContains( 'layout_arrow_border_color', $keys );
		$this->assertContains( 'layout_arrow_arrow_color', $keys );
		$this->assertContains( 'layout_arrow_hover_arrow_color', $keys );
		$this->assertContains( 'layout_arrow_active_arrow_color', $keys );
		$this->assertContains( 'layout_arrow_focus_arrow_color', $keys );

		$subtabs = $this->find( $out, 'type', 'setting_subtabs' );
		$this->assertSame(
			array( 'regular', 'hover', 'active', 'focus' ),
			array_keys( $subtabs['subTabs'] )
		);
		$this->assertSame( 'Arrow Colors', $subtabs['label'] );
	}

	public function test_nav_colors_shared_overrides_relabel_every_state(): void {
		$out = $this->expand(
			array(
				'use'          => 'nav-colors',
				'key_prefix'   => 'lightbox_toolbar_btn_',
				'states_label' => 'Button Colors',
				'colors'       => array( 'bg', 'border_color', 'arrow_color' ),
				'overrides'    => array(
					'arrow_color' => array( 'label' => 'Icon Color' ),
				),
			)
		);

		$regular = $this->find( $out, 'key', 'lightbox_toolbar_btn_arrow_color' );
		$hover   = $this->find( $out, 'key', 'lightbox_toolbar_btn_hover_arrow_color' );
		$focus   = $this->find( $out, 'key', 'lightbox_toolbar_btn_focus_arrow_color' );

		$this->assertSame( 'Icon Color', $regular['label'] );
		$this->assertSame( 'Icon Color', $hover['label'] );
		$this->assertSame( 'Icon Color', $focus['label'] );
	}

	public function test_nav_colors_thumbnail_border_only_per_state(): void {
		$keys = $this->keys(
			$this->expand(
				array(
					'use'          => 'nav-colors',
					'key_prefix'   => 'lightbox_thumbnail_',
					'states_label' => 'Thumbnail Border',
					'colors'       => array( 'border_color' ),
				)
			)
		);

		$this->assertContains( 'lightbox_thumbnail_border_color', $keys );
		$this->assertContains( 'lightbox_thumbnail_hover_border_color', $keys );
		$this->assertContains( 'lightbox_thumbnail_active_border_color', $keys );
		$this->assertContains( 'lightbox_thumbnail_focus_border_color', $keys );
		$this->assertNotContains( 'lightbox_thumbnail_bg', $keys );
		$this->assertNotContains( 'lightbox_thumbnail_arrow_color', $keys );
	}

	public function test_nav_colors_bullets_exclude_arrow_colour(): void {
		$keys = $this->keys(
			$this->expand(
				array(
					'use'          => 'nav-colors',
					'key_prefix'   => 'layout_bullet_',
					'states_label' => 'Bullet Colors',
					'colors'       => array( 'bg', 'border_color' ),
				)
			)
		);

		$this->assertContains( 'layout_bullet_bg', $keys );
		$this->assertContains( 'layout_bullet_border_color', $keys );
		$this->assertContains( 'layout_bullet_hover_bg', $keys );
		$this->assertNotContains( 'layout_bullet_arrow_color', $keys );
		$this->assertNotContains( 'layout_bullet_hover_arrow_color', $keys );
	}

	public function test_unknown_partial_yields_nothing(): void {
		$this->assertSame(
			array(),
			$this->expand(
				array(
					'use'        => 'does-not-exist',
					'key_prefix' => 'z_',
				)
			)
		);
	}

	public function test_missing_key_prefix_yields_nothing(): void {
		$this->assertSame( array(), $this->expand( array( 'use' => 'typography' ) ) );
	}
}
