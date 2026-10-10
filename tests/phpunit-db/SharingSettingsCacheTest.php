<?php
/**
 * Saving the site-wide sharing settings and the render cache.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Settings\Sharing_Settings_Store;

class SharingSettingsCacheTest extends WP_UnitTestCase {

	private int $gallery;

	public function set_up(): void {
		parent::set_up();

		Sharing_Settings_Store::save( array( 'enable_social_sharing' => true ) );

		$this->gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		update_post_meta( $this->gallery, 'fotogrids_enable_cache', '1' );
		Gallery_Repository::set_item_ids( $this->gallery, array( $this->image() ) );

		wp_set_current_user( 0 );
	}

	/** An uploaded JPEG attachment. */
	private function image(): int {
		$file  = wp_tempnam( 'fg-sharing.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-sharing.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	/**
	 * The sharing config a logged-out render carries, empty when it has none.
	 *
	 * @return array<string, mixed>
	 */
	private function rendered_sharing(): array {
		$html = do_shortcode( '[fotogrids_gallery id="' . $this->gallery . '"]' );

		$this->assertStringContainsString( 'fotogrids-gallery', $html );

		if ( ! preg_match( '/data-fg-sharing="([^"]*)"/', $html, $match ) ) {
			return array();
		}

		return json_decode( html_entity_decode( $match[1], ENT_QUOTES ), true );
	}

	/** A cached render, confirmed by a cache hit. */
	private function cache_gallery(): void {
		$this->assertTrue( $this->rendered_sharing()['enabled'] );
		$hits = did_action( Actions_Cache::HIT );
		$this->rendered_sharing();
		$this->assertSame( $hits + 1, did_action( Actions_Cache::HIT ) );
	}

	public function test_turning_sharing_off_reaches_a_cached_gallery(): void {
		$this->cache_gallery();

		Sharing_Settings_Store::save( array( 'enable_social_sharing' => false ) );

		$this->assertEmpty( $this->rendered_sharing()['enabled'] ?? false );
	}

	public function test_changing_networks_and_placements_reaches_a_cached_gallery(): void {
		$this->cache_gallery();

		Sharing_Settings_Store::save(
			array(
				'enable_social_sharing' => true,
				'networks'              => array( 'linkedin' => true ),
				'placements'            => array( 'thumbnail' ),
				'button_size'           => 'large',
			)
		);

		$sharing = $this->rendered_sharing();
		$this->assertTrue( $sharing['networks']['linkedin'] );
		$this->assertSame( array( 'thumbnail' ), $sharing['placements'] );
		$this->assertSame( 'large', $sharing['button_size'] );
	}

	public function test_saving_unchanged_settings_keeps_the_cache(): void {
		$this->cache_gallery();

		$hits = did_action( Actions_Cache::HIT );
		Sharing_Settings_Store::save( array( 'enable_social_sharing' => true ) );
		$this->rendered_sharing();

		$this->assertSame( $hits + 1, did_action( Actions_Cache::HIT ) );
	}
}
