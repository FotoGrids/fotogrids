<?php
/**
 * Collection stylesheets enqueued before the head on classic themes.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Head_Styles;
use FotoGrids\Password_Crypto;
use FotoGrids\Public_Render;
use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Instance_Id_Factory;

class HeadStylesTest extends WP_UnitTestCase {

	/** Registers a minimal classic theme; the suite's WordPress ships only block themes. */
	public static function set_up_before_class(): void {
		parent::set_up_before_class();

		$root = trailingslashit( get_temp_dir() ) . 'fg-head-styles-themes';
		wp_mkdir_p( $root . '/fg-classic' );
		file_put_contents( $root . '/fg-classic/style.css', "/*\nTheme Name: FG Classic\n*/\n" );
		file_put_contents( $root . '/fg-classic/index.php', "<?php\n" );
		register_theme_directory( $root );
		wp_clean_themes_cache();
	}

	public function set_up(): void {
		parent::set_up();

		switch_theme( 'fg-classic' );
		$this->assertFalse( wp_is_block_theme() );

		wp_set_current_user( 0 );
		$this->reset_styles();
	}

	public function tear_down(): void {
		Public_Render::set_view_page_context( false );
		parent::tear_down();
	}

	/** Starts a fresh page view: empty style queue, resolver queues and instance counter. */
	private function reset_styles(): void {
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
		$file  = wp_tempnam( 'fg-head-styles.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-head-styles.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	/** A published gallery of three images with the given settings meta. */
	private function gallery( array $meta = array() ): int {
		$gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		Gallery_Repository::set_item_ids( $gallery, array( $this->image(), $this->image(), $this->image() ) );
		foreach ( $meta as $key => $value ) {
			update_post_meta( $gallery, 'fotogrids_' . $key, $value );
		}

		return $gallery;
	}

	private function page( string $content, array $args = array() ): int {
		return self::factory()->post->create(
			array_merge(
				array(
					'post_type'    => 'page',
					'post_status'  => 'publish',
					'post_content' => $content,
				),
				$args
			)
		);
	}

	/** FotoGrids stylesheets in the queue, sorted. */
	private function queued_styles(): array {
		$handles = array_filter(
			wp_styles()->queue,
			static fn ( $handle ) => 0 === strpos( $handle, 'fotogrids-' ) && 0 !== strpos( $handle, 'fotogrids-inline-' )
		);
		sort( $handles );

		return array_values( $handles );
	}

	/** Stylesheets the head pass enqueues on the given URL. */
	private function head_pass( string $url ): array {
		$this->reset_styles();
		$this->go_to( $url );
		Head_Styles::enqueue();

		return $this->queued_styles();
	}

	/** Stylesheets the content enqueues when it renders. */
	private function rendered( string $content ): array {
		$this->reset_styles();
		do_blocks( do_shortcode( $content ) );

		return $this->queued_styles();
	}

	public static function settings_cases(): array {
		$per_page = wp_json_encode(
			array(
				'desktop' => 2,
				'tablet'  => 2,
				'mobile'  => 2,
			)
		);

		return array(
			'grid'            => array( array() ),
			'masonry, paged'  => array(
				array(
					'layout'            => 'masonry',
					'pagination_method' => 'pages',
					'items_per_page'    => $per_page,
				),
			),
			'password locked' => array( array( 'password_protect' => '1' ) ),
			'random refetch'  => array(
				array(
					'default_sort_order' => 'random',
					'random_mode'        => 'refetch',
				),
			),
		);
	}

	/**
	 * @dataProvider settings_cases
	 */
	public function test_a_gallery_shortcode_enqueues_what_its_render_enqueues( array $meta ): void {
		if ( isset( $meta['password_protect'] ) ) {
			$meta['password'] = Password_Crypto::encrypt( 'secret' );
		}
		$content = '[fotogrids_gallery id="' . $this->gallery( $meta ) . '"]';

		$head = $this->head_pass( get_permalink( $this->page( $content ) ) );

		$this->assertNotEmpty( $head );
		$this->assertSame( $this->rendered( $content ), $head );
	}

	public function test_a_gallery_block_inside_a_group_enqueues_what_its_render_enqueues(): void {
		$content = '<!-- wp:group --><div class="wp-block-group"><!-- wp:fotogrids/gallery {"galleryId":'
			. $this->gallery( array( 'layout' => 'justified' ) )
			. '} /--></div><!-- /wp:group -->';

		$head = $this->head_pass( get_permalink( $this->page( $content ) ) );

		$this->assertNotEmpty( $head );
		$this->assertSame( $this->rendered( $content ), $head );
	}

	public function test_an_album_shortcode_enqueues_what_its_render_enqueues(): void {
		$album = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_album',
				'post_status' => 'publish',
			)
		);
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery(), $album );
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery(), $album );
		$content = '[fotogrids_album id="' . $album . '"]';

		$head = $this->head_pass( get_permalink( $this->page( $content ) ) );

		$this->assertNotEmpty( $head );
		$this->assertSame( $this->rendered( $content ), $head );
	}

	public function test_a_view_page_enqueues_what_its_collection_render_enqueues(): void {
		$gallery = $this->gallery();

		$head = $this->head_pass( get_permalink( $gallery ) );

		Public_Render::set_view_page_context( true );
		$this->assertNotEmpty( $head );
		$this->assertSame( $this->rendered( '[fotogrids_gallery id="' . $gallery . '"]' ), $head );
	}

	public function test_the_head_pass_leaves_instance_ids_to_the_render(): void {
		$gallery = $this->gallery();
		$this->go_to( get_permalink( $this->page( '[fotogrids_gallery id="' . $gallery . '"]' ) ) );
		Instance_Id_Factory::reset_for_tests();

		Head_Styles::enqueue();
		$html = do_shortcode( '[fotogrids_gallery id="' . $gallery . '"]' );

		$this->assertStringContainsString( 'id="fg-' . $gallery . '-1"', $html );
	}

	public function test_a_block_theme_needs_no_head_pass(): void {
		$page = $this->page( '[fotogrids_gallery id="' . $this->gallery() . '"]' );
		switch_theme( 'twentytwentyfive' );
		$this->assertTrue( wp_is_block_theme() );

		$this->assertSame( array(), $this->head_pass( get_permalink( $page ) ) );
	}

	public function test_an_escaped_shortcode_enqueues_nothing(): void {
		$page = $this->page( '[[fotogrids_gallery id="' . $this->gallery() . '"]]' );

		$this->assertSame( array(), $this->head_pass( get_permalink( $page ) ) );
	}

	public function test_a_password_protected_page_enqueues_nothing(): void {
		$page = $this->page( '[fotogrids_gallery id="' . $this->gallery() . '"]', array( 'post_password' => 'secret' ) );

		$this->assertSame( array(), $this->head_pass( get_permalink( $page ) ) );
	}

	public function test_an_archive_enqueues_nothing(): void {
		self::factory()->post->create( array( 'post_content' => '[fotogrids_gallery id="' . $this->gallery() . '"]' ) );

		$this->assertSame( array(), $this->head_pass( home_url( '/' ) ) );
	}
}
