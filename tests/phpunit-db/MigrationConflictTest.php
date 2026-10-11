<?php
/**
 * The WordPress galleries migration and its "If a gallery already exists" choice.
 *
 * @package FotoGrids
 */

class MigrationConflictTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$first  = $this->image();
		$second = $this->image();

		self::factory()->post->create(
			array(
				'post_title'   => 'Block gallery',
				'post_content' => '<!-- wp:gallery {"linkTo":"none"} --><figure class="wp-block-gallery has-nested-images">'
					. '<!-- wp:image {"id":' . $first . '} --><figure class="wp-block-image"><img class="wp-image-' . $first . '"/></figure><!-- /wp:image -->'
					. '<!-- wp:image {"id":' . $second . '} --><figure class="wp-block-image"><img class="wp-image-' . $second . '"/></figure><!-- /wp:image -->'
					. '</figure><!-- /wp:gallery -->',
			)
		);

		self::factory()->post->create(
			array(
				'post_title'   => 'Shortcode gallery',
				'post_content' => '[gallery ids="' . $first . ',' . $second . '"]',
			)
		);
	}

	/** An uploaded JPEG attachment. */
	private function image(): int {
		$file  = wp_tempnam( 'fg-migration.jpg' );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( 'fg-migration.jpg', null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	/**
	 * Scan, then import every gallery the scan offers.
	 *
	 * @return array{imported:int, skipped:int}
	 */
	private function scan_and_import( string $conflict ): array {
		$scan = new WP_REST_Request( 'GET', '/fotogrids/v1/admin/tools/migration/scan' );
		$scan->set_param( 'source', 'wp-core' );
		$found = rest_get_server()->dispatch( $scan );
		$this->assertSame( 200, $found->get_status() );

		$refs = wp_list_pluck( $found->get_data()['galleries'], 'ref' );
		$this->assertCount( 2, $refs );

		$import = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/migration/import' );
		$import->set_param( 'source', 'wp-core' );
		$import->set_param( 'refs', $refs );
		$import->set_param( 'conflict', $conflict );
		$result = rest_get_server()->dispatch( $import );
		$this->assertSame( 200, $result->get_status() );

		$data = $result->get_data();

		return array(
			'imported' => $data['imported'],
			'skipped'  => $data['skipped'],
		);
	}

	/** Galleries on the site, the Trash excluded. */
	private function gallery_count(): int {
		return count(
			get_posts(
				array(
					'post_type'      => 'fotogrids_gallery',
					'post_status'    => 'any',
					'fields'         => 'ids',
					'posts_per_page' => -1,
				)
			)
		);
	}

	public function test_skip_does_not_import_the_same_galleries_again(): void {
		$this->assertSame( array( 'imported' => 2, 'skipped' => 0 ), $this->scan_and_import( 'skip' ) );
		$this->assertSame( array( 'imported' => 0, 'skipped' => 2 ), $this->scan_and_import( 'skip' ) );
		$this->assertSame( 2, $this->gallery_count() );
	}

	public function test_duplicate_imports_the_same_galleries_again(): void {
		$this->assertSame( array( 'imported' => 2, 'skipped' => 0 ), $this->scan_and_import( 'skip' ) );
		$this->assertSame( array( 'imported' => 2, 'skipped' => 0 ), $this->scan_and_import( 'duplicate' ) );
		$this->assertSame( 4, $this->gallery_count() );
	}

	public function test_a_first_import_with_duplicate_is_recognised_by_a_later_skip(): void {
		$this->assertSame( array( 'imported' => 2, 'skipped' => 0 ), $this->scan_and_import( 'duplicate' ) );
		$this->assertSame( array( 'imported' => 0, 'skipped' => 2 ), $this->scan_and_import( 'skip' ) );
		$this->assertSame( 2, $this->gallery_count() );
	}

	public function test_a_trashed_gallery_is_imported_again_with_skip(): void {
		$this->scan_and_import( 'skip' );

		foreach ( get_posts( array( 'post_type' => 'fotogrids_gallery', 'fields' => 'ids', 'posts_per_page' => -1 ) ) as $id ) {
			wp_trash_post( $id );
		}

		$this->assertSame( array( 'imported' => 2, 'skipped' => 0 ), $this->scan_and_import( 'skip' ) );
		$this->assertSame( 2, $this->gallery_count() );
	}
}
