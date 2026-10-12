<?php
/**
 * Instance IDs of galleries served from the render cache.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Render\Internal\Instance_Id_Factory;

class RenderCacheInstanceIdTest extends WP_UnitTestCase {

	private int $gallery;

	public function set_up(): void {
		parent::set_up();

		$this->gallery = $this->cached_gallery();

		wp_set_current_user( 0 );
	}

	/** A published gallery with one item and the render cache on. */
	private function cached_gallery(): int {
		$gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		update_post_meta( $gallery, 'fotogrids_enable_cache', '1' );
		Gallery_Repository::set_item_ids( $gallery, array( $this->image() ) );

		return $gallery;
	}

	/** An uploaded JPEG attachment. */
	private function image(): int {
		$file  = wp_tempnam( 'fg-instance.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-instance.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	private function embed( int $gallery, string $atts = '' ): string {
		return '[fotogrids_gallery id="' . $gallery . '"' . $atts . ']';
	}

	/**
	 * Renders content as one logged-out page view.
	 *
	 * @return array{ids: array<string>, css: string, hits: int}
	 */
	private function view( string $content ): array {
		Instance_Id_Factory::reset_for_tests();
		$GLOBALS['wp_styles'] = new WP_Styles();

		$hits = did_action( Actions_Cache::HIT );
		$html = do_shortcode( $content );

		preg_match_all( '/<div id="(fg-\d+-\d+)"/', $html, $match );

		$css = '';
		foreach ( wp_styles()->registered as $handle => $style ) {
			if ( 0 === strpos( $handle, 'fotogrids-inline-' ) ) {
				$css .= implode( '', (array) ( $style->extra['after'] ?? array() ) );
			}
		}

		return array(
			'ids'  => $match[1],
			'css'  => $css,
			'hits' => did_action( Actions_Cache::HIT ) - $hits,
		);
	}

	public function test_the_same_gallery_twice_gets_two_ids_on_a_miss_and_on_a_hit(): void {
		$page     = $this->embed( $this->gallery ) . $this->embed( $this->gallery );
		$expected = array( "fg-{$this->gallery}-1", "fg-{$this->gallery}-2" );

		$this->assertSame( $expected, $this->view( $page )['ids'] );

		$hit = $this->view( $page );
		$this->assertSame( $expected, $hit['ids'] );
		$this->assertSame( 2, $hit['hits'] );
	}

	public function test_each_copy_served_from_the_cache_brings_styles_for_its_own_id(): void {
		$page = $this->embed( $this->gallery ) . $this->embed( $this->gallery );
		$this->view( $page );

		$css = $this->view( $page )['css'];

		$this->assertStringContainsString( "#fg-{$this->gallery}-1", $css );
		$this->assertStringContainsString( "#fg-{$this->gallery}-2", $css );
	}

	public function test_embeds_cached_on_separate_pages_keep_two_ids_on_one_page(): void {
		$this->view( $this->embed( $this->gallery, ' cols="2"' ) );
		$this->view( $this->embed( $this->gallery, ' cols="3"' ) );

		$together = $this->view( $this->embed( $this->gallery, ' cols="2"' ) . $this->embed( $this->gallery, ' cols="3"' ) );

		$this->assertSame( array( "fg-{$this->gallery}-1", "fg-{$this->gallery}-2" ), $together['ids'] );
	}

	public function test_a_cache_hit_counts_towards_the_next_instance_id(): void {
		$other = $this->cached_gallery();
		$this->view( $this->embed( $this->gallery ) );

		$page = $this->view( $this->embed( $this->gallery ) . $this->embed( $other ) );

		$this->assertSame( 1, $page['hits'] );
		$this->assertSame( array( "fg-{$this->gallery}-1", "fg-{$other}-2" ), $page['ids'] );
	}
}
