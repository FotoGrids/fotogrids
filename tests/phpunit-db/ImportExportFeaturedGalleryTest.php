<?php
/**
 * Import / Export carries an album's featured gallery to this site's galleries.
 *
 * @package FotoGrids
 */

use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Post_Types;
use FotoGrids\Tools\ImportExport\Import_Export_Data;

class ImportExportFeaturedGalleryTest extends WP_UnitTestCase {

	private const ELSEWHERE = 'https://elsewhere.example';

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

	private function local( string $post_type, string $slug ): int {
		return self::factory()->post->create(
			array(
				'post_type'   => $post_type,
				'post_status' => 'publish',
				'post_title'  => ucfirst( $slug ),
				'post_name'   => $slug,
			)
		);
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

	/**
	 * An export file.
	 *
	 * @param string                       $site_url  Exporting site.
	 * @param array<int, array>            $galleries Gallery rows.
	 * @param array<int, array>            $albums    Album rows.
	 * @param array<int, array<int, int>>  $children  Album ID => gallery IDs, in order.
	 */
	private function file( string $site_url, array $galleries, array $albums, array $children ): string {
		$relations = array();
		foreach ( $children as $album_id => $gallery_ids ) {
			foreach ( $gallery_ids as $position => $gallery_id ) {
				$relations[] = array(
					'gallery_id' => $gallery_id,
					'album_id'   => $album_id,
					'position'   => $position,
				);
			}
		}

		return (string) wp_json_encode(
			array(
				'meta'           => array(
					'version'  => '1.3.0',
					'site_url' => $site_url,
				),
				'galleries'      => $galleries,
				'albums'         => $albums,
				'gallery_albums' => $relations,
			)
		);
	}

	private function import( string $file, string $mode, array $include = array( 'galleries', 'albums' ) ): void {
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', 'execute' );
		$request->set_param( 'file', $file );
		$request->set_param( 'include', $include );
		$request->set_param( 'galleries', $mode );
		$request->set_param( 'albums', $mode );

		$this->assertSame( 200, Import_Export_Data::import( $request )->get_status() );
	}

	private function export(): string {
		$method = new ReflectionMethod( Import_Export_Data::class, 'collect_export_data' );
		$method->setAccessible( true );

		return (string) wp_json_encode( $method->invoke( null, array( 'galleries', 'albums' ) ) );
	}

	/** IDs of a type's posts with this slug, oldest first; duplicates take a suffixed slug. */
	private function ids( string $post_type, string $title ): array {
		return wp_list_pluck(
			get_posts(
				array(
					'post_type'   => $post_type,
					'title'       => $title,
					'numberposts' => -1,
					'orderby'     => 'ID',
					'order'       => 'ASC',
				)
			),
			'ID'
		);
	}

	private function id( string $post_type, string $slug ): int {
		$post = get_page_by_path( $slug, OBJECT, $post_type );
		$this->assertNotNull( $post, "no $post_type '$slug'" );

		return (int) $post->ID;
	}

	private function picked( int $album ): string {
		return (string) get_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, true );
	}

	public function test_the_featured_gallery_takes_its_id_on_this_site(): void {
		$this->import(
			$this->file(
				self::ELSEWHERE,
				array( $this->row( 9001, 'imp-harbour' ), $this->row( 9002, 'imp-market' ) ),
				array( $this->row( 9050, 'imp-coast', array( Post_Types::FEATURED_GALLERY_META_KEY => 9002 ) ) ),
				array( 9050 => array( 9001, 9002 ) )
			),
			'skip'
		);

		$album = $this->id( Post_Types::ALBUM, 'imp-coast' );
		$this->assertSame( (string) $this->id( Post_Types::GALLERY, 'imp-market' ), $this->picked( $album ) );
	}

	public function test_an_id_from_another_site_never_names_a_local_gallery(): void {
		$unrelated = $this->local( Post_Types::GALLERY, 'imp-unrelated' );

		$this->import(
			$this->file(
				self::ELSEWHERE,
				array(),
				array( $this->row( 9051, 'imp-shore', array( Post_Types::FEATURED_GALLERY_META_KEY => $unrelated ) ) ),
				array()
			),
			'skip',
			array( 'albums' )
		);

		$album = $this->id( Post_Types::ALBUM, 'imp-shore' );
		$this->assertSame( '', $this->picked( $album ) );

		Gallery_Album_Relations::add_gallery_to_album( $unrelated, $album );
		$this->assertSame( '', $this->picked( $album ) );
	}

