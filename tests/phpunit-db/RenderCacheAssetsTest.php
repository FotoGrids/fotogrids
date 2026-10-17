<?php
/**
 * Assets stored with a render cache entry.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Instance_Id_Factory;

class RenderCacheAssetsTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( 0 );
	}

	private function image(): int {
		$file  = wp_tempnam( 'fg-cache-assets.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-cache-assets.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	private function gallery( array $meta = array() ): int {
		$gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		Gallery_Repository::set_item_ids( $gallery, array( $this->image() ) );
		foreach ( $meta as $key => $value ) {
			update_post_meta( $gallery, 'fotogrids_' . $key, $value );
		}

		return $gallery;
	}

	/**
	 * Renders the galleries as one page view.
	 *
	 * @return array{styles: array<string>, hits: int}
	 */
	private function view( int ...$galleries ): array {
		$resolver = Asset_Resolver::instance();
		foreach ( array( 'css_queue', 'js_queue', 'enqueued_css_handles', 'enqueued_js_handles' ) as $property ) {
			$reflection = new ReflectionProperty( $resolver, $property );
			$reflection->setAccessible( true );
			$reflection->setValue( $resolver, array() );
		}
		Instance_Id_Factory::reset_for_tests();
		$GLOBALS['wp_styles'] = new WP_Styles();
		$hits                 = did_action( Actions_Cache::HIT );

		ob_start();
		foreach ( $galleries as $gallery ) {
			do_shortcode( '[fotogrids_gallery id="' . $gallery . '"]' );
		}
		ob_end_clean();

		return array(
			'styles' => wp_styles()->queue,
			'hits'   => did_action( Actions_Cache::HIT ) - $hits,
		);
	}

	public function test_a_cache_entry_holds_only_the_assets_of_its_own_render(): void {
		$masonry = $this->gallery( array( 'layout' => 'masonry' ) );
		$plain   = $this->gallery();
		$cached  = $this->gallery( array( 'enable_cache' => '1' ) );

		$this->assertContains( 'fotogrids-layout-masonry', $this->view( $masonry, $cached )['styles'] );

		$hit = $this->view( $plain, $cached );

		$this->assertSame( 1, $hit['hits'] );
		$this->assertContains( 'fotogrids-layout-grid', $hit['styles'] );
		$this->assertNotContains( 'fotogrids-layout-masonry', $hit['styles'] );
	}
}
