<?php
/**
 * Attachment IDs through an export and an import on the same site or another one.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Galleries\Item_Meta;
use FotoGrids\Post_Types;
use FotoGrids\Tools\ImportExport\Import_Export_Data;

class ImportExportAttachmentMapTest extends WP_UnitTestCase {

	private const PHOTO = 'photo bytes from the exporting site';

	/** @var string[] */
	private $files = array();

	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		rest_get_server();
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
		add_filter( 'query', array( $this, 'keep_the_test_transaction' ) );
	}

	public function tear_down(): void {
		remove_filter( 'query', array( $this, 'keep_the_test_transaction' ) );
		foreach ( $this->files as $path ) {
			if ( file_exists( $path ) ) {
				unlink( $path );
			}
		}
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

	/** Creates an attachment whose file is on disk under uploads/<folder>/<name>. */
	private function upload( string $name, string $bytes, string $folder = '2026/10' ): int {
		$dir = trailingslashit( wp_upload_dir()['basedir'] ) . $folder;
		wp_mkdir_p( $dir );
		$path = "$dir/$name";
		file_put_contents( $path, $bytes );
		$this->files[] = $path;

		return self::factory()->attachment->create_object(
			$path,
			0,
			array(
				'post_mime_type' => 'image/jpeg',
				'post_title'     => pathinfo( $name, PATHINFO_FILENAME ),
			)
		);
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

	private function export(): array {
		return json_decode( self::call( 'serialise_json', self::call( 'collect_export_data', array( 'galleries', 'items', 'statistics' ) ) ), true );
	}

	/**
	 * @param array<string, mixed>|string $file Export data, or a serialised file.
	 * @param string                      $mode Conflict mode for galleries and albums.
	 */
	private function import( $file, string $mode = 'skip' ): array {
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', 'execute' );
		$request->set_param( 'file', is_string( $file ) ? $file : wp_json_encode( $file ) );
		$request->set_param( 'include', array( 'galleries', 'items', 'statistics' ) );
		$request->set_param( 'galleries', $mode );
		$request->set_param( 'albums', $mode );

		$response = Import_Export_Data::import( $request );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data();
	}

	private function imported_gallery(): int {
		$ids = get_posts(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'any',
				'numberposts' => -1,
				'fields'      => 'ids',
			)
		);
		$this->assertCount( 1, $ids );

		return (int) $ids[0];
	}

	private function forget_galleries(): void {
		foreach ( get_posts( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids' ) ) as $id ) {
			wp_delete_post( $id, true );
		}
	}

	/**
	 * Exports a gallery holding one photo with an item row, a featured image and
	 * views, then turns this site into another one: the gallery and the photo are
	 * removed, and the photo's ID in the file becomes `$source_id`, or the ID of a
	 * new unrelated attachment.
	 *
	 * @param int $source_id ID the file gives the photo; 0 for an unrelated attachment.
	 * @return array{0: array<string, mixed>, 1: int} The file, and the ID it gives the photo.
	 */
	private function file_from_another_site( int $source_id = 0 ): array {
		global $wpdb;

		$photo   = $this->upload( 'photo.jpg', self::PHOTO );
		$gallery = $this->gallery_with( $photo );
		update_post_meta( $gallery, Post_Types::FEATURED_IMAGE_META_KEY, $photo );
		Item_Meta::save( $photo, array( 'credit' => 'Jane Doe' ) );
		$wpdb->replace(
			$wpdb->prefix . 'fotogrids_statistics',
			array(
				'object_type' => 'item',
				'object_id'   => $photo,
				'views'       => 7,
				'shares'      => 0,
				'last_viewed' => current_time( 'mysql', true ),
			)
		);
		$file = $this->export();

		$this->forget_galleries();
		$wpdb->delete( Item_Meta::table(), array( 'attachment_id' => $photo ) );
		$wpdb->delete( $wpdb->prefix . 'fotogrids_statistics', array( 'object_type' => 'item' ) );
		wp_delete_attachment( $photo, true );

		$unrelated = $source_id > 0 ? $source_id : $this->upload( 'unrelated.jpg', 'someone else\'s photo' );

		$file['meta']['site_url']                                     = 'https://exporting.example';
		$file['galleries'][0]['meta']['fotogrids_gallery_items']      = wp_json_encode( array( $unrelated ) );
		$file['galleries'][0]['meta'][ Post_Types::FEATURED_IMAGE_META_KEY ] = (string) $unrelated;
		foreach ( array( 'items', 'media' ) as $key ) {
			foreach ( $file[ $key ] as $index => $entry ) {
				$field                            = 'items' === $key ? 'attachment_id' : 'id';
				$file[ $key ][ $index ][ $field ] = $unrelated;
			}
		}
		foreach ( $file['statistics'] as $index => $row ) {
			if ( 'item' === $row['object_type'] ) {
				$file['statistics'][ $index ]['object_id'] = $unrelated;
			}
		}

		return array( $file, $unrelated );
	}

	private function item_views( int $id ): int {
		global $wpdb;

		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT views FROM %i WHERE object_type = %s AND object_id = %d', $wpdb->prefix . 'fotogrids_statistics', 'item', $id ) );
	}

	public function test_export_identifies_each_gallery_attachment_by_its_file(): void {
		$photo = $this->upload( 'photo.jpg', self::PHOTO );
		$this->gallery_with( $photo );

		$this->assertSame(
			array(
				array(
					'id'   => $photo,
					'file' => '2026/10/photo.jpg',
					'name' => 'photo.jpg',
					'size' => strlen( self::PHOTO ),
					'sha1' => sha1( self::PHOTO ),
				),
			),
			$this->export()['media']
		);
	}

	public function test_an_import_on_the_same_site_keeps_the_ids(): void {
		$photo   = $this->upload( 'photo.jpg', self::PHOTO );
		$gallery = $this->gallery_with( $photo );
		update_post_meta( $gallery, Post_Types::FEATURED_IMAGE_META_KEY, $photo );
		$file = $this->export();

		$this->forget_galleries();
		$this->import( $file );

		$gallery = $this->imported_gallery();
		$this->assertSame( array( $photo ), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertSame( (string) $photo, get_post_meta( $gallery, Post_Types::FEATURED_IMAGE_META_KEY, true ) );
	}

	public function test_an_id_from_another_site_never_reaches_an_unrelated_attachment(): void {
		[ $file, $unrelated ] = $this->file_from_another_site();

		$result = $this->import( $file );

		$gallery = $this->imported_gallery();
		$this->assertSame( array(), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertFalse( metadata_exists( 'post', $gallery, Post_Types::FEATURED_IMAGE_META_KEY ) );
		$this->assertNull( Item_Meta::get( $unrelated ) );
		$this->assertSame( 'unrelated', get_post( $unrelated )->post_title );
		$this->assertSame( 0, $this->item_views( $unrelated ) );
		$this->assertSame( 1, $result['skipped']['items'] );
	}

	public function test_a_later_upload_does_not_join_the_imported_gallery(): void {
		$probe = self::factory()->post->create();
		wp_delete_post( $probe, true );
		$target = $probe + 10;

		[ $file ] = $this->file_from_another_site( $target );
		$this->import( $file );

		do {
			$later = $this->upload( 'later.jpg', 'uploaded after the import' );
		} while ( $later < $target );

		$this->assertSame( $target, $later );
		$this->assertSame( array(), Gallery_Repository::get_item_ids( $this->imported_gallery() ) );
	}

	public function test_a_reuploaded_photo_takes_the_item_back(): void {
		[ $file ] = $this->file_from_another_site();
		$reupload = $this->upload( 'photo.jpg', self::PHOTO, '2026/11' );

		$this->import( $file );

		$gallery = $this->imported_gallery();
		$this->assertSame( array( $reupload ), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertSame( (string) $reupload, (string) get_post_meta( $gallery, Post_Types::FEATURED_IMAGE_META_KEY, true ) );
		$this->assertSame( 'Jane Doe', Item_Meta::get( $reupload )['credit'] );
		$this->assertSame( 7, $this->item_views( $reupload ) );
	}

	public function test_a_reupload_is_matched_through_an_xml_file(): void {
		[ $file ] = $this->file_from_another_site();
		$reupload = $this->upload( 'photo.jpg', self::PHOTO, '2026/11' );

		$this->import( self::call( 'serialise_xml', $file ) );

		$this->assertSame( array( $reupload ), Gallery_Repository::get_item_ids( $this->imported_gallery() ) );
		$this->assertSame( 'Jane Doe', Item_Meta::get( $reupload )['credit'] );
	}

	public function test_a_reupload_renamed_for_a_duplicate_name_is_matched(): void {
		[ $file ] = $this->file_from_another_site();
		$this->upload( 'photo.jpg', 'a different photo with the same name' );
		$reupload = $this->upload( 'photo-1.jpg', self::PHOTO );

		$this->import( $file );

		$this->assertSame( array( $reupload ), Gallery_Repository::get_item_ids( $this->imported_gallery() ) );
	}

	public function test_a_file_with_the_same_name_but_other_content_is_not_matched(): void {
		[ $file ] = $this->file_from_another_site();
		$this->upload( 'photo.jpg', 'a different photo with the same name' );

		$this->import( $file );

		$this->assertSame( array(), Gallery_Repository::get_item_ids( $this->imported_gallery() ) );
	}

	public function test_overwrite_points_an_existing_gallery_at_the_reupload(): void {
		[ $file ] = $this->file_from_another_site();
		$reupload = $this->upload( 'photo.jpg', self::PHOTO, '2026/11' );
		$existing = $this->gallery_with();
		wp_update_post(
			array(
				'ID'        => $existing,
				'post_name' => $file['galleries'][0]['slug'],
			)
		);

		$this->import( $file, 'overwrite' );

		$this->assertSame( array( $reupload ), Gallery_Repository::get_item_ids( $existing ) );
	}

	public function test_an_older_file_from_another_site_keeps_no_ids(): void {
		[ $file, $unrelated ] = $this->file_from_another_site();
		unset( $file['media'] );
		$this->upload( 'photo.jpg', self::PHOTO, '2026/11' );

		$this->import( $file );

		$gallery = $this->imported_gallery();
		$this->assertSame( array(), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertFalse( metadata_exists( 'post', $gallery, Post_Types::FEATURED_IMAGE_META_KEY ) );
		$this->assertNull( Item_Meta::get( $unrelated ) );
	}

	public function test_an_older_file_from_this_site_keeps_its_ids(): void {
		$photo = $this->upload( 'photo.jpg', self::PHOTO );
		$this->gallery_with( $photo );
		$file = $this->export();
		unset( $file['media'] );

		$this->forget_galleries();
		$this->import( $file );

		$this->assertSame( array( $photo ), Gallery_Repository::get_item_ids( $this->imported_gallery() ) );
	}
}
