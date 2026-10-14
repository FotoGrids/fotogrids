<?php
/**
 * Album changes and the render cache of the galleries they reach.
 *
 * @package FotoGrids
 */

use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_Album;
use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Render\Internal\Instance_Id_Factory;
use FotoGrids\Metaboxes\Collection_Save_Pipeline;
use FotoGrids\Settings\View_Settings_Store;

class AlbumChangesCacheTest extends WP_UnitTestCase {

	private int $admin;

	private int $gallery;

	private int $sibling;

	private int $album;

	private int $other_album;

	public function set_up(): void {
		parent::set_up();

		$this->admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$image       = $this->image();

		$this->gallery = $this->collection( 'fotogrids_gallery', 'Harbour' );
		$this->sibling = $this->collection( 'fotogrids_gallery', 'Market' );
		foreach ( array( $this->gallery, $this->sibling ) as $gallery ) {
			update_post_meta( $gallery, 'fotogrids_enable_cache', '1' );
			Gallery_Repository::set_item_ids( $gallery, array( $image ) );
		}

		$this->album = $this->collection( 'fotogrids_album', 'Coast' );
		update_post_meta( $this->album, 'fotogrids_navigation_show_breadcrumbs', '1' );
		update_post_meta( $this->album, 'fotogrids_navigation_show_breadcrumbs_on_direct_visit', '1' );
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery, $this->album );
		Gallery_Album_Relations::add_gallery_to_album( $this->sibling, $this->album );

		$this->other_album = $this->collection( 'fotogrids_album', 'Inland' );

