<?php
/**
 * Import / Export keeps each gallery's and album's post status and date.
 *
 * @package FotoGrids
 */

use FotoGrids\Tools\ImportExport\Import_Export_Data;

class ImportExportStatusTest extends WP_UnitTestCase {

	const STATUSES = array( 'publish', 'future', 'draft', 'pending', 'private' );

	public static function set_up_before_class(): void {
		parent::set_up_before_class();
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
	}

	public function set_up(): void {
		parent::set_up();
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

	private function collection( string $post_type, string $status, string $title ): int {
		$args = array(
			'post_type'   => $post_type,
			'post_status' => $status,
			'post_title'  => $title,
			'post_date'   => '2026-01-02 03:04:05',
		);
		if ( 'future' === $status ) {
			$args['post_date'] = gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS );
		}

		return self::factory()->post->create( $args );
	}

	private function call( string $method, ...$args ) {
		$reflection = new ReflectionMethod( Import_Export_Data::class, $method );
		$reflection->setAccessible( true );
		return $reflection->invoke( null, ...$args );
	}

	private function export(): array {
		return $this->call( 'collect_export_data', array( 'galleries', 'albums' ) );
	}

	private function import( string $file, string $mode ): array {
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', 'execute' );
		$request->set_param( 'file', $file );
		$request->set_param( 'include', array( 'galleries', 'albums' ) );
		$request->set_param( 'galleries', $mode );
		$request->set_param( 'albums', $mode );

		$response = Import_Export_Data::import( $request );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data();
	}

	private function find( string $post_type, string $title ): array {
		return get_posts(
			array(
				'post_type'   => $post_type,
				'post_status' => self::STATUSES,
				'title'       => $title,
				'numberposts' => -1,
				'orderby'     => 'ID',
				'order'       => 'ASC',
			)
		);
	}

	public function test_export_includes_every_status_a_collection_can_have(): void {
		foreach ( self::STATUSES as $status ) {
			$this->collection( 'fotogrids_gallery', $status, "Gallery $status" );
			$this->collection( 'fotogrids_album', $status, "Album $status" );
		}
		$this->collection( 'fotogrids_gallery', 'trash', 'Gallery trash' );
		$this->collection( 'fotogrids_gallery', 'auto-draft', 'Gallery auto-draft' );

		$data = $this->export();

		$this->assertEqualSets( self::STATUSES, array_column( $data['galleries'], 'status' ) );
		$this->assertEqualSets( self::STATUSES, array_column( $data['albums'], 'status' ) );
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
	public function test_an_import_restores_each_status_and_date( string $serialiser ): void {
		$dates = array();
		foreach ( self::STATUSES as $status ) {
			foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
				$id                            = $this->collection( $post_type, $status, "$post_type $status" );
				$dates[ "$post_type $status" ] = get_post( $id )->post_date;
			}
		}

		$file = $this->call( $serialiser, $this->export() );
		foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
			foreach ( $this->find( $post_type, '' ) as $post ) {
				wp_delete_post( $post->ID, true );
			}
		}

		$result = $this->import( $file, 'skip' );
		$this->assertSame( 5, $result['imported']['galleries'] );
		$this->assertSame( 5, $result['imported']['albums'] );

		foreach ( self::STATUSES as $status ) {
			foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
				$posts = $this->find( $post_type, "$post_type $status" );
				$this->assertCount( 1, $posts, "$post_type $status" );
				$this->assertSame( $status, $posts[0]->post_status, "$post_type $status" );
				$this->assertSame( $dates[ "$post_type $status" ], $posts[0]->post_date, "$post_type $status" );
			}
		}
	}

	public function test_skip_matches_a_slugless_draft_to_itself(): void {
		$this->collection( 'fotogrids_gallery', 'auto-draft', '' );
		$this->collection( 'fotogrids_gallery', 'draft', 'Other draft' );
		$draft = $this->collection( 'fotogrids_gallery', 'draft', 'My draft' );
		$this->assertSame( '', get_post( $draft )->post_name );

		$result = $this->import( $this->call( 'serialise_json', $this->export() ), 'skip' );

		$this->assertSame( 0, $result['imported']['galleries'] );
		$this->assertSame( 2, $result['skipped']['galleries'] );
		$this->assertCount( 1, $this->find( 'fotogrids_gallery', 'My draft' ) );
		$this->assertCount( 1, $this->find( 'fotogrids_gallery', 'Other draft' ) );
	}

	public function test_overwrite_writes_a_slugless_draft_onto_itself_only(): void {
		$auto_draft = $this->collection( 'fotogrids_gallery', 'auto-draft', '' );
		$other      = $this->collection( 'fotogrids_gallery', 'draft', 'Other draft' );
		$draft      = $this->collection( 'fotogrids_gallery', 'draft', 'My draft' );
		update_post_meta( $draft, 'fotogrids_import_marker', 'before' );

		$data = $this->export();
		foreach ( $data['galleries'] as &$gallery ) {
			if ( $gallery['id'] === $draft ) {
				$gallery['meta']['fotogrids_import_marker'] = 'after';
			}
		}
		unset( $gallery );

		$this->import( $this->call( 'serialise_json', $data ), 'overwrite' );

		$this->assertSame( 'after', get_post_meta( $draft, 'fotogrids_import_marker', true ) );
		$this->assertSame( '', get_post_meta( $other, 'fotogrids_import_marker', true ) );
		$this->assertSame( '', get_post_meta( $auto_draft, 'fotogrids_import_marker', true ) );
	}

	public function test_duplicate_creates_a_second_slugless_draft(): void {
		$this->collection( 'fotogrids_gallery', 'draft', 'My draft' );

		$result = $this->import( $this->call( 'serialise_json', $this->export() ), 'duplicate' );

		$this->assertSame( 1, $result['imported']['galleries'] );
		$copies = $this->find( 'fotogrids_gallery', 'My draft' );
		$this->assertCount( 2, $copies );
		$this->assertSame( 'draft', $copies[1]->post_status );
	}
}
