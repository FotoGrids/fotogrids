<?php
/**
 * Unit tests for the shapes the image-filter type setting arrives in.
 *
 * WP-independent: the decorator reads only the render context.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Decorators\Image_Filters\Image_Filters;
use PHPUnit\Framework\TestCase;

$fotogrids_render_api = dirname( __DIR__, 2 ) . '/src/public/render/';
require_once $fotogrids_render_api . 'api/class-collection-kind.php';
require_once $fotogrids_render_api . 'api/class-columns-mode.php';
require_once $fotogrids_render_api . 'api/class-render-mode.php';
require_once $fotogrids_render_api . 'api/class-request-source.php';
require_once $fotogrids_render_api . 'api/class-render-meta.php';
require_once $fotogrids_render_api . 'api/class-render-layout.php';
require_once $fotogrids_render_api . 'api/class-render-behavior.php';
require_once $fotogrids_render_api . 'api/class-item-view.php';
require_once $fotogrids_render_api . 'api/class-render-context.php';
require_once $fotogrids_render_api . 'api/class-asset-decl.php';
require_once $fotogrids_render_api . 'api/class-module-assets.php';
require_once $fotogrids_render_api . 'api/class-responsive-var.php';
require_once $fotogrids_render_api . 'api/trait-setting-helpers.php';
require_once $fotogrids_render_api . 'api/interface-decorator.php';
require_once $fotogrids_render_api . 'decorators/image-filters/class-image-filters.php';

final class ImageFilterTypeShapesTest extends TestCase {

	/**
	 * Wrapper attributes and style variables for a thumbnail filter setting.
	 *
	 * @param mixed $types Stored thumbnail_filter_type value.
	 * @return array{0: array<string, string>, 1: array<string, mixed>}
	 */
	private function render( $types ): array {
		$context = new Render_Context(
			new Render_Meta(
				7,
				null,
				'fg-instance-7',
				Request_Source::SHORTCODE,
				false,
				Render_Mode::INITIAL,
				2,
				Collection_Kind::GALLERY
			),
			new Render_Layout( 'grid', Columns_Mode::FIXED, array( 'desktop' => 3 ), array( 'desktop' => 10 ), array() ),
			new Render_Behavior( 'lightbox', 'show_all', 'load_more', null, 'full' ),
			array(
				'thumbnail_filter_enabled'          => true,
				'thumbnail_filter_type'             => $types,
				'thumbnail_filter_amount_grayscale' => array( 'desktop' => 40, 'tablet' => 40, 'mobile' => 40 ),
				'thumbnail_filter_amount_blur'      => array( 'desktop' => 2, 'tablet' => 2, 'mobile' => 2 ),
			),
			array()
		);

		$decorator = new Image_Filters();

		return array( $decorator->wrapper_data_attrs( $context ), $decorator->style_vars( $context ) );
	}

	/** DEC-06: the array the settings UI saves. */
	public function test_an_array_of_types_is_applied_in_order(): void {
		list( $attrs, $vars ) = $this->render( array( 'blur', 'grayscale' ) );

		$this->assertSame( 'blur grayscale', $attrs['data-fg-filter'] );
		$this->assertSame( 'blur(2px) grayscale(40%)', $vars['--fg-thumb-filter-regular']->desktop );
	}

	/** DEC-06: the same list JSON-encoded, as it can come back from meta. */
	public function test_a_json_encoded_list_is_applied_like_the_array(): void {
		list( $attrs, $vars ) = $this->render( '["grayscale","blur"]' );

		$this->assertSame( 'grayscale blur', $attrs['data-fg-filter'] );
		$this->assertSame( 'grayscale(40%) blur(2px)', $vars['--fg-thumb-filter-regular']->desktop );
	}

	/** DEC-06: unknown entries are dropped, the known ones kept. */
	public function test_unknown_types_are_dropped(): void {
		list( $attrs, $vars ) = $this->render( array( 'grayscale', 'url(evil)', 7 ) );

		$this->assertSame( 'grayscale', $attrs['data-fg-filter'] );
		$this->assertSame( 'grayscale(40%)', $vars['--fg-thumb-filter-regular']->desktop );
	}
}
