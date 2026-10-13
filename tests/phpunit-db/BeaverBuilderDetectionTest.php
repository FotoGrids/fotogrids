<?php
/**
 * Beaver Builder layout detection.
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

	public function test_a_post_inserting_a_page_without_the_builder_is_detected_through_its_content(): void {
		$shortcode = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_content' => '[fotogrids_gallery id="553"]',
			)
		);
		$block     = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_content' => '<!-- wp:fotogrids/gallery {"galleryId":553} /-->',
			)
		);
		$plain     = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_content' => '<p>No gallery.</p>',
			)
		);

		$this->assertTrue( Module::detect_in_beaver_builder( false, self::inserting( $shortcode ) ) );
		$this->assertTrue( Module::detect_in_beaver_builder( false, self::inserting( $block ) ) );
		$this->assertFalse( Module::detect_in_beaver_builder( false, self::inserting( $plain ) ) );
	}

	public function test_inserts_nested_through_pages_are_followed_to_the_depth_limit(): void {
		$inner = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_content' => '[fotogrids_album id="12"]',
			)
		);
		$two   = self::inserting( $inner );
		$three = self::inserting( $two->ID );
		$four  = self::inserting( $three->ID );
		$five  = self::inserting( $four->ID );

		$this->assertTrue( Module::detect_in_beaver_builder( false, $four ) );
		$this->assertFalse( Module::detect_in_beaver_builder( false, $five ) );
	}

	public function test_inserts_that_loop_back_stop(): void {
		$first  = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$second = self::inserting( $first );
		wp_update_post(
			array(
				'ID'           => $first,
				'post_content' => '[fl_builder_insert_layout id="' . $second->ID . '"]',
			)
		);

		$this->assertFalse( Module::detect_in_beaver_builder( false, $second ) );
	}

	/**
	 * A page whose content inserts the given post.
	 *
	 * @param int $inserted_id Post to insert.
	 */
	private static function inserting( int $inserted_id ): WP_Post {
		$id = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_content' => '[fl_builder_insert_layout id="' . $inserted_id . '"]',
			)
		);

		return get_post( $id );
	}

	public function test_escaped_and_missing_insert_shortcodes_find_nothing(): void {
		$this->assertSame( array(), Module::inserted_layout_ids( '[[fl_builder_insert_layout id="45"]]' ) );
		$this->assertSame( array(), Module::inserted_layout_ids( '[fl_builder_insert_layout]' ) );
		$this->assertSame( array(), Module::inserted_layout_ids( '<p>No layout here.</p>' ) );
	}
}
