<?php
/**
 * Inline_Asset_Emitter - the inline CSS of renders made during an AJAX request.
 *
 * Page builders that re-render layout parts over AJAX insert the markup into an
 * already-loaded page, so the per-render CSS is held for them to ship.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Public_Render;
use FotoGrids\Render\Internal\Inline_Asset_Emitter;

class InlineAssetEmitterAjaxTest extends WP_UnitTestCase {

	private int $gallery;

	public function set_up(): void {
		parent::set_up();

		Inline_Asset_Emitter::take_ajax_inline_css();

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
		Inline_Asset_Emitter::take_ajax_inline_css();

		parent::tear_down();
	}

	/** An uploaded JPEG attachment. */
	private function image(): int {
		$file  = wp_tempnam( 'fg-emitter.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-emitter.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	public function test_an_ajax_shortcode_render_holds_its_inline_css(): void {
		add_filter( 'wp_doing_ajax', '__return_true' );

		$html = Public_Render::gallery_shortcode( array( 'id' => $this->gallery ) );
		$css  = Inline_Asset_Emitter::take_ajax_inline_css();

		$this->assertMatchesRegularExpression( '/id="(fg-' . $this->gallery . '-\\d+)"/', $html );
		preg_match( '/id="(fg-' . $this->gallery . '-\\d+)"/', $html, $match );
		$this->assertStringContainsString( '#' . $match[1], $css );
		$this->assertSame( '', Inline_Asset_Emitter::take_ajax_inline_css() );
	}

	public function test_a_page_render_holds_no_inline_css(): void {
		Public_Render::gallery_shortcode( array( 'id' => $this->gallery ) );

		$this->assertSame( '', Inline_Asset_Emitter::take_ajax_inline_css() );
	}
}
