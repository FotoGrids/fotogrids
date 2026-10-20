<?php
/**
 * A shortcode `template` applies only when it names an installed layout the
 * collection type offers; anything else renders the saved layout.
 *
 * @package FotoGrids
 */

use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Password_Crypto;
use FotoGrids\Public_Render;
use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Instance_Id_Factory;

class EmbedTemplateTest extends WP_UnitTestCase {

	private const EVERY_TYPE = array( 'grid', 'masonry', 'justified' );

	private const GALLERY_ONLY = array( 'slider', 'image-viewer', 'single-item', 'featured-item', 'instant-photos' );

	private const PRO_ONLY = array( 'carousel', 'video', 'mixed-tiles', 'products' );

	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( 0 );
		$this->reset_render_state();
	}

	private function reset_render_state(): void {
		$resolver = Asset_Resolver::instance();
		foreach ( array( 'css_queue', 'js_queue', 'enqueued_css_handles', 'enqueued_js_handles' ) as $property ) {
			$reflection = new ReflectionProperty( $resolver, $property );
			$reflection->setAccessible( true );
			$reflection->setValue( $resolver, array() );
		}
		Instance_Id_Factory::reset_for_tests();
		$GLOBALS['wp_styles'] = new WP_Styles();
	}

	private function image(): int {
		$file  = wp_tempnam( 'fg-embed-template.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-embed-template.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	/** A published gallery of two images with the given settings meta. */
	private function gallery( array $meta = array() ): int {
		$gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		Gallery_Repository::set_item_ids( $gallery, array( $this->image(), $this->image() ) );
		$this->apply_meta( $gallery, $meta );

		return $gallery;
	}

	/** A published album of two galleries with the given settings meta. */
	private function album( array $meta = array() ): int {
		$album = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_album',
				'post_status' => 'publish',
			)
		);
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery(), $album, 0 );
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery(), $album, 1 );
		$this->apply_meta( $album, $meta );

		return $album;
	}

	private function apply_meta( int $collection, array $meta ): void {
		if ( ! empty( $meta['password_protect'] ) ) {
			$meta['password'] = Password_Crypto::encrypt( 'secret' );
		}
		foreach ( $meta as $key => $value ) {
			update_post_meta( $collection, 'fotogrids_' . $key, $value );
		}
	}

	private function render( string $shortcode ): string {
		$this->reset_render_state();

		return do_shortcode( $shortcode );
	}

	/** Every `data-fg-layout` value in the markup, in order. */
	private function layouts( string $html ): array {
		preg_match_all( '/data-fg-layout="([^"]*)"/', $html, $matches );

		return $matches[1];
	}

	private function lock_form_template( string $html ): ?string {
		return preg_match( '/data-fg-embed-template="([^"]*)"/', $html, $match ) ? $match[1] : null;
	}

	private function unlock_route_accepts( string $type, $template ): bool {
		$routes   = rest_get_server()->get_routes();
		$validate = $routes[ '/fotogrids/v1/' . $type . '/(?P<id>\d+)/unlock' ][0]['args']['template']['validate_callback'];

		return (bool) $validate( $template, new WP_REST_Request( 'POST' ), 'template' );
	}

	public static function value_cases(): array {
		$cases = array();
		foreach ( self::EVERY_TYPE as $layout ) {
			$cases[ $layout ] = array( $layout, true, true );
		}
		foreach ( self::GALLERY_ONLY as $layout ) {
			$cases[ $layout ] = array( $layout, true, false );
		}
		foreach ( self::PRO_ONLY as $layout ) {
			$cases[ $layout . ' (Pro)' ] = array( $layout, false, false );
		}
		$cases['unregistered'] = array( 'kaleidoscope', false, false );
		$cases['empty']        = array( '', false, false );
		$cases['null']         = array( null, false, false );
		$cases['integer']      = array( 1, false, false );
		$cases['array']        = array( array( 'grid' ), false, false );

		return $cases;
	}

	/**
	 * @dataProvider value_cases
	 */
	public function test_which_values_count_as_a_layout( $value, bool $for_gallery, bool $for_album ): void {
		$this->assertSame( $for_gallery, Public_Render::is_layout_key( $value, 'gallery' ) );
		$this->assertSame( $for_album, Public_Render::is_layout_key( $value, 'album' ) );
	}

	/** The non-empty string cases; the route schema rejects the rest before validation. */
	public static function route_cases(): array {
		return array_filter(
			self::value_cases(),
			static fn ( array $case ) => is_string( $case[0] ) && '' !== $case[0]
		);
	}

	/**
	 * @dataProvider route_cases
	 */
	public function test_the_unlock_routes_take_the_same_values( string $value, bool $for_gallery, bool $for_album ): void {
		$this->assertSame( $for_gallery, $this->unlock_route_accepts( 'gallery', $value ) );
		$this->assertSame( $for_album, $this->unlock_route_accepts( 'album', $value ) );
	}

	public static function gallery_template_cases(): array {
		$cases = array();
		foreach ( array_merge( self::EVERY_TYPE, self::GALLERY_ONLY ) as $layout ) {
			$cases[ $layout ] = array( $layout, $layout );
		}
		foreach ( self::PRO_ONLY as $layout ) {
			$cases[ $layout . ' (Pro)' ] = array( $layout, 'justified' );
		}
		$cases['unregistered'] = array( 'kaleidoscope', 'justified' );
		$cases['padded']       = array( ' masonry ', 'masonry' );
		$cases['empty']        = array( '', 'justified' );

		return $cases;
	}

	/**
	 * @dataProvider gallery_template_cases
	 */
	public function test_a_gallery_embed_renders_the_template_or_its_saved_layout( string $template, string $expected ): void {
		$gallery = $this->gallery( array( 'layout' => 'justified' ) );

		foreach ( array( 0, self::factory()->user->create( array( 'role' => 'editor' ) ) ) as $user ) {
			wp_set_current_user( $user );
			$html = $this->render( '[fotogrids_gallery id="' . $gallery . '" template="' . $template . '"]' );

			$this->assertSame( array( $expected ), $this->layouts( $html ) );
			$this->assertStringNotContainsString( 'fotogrids-error', $html );
		}
	}

	public static function album_template_cases(): array {
		$cases = array();
		foreach ( self::EVERY_TYPE as $layout ) {
			$cases[ $layout ] = array( $layout, $layout );
		}
		foreach ( self::GALLERY_ONLY as $layout ) {
			$cases[ $layout . ' (gallery only)' ] = array( $layout, 'justified' );
		}
		foreach ( self::PRO_ONLY as $layout ) {
			$cases[ $layout . ' (Pro)' ] = array( $layout, 'justified' );
		}
		$cases['unregistered'] = array( 'kaleidoscope', 'justified' );
		$cases['padded']       = array( ' masonry ', 'masonry' );
		$cases['empty']        = array( '', 'justified' );

		return $cases;
	}

	/**
	 * @dataProvider album_template_cases
	 */
	public function test_an_album_embed_renders_the_template_or_its_saved_layout( string $template, string $expected ): void {
		$album = $this->album( array( 'layout' => 'justified' ) );

		$html = $this->render( '[fotogrids_album id="' . $album . '" template="' . $template . '"]' );

		$this->assertSame( array( $expected ), $this->layouts( $html ) );
		$this->assertStringNotContainsString( 'fotogrids-error', $html );
	}

	public static function lock_form_cases(): array {
		return array(
			'gallery, offered'      => array( 'gallery', 'masonry', 'masonry' ),
			'gallery, gallery-only' => array( 'gallery', 'slider', 'slider' ),
			'gallery, unregistered' => array( 'gallery', 'kaleidoscope', null ),
			'gallery, Pro'          => array( 'gallery', 'carousel', null ),
			'album, offered'        => array( 'album', 'masonry', 'masonry' ),
			'album, gallery-only'   => array( 'album', 'slider', null ),
			'album, unregistered'   => array( 'album', 'kaleidoscope', null ),
		);
	}

	/**
	 * @dataProvider lock_form_cases
	 */
	public function test_the_lock_form_carries_only_a_template_the_unlock_will_use( string $type, string $template, ?string $expected ): void {
		$id = 'gallery' === $type
			? $this->gallery( array( 'password_protect' => '1' ) )
			: $this->album( array( 'password_protect' => '1' ) );

		$html = $this->render( '[fotogrids_' . $type . ' id="' . $id . '" template="' . $template . '"]' );

		$this->assertStringContainsString( 'fg-lock-form', $html );
		$this->assertSame( $expected, $this->lock_form_template( $html ) );
	}

	public function test_cols_still_apply_beside_a_rejected_template(): void {
		$gallery = $this->gallery( array( 'layout' => 'masonry' ) );

		$html   = $this->render( '[fotogrids_gallery id="' . $gallery . '" template="kaleidoscope" cols="2"]' );
		$result = Public_Render::last_render_result();

		$this->assertSame( array( 'masonry' ), $this->layouts( $html ) );
		$this->assertNotNull( $result );
		$this->assertStringContainsString( '--fg-cols: 2;', $result->inline_css );
	}

	public function test_an_offered_template_renders_a_gallery_whose_saved_layout_is_not_installed(): void {
		$gallery = $this->gallery( array( 'layout' => 'kaleidoscope' ) );

		$html = $this->render( '[fotogrids_gallery id="' . $gallery . '" template="masonry"]' );

		$this->assertSame( array( 'masonry' ), $this->layouts( $html ) );
		$this->assertStringNotContainsString( 'fotogrids-error', $html );
	}

	public function test_a_rejected_template_leaves_a_saved_layout_that_is_not_installed_failing(): void {
		$gallery   = $this->gallery( array( 'layout' => 'kaleidoscope' ) );
		$shortcode = '[fotogrids_gallery id="' . $gallery . '" template="slidr"]';

		$visitor = $this->render( $shortcode );
		$this->assertStringContainsString( '<div class="fotogrids-error" hidden></div>', $visitor );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$editor = $this->render( $shortcode );
		$this->assertStringContainsString( esc_html( "No layout supports id 'kaleidoscope'" ), $editor );
	}

	public function test_a_cached_embed_with_a_rejected_template_replays_the_saved_layout(): void {
		$gallery   = $this->gallery(
			array(
				'layout'       => 'masonry',
				'enable_cache' => '1',
			)
		);
		$shortcode = '[fotogrids_gallery id="' . $gallery . '" template="kaleidoscope"]';

		$first = $this->render( $shortcode );
		$hits  = did_action( Actions_Cache::HIT );
		$again = $this->render( $shortcode );

		$this->assertSame( 1, did_action( Actions_Cache::HIT ) - $hits );
		$this->assertSame( array( 'masonry' ), $this->layouts( $first ) );
		$this->assertSame( array( 'masonry' ), $this->layouts( $again ) );
		$this->assertContains( 'fotogrids-layout-masonry', wp_styles()->queue );
	}

	public function test_two_embeds_of_one_gallery_each_resolve_their_own_template(): void {
		$gallery = $this->gallery(
			array(
				'layout'       => 'justified',
				'enable_cache' => '1',
			)
		);

		$html = $this->render(
			'[fotogrids_gallery id="' . $gallery . '" template="kaleidoscope"]'
			. '[fotogrids_gallery id="' . $gallery . '" template="masonry"]'
		);

		$this->assertSame( array( 'justified', 'masonry' ), $this->layouts( $html ) );
	}
}