	public function test_albums_written_back_onto_the_site_that_exported_them_keep_the_pick(): void {
		$gallery = $this->local( Post_Types::GALLERY, 'imp-own-gallery' );
		$album   = $this->local( Post_Types::ALBUM, 'imp-own-album' );
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $album );
		update_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, $gallery );
		$file = $this->export();

		$this->import( $file, 'overwrite', array( 'albums' ) );

		$this->assertSame( (string) $gallery, $this->picked( $album ) );
	}

	public function test_a_skipped_gallery_is_featured_through_the_gallery_it_matched(): void {
		$existing = $this->local( Post_Types::GALLERY, 'imp-existing' );

		$this->import(
			$this->file(
				self::ELSEWHERE,
				array( $this->row( 9003, 'imp-existing' ) ),
				array( $this->row( 9052, 'imp-bay', array( Post_Types::FEATURED_GALLERY_META_KEY => 9003 ) ) ),
				array( 9052 => array( 9003 ) )
			),
			'skip'
		);

		$this->assertSame( (string) $existing, $this->picked( $this->id( Post_Types::ALBUM, 'imp-bay' ) ) );
	}

	public function test_an_overwritten_album_takes_the_pick_from_the_file(): void {
		$local_gallery = $this->local( Post_Types::GALLERY, 'imp-local-pick' );
		$album         = $this->local( Post_Types::ALBUM, 'imp-cliffs' );
		Gallery_Album_Relations::add_gallery_to_album( $local_gallery, $album );
		update_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, $local_gallery );

		$this->import(
			$this->file(
				self::ELSEWHERE,
				array( $this->row( 9004, 'imp-incoming' ) ),
				array( $this->row( 9053, 'imp-cliffs', array( Post_Types::FEATURED_GALLERY_META_KEY => 9004 ) ) ),
				array( 9053 => array( 9004 ) )
			),
			'overwrite'
		);

		$this->assertSame( (string) $this->id( Post_Types::GALLERY, 'imp-incoming' ), $this->picked( $album ) );
	}

	public function test_a_duplicated_album_features_the_duplicated_gallery(): void {
		$gallery = $this->local( Post_Types::GALLERY, 'imp-twin' );
		$album   = $this->local( Post_Types::ALBUM, 'imp-twins' );
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $album );
		update_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, $gallery );

		$this->import( $this->export(), 'duplicate' );

		$galleries = $this->ids( Post_Types::GALLERY, 'Imp-twin' );
		$albums    = $this->ids( Post_Types::ALBUM, 'Imp-twins' );
		$this->assertCount( 2, $galleries );
		$this->assertCount( 2, $albums );
		$this->assertSame( (string) $gallery, $this->picked( $albums[0] ) );
		$this->assertSame( (string) $galleries[1], $this->picked( $albums[1] ) );
	}

	public function test_a_stale_pick_in_the_file_is_dropped(): void {
		$this->import(
			$this->file(
				self::ELSEWHERE,
				array( $this->row( 9005, 'imp-inside' ), $this->row( 9006, 'imp-outside' ) ),
				array( $this->row( 9054, 'imp-dunes', array( Post_Types::FEATURED_GALLERY_META_KEY => 9006 ) ) ),
				array( 9054 => array( 9005 ) )
			),
			'skip'
		);

		$this->assertSame( '', $this->picked( $this->id( Post_Types::ALBUM, 'imp-dunes' ) ) );
	}

	public function test_a_pick_missing_from_the_file_is_dropped(): void {
		$this->import(
			$this->file(
				self::ELSEWHERE,
				array( $this->row( 9007, 'imp-only' ) ),
				array( $this->row( 9055, 'imp-reef', array( Post_Types::FEATURED_GALLERY_META_KEY => 9099 ) ) ),
				array( 9055 => array( 9007 ) )
			),
			'skip'
		);

		$this->assertSame( '', $this->picked( $this->id( Post_Types::ALBUM, 'imp-reef' ) ) );
	}

	public function test_an_album_without_a_pick_gets_none(): void {
		$this->import(
			$this->file(
				self::ELSEWHERE,
				array( $this->row( 9008, 'imp-plain' ) ),
				array( $this->row( 9056, 'imp-lagoon' ) ),
				array( 9056 => array( 9008 ) )
			),
			'skip'
		);

		$this->assertFalse( metadata_exists( 'post', $this->id( Post_Types::ALBUM, 'imp-lagoon' ), Post_Types::FEATURED_GALLERY_META_KEY ) );
	}
}
