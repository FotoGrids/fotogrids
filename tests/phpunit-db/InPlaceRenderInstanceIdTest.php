<?php
/**
 * Instance IDs of galleries an album swap or a password unlock renders over REST.
 *
 * @package FotoGrids
 */

use FotoGrids\Collection_Defaults;
use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Password_Crypto;
use FotoGrids\Render\Internal\Instance_Id_Factory;
use FotoGrids\Settings\Setting_Value_Codec;

class InPlaceRenderInstanceIdTest extends WP_UnitTestCase {

	private const PASSWORD = 'open-sesame';

	private int $gallery;

	public function set_up(): void {
		parent::set_up();

		$this->gallery = $this->gallery();

		wp_set_current_user( 0 );
	}

	private function gallery(): int {
		$gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		Gallery_Repository::set_item_ids( $gallery, array( $this->image() ) );

		return $gallery;
	}

	private function image(): int {
		$file  = wp_tempnam( 'fg-in-place.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-in-place.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	private function lock( int $gallery ): void {
		$defaults = Collection_Defaults::resolve_gallery();
		$settings = array(
			'password_protect' => true,
			'password'         => Password_Crypto::encrypt( self::PASSWORD ),
		);

		foreach ( $settings as $key => $value ) {
			$type = Setting_Value_Codec::catalog_field_type( $key );
			Setting_Value_Codec::persist(
				$gallery,
				'fotogrids_' . $key,
				Setting_Value_Codec::normalize_incoming( $value, $defaults[ $key ], $type ),
				$defaults[ $key ],
				$type
			);
		}
	}

	/**
	 * Sends a REST request with a fresh instance counter.
	 *
	 * @param array<string, mixed> $body JSON body.
	 */
	private function post( string $route, array $body ): WP_REST_Response {
		Instance_Id_Factory::reset_for_tests();

		$request = new WP_REST_Request( 'POST', $route );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( (string) wp_json_encode( $body ) );

		return rest_do_request( $request );
	}

	/** ID of the first gallery wrapper (not a lock screen) in the markup. */
	private function gallery_id_in( string $html ): string {
		preg_match( '/<div id="([^"]+)" class="[^"]*\bfotogrids-gallery\b/', $html, $match );

		return $match[1] ?? '';
	}

	public function test_an_album_swap_renders_the_gallery_with_the_id_the_page_sent(): void {
		$response = $this->post(
			'/fotogrids/v1/gallery/render',
			array(
				'gallery_id'  => $this->gallery,
				'instance_id' => "fg-{$this->gallery}-2",
			)
		);
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( "fg-{$this->gallery}-2", $this->gallery_id_in( $data['html'] ) );
		$this->assertStringContainsString( "#fg-{$this->gallery}-2", $data['inlineCss'] );
		$this->assertStringNotContainsString( "#fg-{$this->gallery}-1", $data['inlineCss'] );
	}

	public function test_an_album_tile_carries_the_id_its_gallery_opens_with(): void {
		$album = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_album',
				'post_status' => 'publish',
			)
		);
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery, $album );

		$page = do_shortcode( '[fotogrids_gallery id="' . $this->gallery . '"][fotogrids_album id="' . $album . '"]' );
		preg_match( '/<div id="fg-' . $album . '-([0-9a-z]+)" class="[^"]*\bfotogrids-album\b/', $page, $wrapper );
		preg_match( '/data-fg-instance-id="([^"]+)"/', $page, $tile );

		$this->assertNotEmpty( $wrapper );
		$this->assertSame( "fg-{$this->gallery}-a{$wrapper[1]}", $tile[1] ?? '' );

		$response = $this->post(
			'/fotogrids/v1/gallery/render',
			array(
				'gallery_id'  => $this->gallery,
				'instance_id' => $tile[1],
			)
		);

		$this->assertSame( $tile[1], $this->gallery_id_in( $response->get_data()['html'] ) );
	}

	public function test_an_album_swap_without_an_id_still_renders_the_gallery(): void {
		$response = $this->post( '/fotogrids/v1/gallery/render', array( 'gallery_id' => $this->gallery ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertMatchesRegularExpression( "/^fg-{$this->gallery}-\\d+$/", $this->gallery_id_in( $response->get_data()['html'] ) );
	}

	public function test_an_album_swap_refuses_an_id_of_another_gallery(): void {
		$other = $this->gallery();

		$response = $this->post(
			'/fotogrids/v1/gallery/render',
			array(
				'gallery_id'  => $this->gallery,
				'instance_id' => "fg-{$other}-2",
			)
		);

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'rest_invalid_param', $response->get_data()['code'] );
	}

	public function test_an_album_swap_refuses_an_id_carrying_markup(): void {
		$response = $this->post(
			'/fotogrids/v1/gallery/render',
			array(
				'gallery_id'  => $this->gallery,
				'instance_id' => "fg-{$this->gallery}-2\"><script>",
			)
		);

		$this->assertSame( 400, $response->get_status() );
	}

	public function test_the_second_of_two_lock_screens_unlocks_with_its_own_id(): void {
		$this->lock( $this->gallery );

		Instance_Id_Factory::reset_for_tests();
		$page = do_shortcode( str_repeat( '[fotogrids_gallery id="' . $this->gallery . '"]', 2 ) );
		preg_match_all( '/<div id="([^"]+)" class="fotogrids-gate\b/', $page, $gates );
		$this->assertSame( array( "fg-{$this->gallery}-1", "fg-{$this->gallery}-2" ), $gates[1] );

		$response = $this->post(
			"/fotogrids/v1/gallery/{$this->gallery}/unlock",
			array(
				'password'    => self::PASSWORD,
				'instance_id' => $gates[1][1],
			)
		);
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( "fg-{$this->gallery}-2", $this->gallery_id_in( $data['html'] ) );
		$this->assertStringContainsString( "#fg-{$this->gallery}-2", $data['inlineCss'] );
	}

	public function test_an_unlock_without_an_id_still_renders_the_gallery(): void {
		$this->lock( $this->gallery );

		$response = $this->post( "/fotogrids/v1/gallery/{$this->gallery}/unlock", array( 'password' => self::PASSWORD ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( "fg-{$this->gallery}-1", $this->gallery_id_in( $response->get_data()['html'] ) );
	}

	public function test_an_unlock_refuses_an_id_of_another_gallery(): void {
		$this->lock( $this->gallery );
		$other = $this->gallery();

		$response = $this->post(
			"/fotogrids/v1/gallery/{$this->gallery}/unlock",
			array(
				'password'    => self::PASSWORD,
				'instance_id' => "fg-{$other}-1",
			)
		);

		$this->assertSame( 400, $response->get_status() );
	}

	public function test_a_wrong_password_with_a_valid_id_stays_locked(): void {
		$this->lock( $this->gallery );

		$response = $this->post(
			"/fotogrids/v1/gallery/{$this->gallery}/unlock",
			array(
				'password'    => 'wrong',
				'instance_id' => "fg-{$this->gallery}-2",
			)
		);

		$this->assertSame( 401, $response->get_status() );
	}
}
