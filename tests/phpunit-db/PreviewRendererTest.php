<?php
/**
 * Preview_Renderer - instance IDs and inline CSS of server-rendered builder previews.
 *
 * Elementor renders its editor preview through Preview_Renderer over admin-ajax,
 * one widget per request.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;

class PreviewRendererTest extends WP_UnitTestCase {

	private const OPTIONS = array(
		'click_behavior' => false,
		'pagination'     => false,
	);

	private int $gallery;

	public function set_up(): void {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		Preview_Renderer::take_ajax_inline_css();

		$this->gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		Gallery_Repository::set_item_ids( $this->gallery, array( $this->image() ) );
	}

	public function tear_down(): void {
		remove_filter( 'wp_doing_ajax', '__return_true' );
		Preview_Renderer::take_ajax_inline_css();

		parent::tear_down();
	}

	/** An uploaded JPEG attachment. */
	private function image(): int {
		$file  = wp_tempnam( 'fg-preview.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-preview.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	public function test_a_placement_key_names_the_instance(): void {
		$html = Preview_Renderer::render_gallery_html( $this->gallery, self::OPTIONS, 'a1b2c3d' );

		$this->assertStringContainsString( 'id="fg-' . $this->gallery . '-pa1b2c3d"', $html );
	}

	public function test_two_placements_of_one_gallery_get_different_ids(): void {
		$first  = Preview_Renderer::render_gallery_html( $this->gallery, self::OPTIONS, 'a1b2c3d' );
		$second = Preview_Renderer::render_gallery_html( $this->gallery, self::OPTIONS, 'e4f5a6b' );

		$this->assertStringContainsString( 'id="fg-' . $this->gallery . '-pa1b2c3d"', $first );
		$this->assertStringContainsString( 'id="fg-' . $this->gallery . '-pe4f5a6b"', $second );
	}

	public function test_without_a_key_the_counter_names_the_instance(): void {
		$html = Preview_Renderer::render_gallery_html( $this->gallery, self::OPTIONS );

		$this->assertMatchesRegularExpression( '/id="fg-' . $this->gallery . '-\\d+"/', $html );
	}

	public function test_an_ajax_render_holds_its_inline_css_for_the_widget(): void {
		add_filter( 'wp_doing_ajax', '__return_true' );

		Preview_Renderer::render_gallery_html( $this->gallery, self::OPTIONS, 'a1b2c3d' );
		$css = Preview_Renderer::take_ajax_inline_css();

		$this->assertStringContainsString( '#fg-' . $this->gallery . '-pa1b2c3d', $css );
		$this->assertSame( '', Preview_Renderer::take_ajax_inline_css() );
	}

	public function test_a_page_render_holds_no_inline_css(): void {
		Preview_Renderer::render_gallery_html( $this->gallery, self::OPTIONS, 'a1b2c3d' );

		$this->assertSame( '', Preview_Renderer::take_ajax_inline_css() );
	}
}