		wp_set_current_user( 0 );
	}

	public function tear_down(): void {
		$_POST = array();
		parent::tear_down();
	}

	private function collection( string $type, string $title ): int {
		return self::factory()->post->create(
			array(
				'post_type'   => $type,
				'post_status' => 'publish',
				'post_title'  => $title,
			)
		);
	}

	/** An uploaded JPEG attachment. */
	private function image(): int {
		$file  = wp_tempnam( 'fg-album-cache.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-album-cache.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	/** A logged-out render of the gallery; true when it came from the cache. */
	private function render(): bool {
		Instance_Id_Factory::reset_for_tests();

		$hits = did_action( Actions_Cache::HIT );
		$html = do_shortcode( '[fotogrids_gallery id="' . $this->gallery . '"]' );

		$this->assertStringContainsString( 'fotogrids-gallery', $html );

		return did_action( Actions_Cache::HIT ) > $hits;
	}

	/** Cache the gallery's render, confirmed by a hit. */
	private function cache_gallery(): void {
		$this->render();
		$this->assertTrue( $this->render(), 'the render was not cached' );
	}

	/** Save a collection through the editor's admin-ajax handler. */
	private function save_in_editor( int $post_id, array $fields ): void {
		wp_set_current_user( $this->admin );

		$post  = get_post( $post_id );
		$_POST = array_merge(
			array(
				'nonce'      => wp_create_nonce( 'fotogrids_meta_box' ),
				'post_id'    => (string) $post_id,
				'post_title' => $post->post_title,
				'post_name'  => $post->post_name,
			),
			$fields
		);

		$response = null;
		add_filter( 'wp_doing_ajax', '__return_true' );
		add_filter( 'wp_die_ajax_handler', array( $this, 'get_wp_die_handler' ) );
		ob_start();

		try {
			Collection_Save_Pipeline::on_ajax_save_collection();
		} catch ( WPDieException $e ) {
			$response = json_decode( (string) ob_get_contents(), true );
		} finally {
			ob_end_clean();
			remove_filter( 'wp_doing_ajax', '__return_true' );
			remove_filter( 'wp_die_ajax_handler', array( $this, 'get_wp_die_handler' ) );
			wp_set_current_user( 0 );
		}

		$this->assertTrue( $response['success'] ?? false, 'the editor save failed' );
	}

	public function test_adding_the_gallery_to_an_album_reaches_its_cached_render(): void {
		$this->cache_gallery();

		Gallery_Album_Relations::add_gallery_to_album( $this->gallery, $this->other_album );

		$this->assertFalse( $this->render() );
	}

	public function test_removing_the_gallery_from_an_album_reaches_its_cached_render(): void {
		$this->cache_gallery();

		Gallery_Album_Relations::remove_gallery_from_album( $this->gallery, $this->album );

		$this->assertFalse( $this->render() );
	}

	public function test_renaming_the_album_in_the_editor_reaches_its_galleries(): void {
		$this->cache_gallery();

		$this->save_in_editor( $this->album, array( 'post_title' => 'Coastline' ) );

		$this->assertFalse( $this->render() );
	}

	public function test_saving_navigation_settings_in_the_editor_reaches_its_galleries(): void {
		$this->cache_gallery();

		$this->save_in_editor( $this->album, array( 'fotogrids_navigation_show_back_button' => '0' ) );

		$this->assertSame( '0', get_post_meta( $this->album, 'fotogrids_navigation_show_back_button', true ) );
		$this->assertFalse( $this->render() );
	}

	public function test_editing_the_album_outside_the_editor_reaches_its_galleries(): void {
		$this->cache_gallery();

		wp_update_post(
			array(
				'ID'        => $this->album,
				'post_name' => 'shoreline',
			)
		);

		$this->assertFalse( $this->render() );
	}

	public function test_trashing_and_restoring_the_album_reach_its_galleries(): void {
		$this->cache_gallery();
		wp_trash_post( $this->album );
		$this->assertFalse( $this->render() );

		$this->cache_gallery();
		wp_untrash_post( $this->album );
		$this->assertFalse( $this->render() );
	}

	public function test_deleting_the_album_reaches_its_galleries(): void {
		$this->cache_gallery();

		wp_delete_post( $this->album, true );

		$this->assertFalse( $this->render() );
	}

	public function test_renaming_the_gallery_outside_the_editor_reaches_its_cached_render(): void {
		$this->cache_gallery();

		wp_update_post(
			array(
				'ID'         => $this->gallery,
				'post_title' => 'Harbour at dusk',
			)
		);

		$this->assertFalse( $this->render() );
	}

	public function test_changing_the_view_page_base_reaches_cached_renders(): void {
		$this->cache_gallery();

		View_Settings_Store::save( array_merge( View_Settings_Store::get(), array( 'base_album_segment' => 'collections' ) ) );

		$this->assertFalse( $this->render() );
	}

	public function test_saving_unchanged_view_settings_keeps_the_cache(): void {
		View_Settings_Store::save( View_Settings_Store::get() );
		$this->cache_gallery();

		View_Settings_Store::save( View_Settings_Store::get() );

		$this->assertTrue( $this->render() );
	}

	public function test_resetting_plugin_settings_reaches_cached_renders(): void {
		$this->cache_gallery();

		wp_set_current_user( $this->admin );
		$response = rest_do_request( new WP_REST_Request( 'POST', '/fotogrids/v1/admin/maintenance/reset-options' ) );
		wp_set_current_user( 0 );

		$this->assertSame( 200, $response->get_status() );
		$this->assertFalse( $this->render() );
	}

	public function test_reordering_the_album_keeps_the_cache(): void {
		$this->cache_gallery();

		Gallery_Album_Relations::reorder_galleries_in_album( $this->album, array( $this->sibling, $this->gallery ) );

		$this->assertTrue( $this->render() );
	}

	public function test_changing_an_album_the_gallery_is_not_in_keeps_the_cache(): void {
		$this->cache_gallery();

		wp_update_post(
			array(
				'ID'         => $this->other_album,
				'post_title' => 'Highlands',
			)
		);

		$this->assertTrue( $this->render() );
	}

	public function test_deleting_an_album_reports_each_gallery_it_held(): void {
		$removed = array();
		$record  = static function ( $gallery_id, $album_id ) use ( &$removed ) {
			$removed[] = array( $gallery_id, $album_id );
		};
		add_action( Actions_Album::GALLERY_REMOVED, $record, 10, 2 );

		wp_delete_post( $this->album, true );

		remove_action( Actions_Album::GALLERY_REMOVED, $record, 10 );
		sort( $removed );
		$this->assertSame(
			array( array( $this->gallery, $this->album ), array( $this->sibling, $this->album ) ),
			$removed
		);
	}

	public function test_adding_a_gallery_reports_it_once(): void {
		$added  = array();
		$record = static function ( $gallery_id, $album_id ) use ( &$added ) {
			$added[] = array( $gallery_id, $album_id );
		};
		add_action( Actions_Album::GALLERY_ADDED, $record, 10, 2 );

		Gallery_Album_Relations::add_gallery_to_album( $this->gallery, $this->other_album );
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery, $this->other_album );

		remove_action( Actions_Album::GALLERY_ADDED, $record, 10 );
		$this->assertSame( array( array( $this->gallery, $this->other_album ) ), $added );
	}

	public function test_reordering_reports_the_new_order(): void {
		$seen   = array();
		$record = static function ( $album_id, $gallery_ids ) use ( &$seen ) {
			$seen[] = array( $album_id, $gallery_ids );
		};
		add_action( Actions_Album::REORDERED, $record, 10, 2 );

		Gallery_Album_Relations::reorder_galleries_in_album( $this->album, array( $this->sibling, $this->gallery ) );

		remove_action( Actions_Album::REORDERED, $record, 10 );
		$this->assertSame( array( array( $this->album, array( $this->sibling, $this->gallery ) ) ), $seen );
	}

	public function test_deleting_a_gallery_reports_each_album_it_was_in(): void {
		Gallery_Album_Relations::add_gallery_to_album( $this->gallery, $this->other_album );

		$removed = array();
		$record  = static function ( $gallery_id, $album_id ) use ( &$removed ) {
			$removed[] = array( $gallery_id, $album_id );
		};
		add_action( Actions_Album::GALLERY_REMOVED, $record, 10, 2 );

		wp_delete_post( $this->gallery, true );

		remove_action( Actions_Album::GALLERY_REMOVED, $record, 10 );
		sort( $removed );
		$this->assertSame(
			array( array( $this->gallery, $this->album ), array( $this->gallery, $this->other_album ) ),
			$removed
		);
	}

	public function test_removing_a_gallery_that_is_not_in_the_album_reports_nothing(): void {
		$before = did_action( Actions_Album::GALLERY_REMOVED );

		Gallery_Album_Relations::remove_gallery_from_album( $this->gallery, $this->other_album );

		$this->assertSame( $before, did_action( Actions_Album::GALLERY_REMOVED ) );
	}
}
