<?php
/**
 * Video embed items through export and import.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Embed_Store;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Tools\ImportExport\Import_Export_Data;

class ImportExportEmbedsTest extends WP_UnitTestCase {

	private const SETTINGS = array(
		'autoplay'   => true,
		'controls'   => false,
		'start_time' => 30,
	);

	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		rest_get_server();
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
		add_filter( 'query', array( $this, 'keep_the_test_transaction' ) );
	}

	public function tear_down(): void {
		remove_filter( 'query', array( $this, 'keep_the_test_transaction' ) );
		parent::tear_down();
	}

	/**
	 * Drops the import's own transaction statements, which would end the test's.
	 *
	 * @param  string $query SQL.
	 * @return string
	 */
	public function keep_the_test_transaction( $query ) {
		return in_array( trim( $query ), array( 'START TRANSACTION', 'COMMIT', 'ROLLBACK' ), true ) ? '' : $query;
	}

	private static function call( string $method, ...$args ) {
		$reflection = new ReflectionMethod( Import_Export_Data::class, $method );
		$reflection->setAccessible( true );

		return $reflection->invoke( null, ...$args );
	}

	private function embed( array $data = array() ): int {
		return Embed_Store::create(
			array_merge(
				array(
					'item_type'     => 'video_youtube',
					'video_id'      => 'dQw4w9WgXcQ',
					'url'           => 'https://www.youtube.com/embed/dQw4w9WgXcQ',
					'caption'       => 'Harbour timelapse',
					'thumbnail_url' => 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
					'settings'      => self::SETTINGS,
					'poster_id'     => 0,
					'poster_url'    => '',
				),
				$data
			)
		);
	}

	private function attachment(): int {
		return self::factory()->attachment->create_object( 'harbour.jpg', 0, array( 'post_mime_type' => 'image/jpeg' ) );
	}

	private function gallery_with( int ...$item_ids ): int {
		$gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
				'post_title'  => 'Harbour',
			)
		);
		Gallery_Repository::set_item_ids( $gallery, $item_ids );

		return $gallery;
	}

	private function export( string $serialiser = 'serialise_json' ): string {
		return self::call( $serialiser, self::call( 'collect_export_data', array( 'galleries', 'items' ) ) );
	}

	private function import( string $file, string $mode = 'skip' ): array {
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', 'execute' );
		$request->set_param( 'file', $file );
		$request->set_param( 'include', array( 'galleries', 'items' ) );
		$request->set_param( 'galleries', $mode );
		$request->set_param( 'albums', $mode );

		$response = Import_Export_Data::import( $request );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data();
	}

	/** @return int[] */
	private function galleries(): array {
		return get_posts(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'any',
				'numberposts' => -1,
				'orderby'     => 'ID',
				'order'       => 'ASC',
				'fields'      => 'ids',
			)
		);
	}

	/** @return int[] */
	private function embeds(): array {
		return get_posts(
			array(
				'post_type'   => Embed_Store::POST_TYPE,
				'post_status' => 'any',
				'numberposts' => -1,
				'fields'      => 'ids',
			)
		);
	}

	/** Removes the galleries and embeds, as a site that has the media but not the galleries. */
	private function forget_galleries(): void {
		foreach ( array_merge( $this->galleries(), $this->embeds() ) as $id ) {
			wp_delete_post( $id, true );
		}
	}

	private function without_id( array $embed ): array {
		unset( $embed['id'] );

		return $embed;
	}

	public function test_export_carries_each_gallery_embed(): void {
		$embed = $this->embed();
		$this->gallery_with( $this->attachment(), $embed );
		$this->embed( array( 'caption' => 'In no gallery' ) );

		$data = self::call( 'collect_export_data', array( 'items' ) );

		$this->assertCount( 1, $data['embeds'] );
		$this->assertSame( $embed, $data['embeds'][0]['id'] );
		$this->assertSame( 'https://www.youtube.com/embed/dQw4w9WgXcQ', $data['embeds'][0]['url'] );
		$this->assertSame( 'Harbour timelapse', $data['embeds'][0]['caption'] );
		$this->assertSame( self::SETTINGS, $data['embeds'][0]['settings'] );
	}

	public function format_provider(): array {
		return array(
			'json' => array( 'serialise_json' ),
			'xml'  => array( 'serialise_xml' ),
		);
	}

	/**
	 * @dataProvider format_provider
	 */
	public function test_import_recreates_the_embeds_and_links_the_gallery( string $serialiser ): void {
		$photo    = $this->attachment();
		$original = Embed_Store::get( $this->embed() );
		$this->gallery_with( $photo, $original['id'] );
		$file = $this->export( $serialiser );

		$this->forget_galleries();
		$result = $this->import( $file );

		$galleries = $this->galleries();
		$this->assertCount( 1, $galleries );
		$items = Gallery_Repository::get_item_ids( $galleries[0] );
		$this->assertCount( 2, $items );
		$this->assertSame( $photo, $items[0] );
		$this->assertNotSame( $original['id'], $items[1] );
		$this->assertSame( $this->without_id( $original ), $this->without_id( Embed_Store::get( $items[1] ) ) );
		$this->assertSame( 2, $result['imported']['items'] );
	}

	public function test_overwrite_on_the_same_site_keeps_the_embed(): void {
		$embed   = $this->embed();
		$gallery = $this->gallery_with( $embed );

		$this->import( $this->export(), 'overwrite' );

		$this->assertSame( array( $embed ), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertSame( array( $embed ), $this->embeds() );
	}

	public function test_overwrite_writes_the_files_data_onto_the_embed(): void {
		$embed   = $this->embed();
		$gallery = $this->gallery_with( $embed );
		$before  = Embed_Store::get( $embed );
		$file    = $this->export();

		Embed_Store::update(
			$embed,
			array(
				'caption'    => 'Edited on the site',
				'settings'   => array( 'loop' => true ),
				'poster_url' => 'https://example.com/poster.jpg',
			)
		);
		$this->import( $file, 'overwrite' );

		$this->assertSame( array( $embed ), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertSame( $before, Embed_Store::get( $embed ) );
	}

	public function test_a_restored_gallery_takes_the_files_data_onto_its_leftover_embed(): void {
		$embed   = $this->embed();
		$gallery = $this->gallery_with( $embed );
		$before  = Embed_Store::get( $embed );
		$file    = $this->export();

		wp_delete_post( $gallery, true );
		Embed_Store::update( $embed, array( 'caption' => 'Edited on the site' ) );
		$this->import( $file );

		$this->assertSame( array( $embed ), $this->embeds() );
		$this->assertSame( $before, Embed_Store::get( $embed ) );
	}

	public function test_skip_on_the_same_site_creates_no_embed(): void {
		$embed   = $this->embed();
		$gallery = $this->gallery_with( $embed );

		$this->import( $this->export(), 'skip' );

		$this->assertSame( array( $embed ), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertSame( array( $embed ), $this->embeds() );
	}

	public function test_duplicate_gives_the_copy_its_own_embed(): void {
		$embed   = $this->embed();
		$gallery = $this->gallery_with( $embed );

		$this->import( $this->export(), 'duplicate' );

		$galleries = $this->galleries();
		$this->assertCount( 2, $galleries );
		$copy = Gallery_Repository::get_item_ids( $galleries[1] );
		$this->assertSame( array( $embed ), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertCount( 1, $copy );
		$this->assertNotSame( $embed, $copy[0] );
		$this->assertSame( array( $galleries[1] ), Gallery_Repository::find_galleries_for_item( $copy[0] ) );
	}

	public function test_a_missing_media_library_poster_falls_back_to_its_url(): void {
		$poster = $this->attachment();
		$this->gallery_with( $this->embed( array( 'poster_id' => $poster ) ) );
		$file = $this->export();

		$this->forget_galleries();
		wp_delete_attachment( $poster, true );
		$this->import( $file );

		$items = Gallery_Repository::get_item_ids( $this->galleries()[0] );
		$embed = Embed_Store::get( $items[0] );
		$this->assertSame( 0, $embed['poster_id'] );
		$this->assertStringContainsString( 'harbour.jpg', $embed['poster_url'] );
	}

	public function test_a_new_embed_is_not_taken_by_another_gallery_listing_its_id(): void {
		$this->gallery_with( $this->embed() );
		$file = json_decode( $this->export(), true );

		$this->forget_galleries();
		$next = (int) self::factory()->post->create() + 1;

		$file['galleries'][] = array(
			'id'    => 999999,
			'title' => 'Harbour foreign',
			'slug'  => 'harbour-foreign',
			'meta'  => array( 'fotogrids_gallery_items' => wp_json_encode( range( $next, $next + 50 ) ) ),
		);
		$this->import( wp_json_encode( $file ) );

		$embed   = $this->embeds()[0];
		$foreign = get_page_by_path( 'harbour-foreign', OBJECT, 'fotogrids_gallery' );
		$this->assertContains( $embed, range( $next, $next + 50 ) );
		$this->assertNotContains( $embed, Gallery_Repository::get_item_ids( $foreign->ID ) );
		$this->assertCount( 50, Gallery_Repository::get_item_ids( $foreign->ID ) );
		$this->assertSame( array( get_page_by_path( 'harbour', OBJECT, 'fotogrids_gallery' )->ID ), Gallery_Repository::find_galleries_for_item( $embed ) );
	}

	private function video_attachment(): int {
		return self::factory()->attachment->create_object( 'clip.mp4', 0, array( 'post_mime_type' => 'video/mp4' ) );
	}

	private function analyse( string $file ): array {
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', 'analyse' );
		$request->set_param( 'file', $file );

		return Import_Export_Data::import( $request )->get_data()['contents'];
	}

	public function test_the_analysis_counts_images_and_videos(): void {
		$this->gallery_with( $this->attachment(), $this->video_attachment(), $this->embed() );

		$contents = $this->analyse( $this->export() );

		$this->assertSame( 3, $contents['items'] );
		$this->assertSame(
			array(
				'images' => 1,
				'videos' => 2,
			),
			$contents['items_detail']
		);
	}

	public function test_a_file_that_does_not_type_its_items_is_not_split(): void {
		$file = wp_json_encode(
			array(
				'meta'  => array( 'version' => '1.2.0' ),
				'items' => array( array( 'attachment_id' => $this->attachment() ) ),
			)
		);

		$contents = $this->analyse( $file );

		$this->assertSame( 1, $contents['items'] );
		$this->assertArrayNotHasKey( 'items_detail', $contents );
	}

	public function test_the_result_counts_images_and_videos(): void {
		$this->gallery_with( $this->attachment(), $this->video_attachment(), $this->embed() );
		$file = $this->export();

		$this->forget_galleries();
		$result = $this->import( $file );

		$this->assertSame( 3, $result['imported']['items'] );
		$this->assertSame(
			array(
				'images' => 1,
				'videos' => 2,
			),
			$result['imported']['items_detail']
		);
	}

	public function test_embeds_no_written_gallery_lists_count_as_skipped_videos(): void {
		$this->gallery_with( $this->embed() );

		$result = $this->import( $this->export(), 'skip' );

		$this->assertSame( 1, $result['skipped']['items'] );
		$this->assertSame( 1, $result['skipped']['items_detail']['videos'] );
	}
}
