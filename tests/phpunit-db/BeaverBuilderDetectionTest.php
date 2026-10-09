<?php
/**
 * Beaver Builder layout detection - which layouts report FotoGrids content for the page-level asset check.
 *
 * Layout nodes mirror the `_fl_builder_data` shape: `type` is the node kind and
 * a module's slug sits at `settings->type`.
 *
 * @package FotoGrids
 */

use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Module;

class BeaverBuilderDetectionTest extends WP_UnitTestCase {

	/**
	 * A layout node.
	 *
	 * @param string              $node_type Node kind: row, column-group, column or module.
	 * @param array<string,mixed> $settings  Node settings.
	 */
	private static function node( string $node_type, array $settings = array() ): stdClass {
		return (object) array(
			'node'     => uniqid( 'n', false ),
			'type'     => $node_type,
			'settings' => (object) $settings,
		);
	}

	/**
	 * A row holding one module with the given settings.
	 *
	 * @param array<string,mixed> $module_settings Module settings.
	 * @return array<string,stdClass>
	 */
	private static function layout_with_module( array $module_settings ): array {
		$row    = self::node( 'row' );
		$column = self::node( 'column' );
		$module = self::node( 'module', $module_settings );

		return array(
			$row->node    => $row,
			$column->node => $column,
			$module->node => $module,
		);
	}

	public function test_a_gallery_module_is_detected(): void {
		$layout = self::layout_with_module(
			array(
				'type'       => 'fotogrids-gallery',
				'gallery_id' => '553',
			)
		);

		$this->assertTrue( Module::layout_has_fotogrids_content( $layout ) );
	}

	public function test_an_album_module_is_detected(): void {
		$layout = self::layout_with_module(
			array(
				'type'     => 'fotogrids-album',
				'album_id' => '12',
			)
		);

		$this->assertTrue( Module::layout_has_fotogrids_content( $layout ) );
	}

	public function test_a_shortcode_in_another_module_is_detected(): void {
		$layout = self::layout_with_module(
			array(
				'type' => 'rich-text',
				'text' => '<p>[fotogrids_gallery id="553"]</p>',
			)
		);

		$this->assertTrue( Module::layout_has_fotogrids_content( $layout ) );
	}

	public function test_a_layout_without_fotogrids_is_not_detected(): void {
		$layout = self::layout_with_module(
			array(
				'type' => 'rich-text',
				'text' => '<p>A FotoGrids gallery would go here.</p>',
			)
		);

		$this->assertFalse( Module::layout_has_fotogrids_content( $layout ) );
	}

	public function test_a_module_whose_slug_only_starts_with_ours_is_not_detected(): void {
		$layout = self::layout_with_module( array( 'type' => 'fotogrids-gallery-slider' ) );

		$this->assertFalse( Module::layout_has_fotogrids_content( $layout ) );
	}

	public function test_an_empty_layout_is_not_detected(): void {
		$this->assertFalse( Module::layout_has_fotogrids_content( array() ) );
	}

	public function test_inserted_layouts_are_found_by_id(): void {
		$this->assertSame( array( 45 ), Module::inserted_layout_ids( '<p>[fl_builder_insert_layout id="45"]</p>' ) );
		$this->assertSame( array( 45, 46 ), Module::inserted_layout_ids( '[fl_builder_insert_layout id="45,46"][fl_builder_insert_layout id="45"]' ) );
	}

	public function test_inserted_layouts_are_found_by_slug(): void {
		$layout_id = self::factory()->post->create(
			array(
				'post_type' => 'page',
				'post_name' => 'fg-saved-layout',
			)
		);

		$this->assertSame( array( $layout_id ), Module::inserted_layout_ids( '[fl_builder_insert_layout slug="fg-saved-layout" type="page"]' ) );
		$this->assertSame( array( $layout_id ), Module::inserted_layout_ids( '[fl_builder_insert_layout slug="fg-saved-layout"]' ) );
		$this->assertSame( array(), Module::inserted_layout_ids( '[fl_builder_insert_layout slug="fg-saved-layout" type="post"]' ) );
	}

	public function test_escaped_and_missing_insert_shortcodes_find_nothing(): void {
		$this->assertSame( array(), Module::inserted_layout_ids( '[[fl_builder_insert_layout id="45"]]' ) );
		$this->assertSame( array(), Module::inserted_layout_ids( '[fl_builder_insert_layout]' ) );
		$this->assertSame( array(), Module::inserted_layout_ids( '<p>No layout here.</p>' ) );
	}
}
