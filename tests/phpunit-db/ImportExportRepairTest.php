<?php
/**
 * An import repairs what it wrote, and leaves the upgrade migrations and the
 * rest of the site alone.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Migrations\Migration_Runner;
use FotoGrids\Post_Types;
use FotoGrids\Settings\Collection_Defaults_Store;
use FotoGrids\Tools\ImportExport\Import_Export_Data;

class ImportExportRepairTest extends WP_UnitTestCase {

	public static function set_up_before_class(): void {
		parent::set_up_before_class();
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
	}

	public function set_up(): void {
		parent::set_up();
		add_filter( 'query', array( $this, 'keep_the_test_transaction' ) );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
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

	private function import( array $file, array $include, array $settings = array() ): void {
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', 'execute' );
		$request->set_param( 'file', (string) wp_json_encode( array_merge( array( 'meta' => array( 'version' => '1.3.0', 'site_url' => get_site_url() ) ), $file ) ) );
		$request->set_param( 'include', $include );
		$request->set_param( 'settings', $settings );
		$request->set_param( 'galleries', 'skip' );
		$request->set_param( 'albums', 'skip' );

		$this->assertSame( 200, Import_Export_Data::import( $request )->get_status() );
	}

	private function row( int $id, string $slug, array $meta = array() ): array {
		return array(
			'id'     => $id,
			'title'  => ucfirst( $slug ),
			'slug'   => $slug,
			'status' => 'publish',
			'date'   => '2026-01-02 03:04:05',
			'meta'   => $meta,
		);
	}

	private function id( string $post_type, string $slug ): int {
		return (int) get_page_by_path( $slug, OBJECT, $post_type )->ID;
	}

	public function test_an_imported_list_setting_is_repaired_and_other_collections_are_not_touched(): void {
		$local = self::factory()->post->create( array( 'post_type' => Post_Types::GALLERY ) );
		update_post_meta( $local, 'fotogrids_lightbox_info_blocks', 'caption' );

		$this->import(
			array( 'galleries' => array( $this->row( 9101, 'rep-imported', array( 'fotogrids_lightbox_info_blocks' => 'exif' ) ) ) ),
			array( 'galleries' )
		);

		$imported = get_post_meta( $this->id( Post_Types::GALLERY, 'rep-imported' ), 'fotogrids_lightbox_info_blocks', true );
		$this->assertIsArray( json_decode( $imported, true ) );
		$this->assertSame( 'caption', get_post_meta( $local, 'fotogrids_lightbox_info_blocks', true ) );
	}

	public function test_imported_saved_defaults_hold_lists_as_arrays(): void {
		Collection_Defaults_Store::replace( 'gallery', array( 'lightbox_info_blocks' => '["caption","exif"]' ) );

		$this->import( array( 'galleries' => array() ), array( 'galleries' ) );

		$this->assertSame( array( 'caption', 'exif' ), Collection_Defaults_Store::get( 'gallery' )['lightbox_info_blocks'] );
	}

	public function test_a_local_album_outside_the_file_keeps_its_featured_gallery(): void {
		$album   = self::factory()->post->create( array( 'post_type' => Post_Types::ALBUM ) );
		$gallery = self::factory()->post->create( array( 'post_type' => Post_Types::GALLERY ) );
		update_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, $gallery );

		$this->import(
			array( 'albums' => array( $this->row( 9150, 'rep-album', array( Post_Types::FEATURED_GALLERY_META_KEY => $gallery ) ) ) ),
			array( 'albums' )
		);

		$this->assertSame( '', (string) get_post_meta( $this->id( Post_Types::ALBUM, 'rep-album' ), Post_Types::FEATURED_GALLERY_META_KEY, true ) );
		$this->assertSame( (string) $gallery, (string) get_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, true ) );
	}

	public function test_a_gallery_from_an_older_export_gets_its_list_from_the_item_rows(): void {
		$attachment = self::factory()->attachment->create_object( array( 'file' => 'rep-older.jpg', 'post_mime_type' => 'image/jpeg' ) );

		$this->import(
			array(
				'galleries' => array( $this->row( 9102, 'rep-older' ) ),
				'items'     => array(
					array(
						'attachment_id' => $attachment,
						'gallery_id'    => 9102,
						'position'      => 0,
					),
				),
			),
			array( 'galleries', 'items' )
		);

		$this->assertSame( array( $attachment ), Gallery_Repository::get_item_ids( $this->id( Post_Types::GALLERY, 'rep-older' ) ) );
	}

	public function test_an_import_runs_no_migration(): void {
		$recorded = Migration_Runner::completed();
		update_option( Migration_Runner::RECORD_OPTION, array(), true );

		$this->import( array( 'galleries' => array( $this->row( 9103, 'rep-plain' ) ) ), array( 'galleries' ) );

		$this->assertSame( array(), Migration_Runner::completed() );
		update_option( Migration_Runner::RECORD_OPTION, $recorded, true );
	}
}
