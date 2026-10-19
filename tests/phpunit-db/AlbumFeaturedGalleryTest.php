<?php
/**
 * An album's featured gallery when its galleries leave, return or are deleted.
 *
 * @package FotoGrids
 */

use FotoGrids\Admin_Init;
use FotoGrids\Galleries\Cover_Resolver;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Hooks\Actions_Album;
use FotoGrids\Post_Types;
use FotoGrids\Tools\ImportExport\Import_Export_Data;

class AlbumFeaturedGalleryTest extends WP_UnitTestCase {

	private int $admin;

	/** @var array<string, int> Gallery IDs by name. */
	private array $galleries = array();

	/** @var array<string, int> Cover attachment IDs by gallery name. */
	private array $covers = array();

	public static function set_up_before_class(): void {
		parent::set_up_before_class();
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-admin-init.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
	}

	public function set_up(): void {
		parent::set_up();

		$this->admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $this->admin );

		foreach ( array( 'first', 'featured', 'other' ) as $name ) {
			$this->galleries[ $name ] = self::factory()->post->create(
				array(
					'post_type'   => Post_Types::GALLERY,
					'post_status' => 'publish',
					'post_title'  => ucfirst( $name ),
				)
			);
			$this->covers[ $name ]    = $this->image( $name );
			Gallery_Repository::set_item_ids( $this->galleries[ $name ], array( $this->covers[ $name ] ) );
		}
	}

	public function tear_down(): void {
		$_REQUEST = array();
		parent::tear_down();
	}

	private function image( string $name ): int {
		$file  = wp_tempnam( "fg-featured-$name.jpg" );
		$image = imagecreatetruecolor( 40, 30 );
		imagejpeg( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( "fg-featured-$name.jpg", null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	/**
	 * An album holding the named galleries in order, featuring one of them.
	 *
	 * @param string[]    $children Gallery names.
	 * @param string|null $featured Gallery name to feature.
	 */
	private function album( array $children, ?string $featured = null ): int {
		$album = self::factory()->post->create(
			array(
				'post_type'   => Post_Types::ALBUM,
				'post_status' => 'publish',
			)
		);
		foreach ( $children as $name ) {
			Gallery_Album_Relations::add_gallery_to_album( $this->galleries[ $name ], $album );
		}
		if ( null !== $featured ) {
			$this->assertSame( 200, $this->feature( $album, $this->galleries[ $featured ] )->get_status() );
		}

		return $album;
	}

	private function feature( int $album, int $gallery ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', "/fotogrids/v1/album/$album/featured-gallery" );
		$request->set_param( 'gallery_id', $gallery );

		return rest_get_server()->dispatch( $request );
	}

	private function picked( int $album ): string {
		return (string) get_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, true );
	}

	/** DELETE /admin/albums/{album}/galleries/{gallery} — the album editor's ✕. */
	private function remove_in_album_editor( int $album, string $gallery ): WP_REST_Response {
		return rest_get_server()->dispatch(
			new WP_REST_Request( 'DELETE', "/fotogrids/v1/admin/albums/$album/galleries/{$this->galleries[ $gallery ]}" )
		);
	}

	/** DELETE /admin/galleries/{gallery}/albums/{album} — the gallery editor's Albums box. */
	private function remove_in_gallery_editor( int $album, string $gallery ): WP_REST_Response {
		return rest_get_server()->dispatch(
			new WP_REST_Request( 'DELETE', "/fotogrids/v1/admin/galleries/{$this->galleries[ $gallery ]}/albums/$album" )
		);
	}

	private function add_in_album_editor( int $album, string $gallery ): void {
		$request = new WP_REST_Request( 'POST', "/fotogrids/v1/admin/albums/$album/galleries" );
		$request->set_param( 'gallery_ids', array( $this->galleries[ $gallery ] ) );
		$this->assertSame( 200, rest_get_server()->dispatch( $request )->get_status() );
	}

	private function add_in_gallery_editor( int $album, string $gallery ): void {
		$request = new WP_REST_Request( 'POST', "/fotogrids/v1/admin/galleries/{$this->galleries[ $gallery ]}/albums" );
		$request->set_param( 'album_ids', array( $album ) );
		$this->assertSame( 200, rest_get_server()->dispatch( $request )->get_status() );
	}

	/** The Galleries list bulk action. */
	private function bulk( string $action, string $gallery, int $album = 0 ): void {
		$_REQUEST['_wpnonce'] = wp_create_nonce( 'bulk-posts' );
		if ( $album ) {
			$_REQUEST['album_id'] = (string) $album;
		}
		Admin_Init::handle_gallery_bulk_actions( admin_url( 'edit.php' ), $action, array( $this->galleries[ $gallery ] ) );
	}

	private function featured_in_rest( int $album ): ?int {
		$response = rest_get_server()->dispatch( new WP_REST_Request( 'GET', "/fotogrids/v1/album/$album" ) );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data()['meta']['featured_gallery'] ?? null;
	}

	public function test_removing_the_featured_gallery_in_the_album_editor_clears_it(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );

		$this->assertSame( 200, $this->remove_in_album_editor( $album, 'featured' )->get_status() );

		$this->assertSame( '', $this->picked( $album ) );
		$this->assertNull( $this->featured_in_rest( $album ) );
		$this->assertSame( $this->covers['first'], Cover_Resolver::for_album( $album ) );
	}

	public function test_removing_the_featured_gallery_in_the_gallery_editor_clears_it(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );

		$this->assertSame( 200, $this->remove_in_gallery_editor( $album, 'featured' )->get_status() );

		$this->assertSame( '', $this->picked( $album ) );
		$this->assertSame( $this->covers['first'], Cover_Resolver::for_album( $album ) );
	}

	public function test_the_bulk_action_clears_it_in_every_album(): void {
		$one = $this->album( array( 'first', 'featured' ), 'featured' );
		$two = $this->album( array( 'featured', 'other' ), 'featured' );

		$this->bulk( 'remove_from_albums', 'featured' );

		$this->assertSame( '', $this->picked( $one ) );
		$this->assertSame( '', $this->picked( $two ) );
	}

	public function test_an_album_left_empty_falls_back_to_its_own_share_image(): void {
		$album = $this->album( array( 'featured' ), 'featured' );
		$own   = $this->image( 'own' );
		update_post_meta( $album, Post_Types::FEATURED_IMAGE_META_KEY, $own );

		$this->remove_in_album_editor( $album, 'featured' );

		$this->assertSame( '', $this->picked( $album ) );
		$this->assertSame( $own, Cover_Resolver::for_album( $album ) );
	}

	public function test_an_album_left_empty_has_no_cover(): void {
		$album = $this->album( array( 'featured' ), 'featured' );

		$this->remove_in_album_editor( $album, 'featured' );

		$this->assertSame( 0, Cover_Resolver::for_album( $album ) );
	}

	public function test_the_cover_changes_straight_after_the_removal(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		$this->assertSame( $this->covers['featured'], Cover_Resolver::for_album( $album ) );

		$this->remove_in_album_editor( $album, 'featured' );

		$this->assertSame( $this->covers['first'], Cover_Resolver::for_album( $album ) );
		$this->assertSame( $this->covers['first'], Cover_Resolver::descriptor_for_album( $album )['id'] );
	}

	public function test_a_removal_listener_already_sees_no_featured_gallery(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		$seen  = null;
		$watch = function ( $gallery_id, $album_id ) use ( &$seen ): void {
			$seen = $this->picked( (int) $album_id );
		};
		add_action( Actions_Album::GALLERY_REMOVED, $watch, 10, 2 );

		$this->remove_in_album_editor( $album, 'featured' );
		remove_action( Actions_Album::GALLERY_REMOVED, $watch, 10 );

		$this->assertSame( '', $seen );
	}

	public function test_a_gallery_added_back_in_the_album_editor_is_not_featured(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		$this->remove_in_album_editor( $album, 'featured' );

		$this->add_in_album_editor( $album, 'featured' );

		$this->assertSame( '', $this->picked( $album ) );
		$this->assertSame( $this->covers['first'], Cover_Resolver::for_album( $album ) );
	}

	public function test_a_gallery_added_back_in_the_gallery_editor_is_not_featured(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		$this->remove_in_gallery_editor( $album, 'featured' );

		$this->add_in_gallery_editor( $album, 'featured' );

		$this->assertSame( '', $this->picked( $album ) );
		$this->assertSame( $this->covers['first'], Cover_Resolver::for_album( $album ) );
	}

	public function test_a_gallery_added_back_by_the_bulk_action_is_not_featured(): void {
		$one = $this->album( array( 'first', 'featured' ), 'featured' );
		$this->bulk( 'remove_from_albums', 'featured' );

		$this->bulk( 'assign_to_album', 'featured', $one );

		$this->assertSame( '', $this->picked( $one ) );
	}

	public function test_a_gallery_featured_again_after_returning_is_honoured(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		$this->remove_in_album_editor( $album, 'featured' );
		$this->add_in_album_editor( $album, 'featured' );

		$this->assertSame( 200, $this->feature( $album, $this->galleries['featured'] )->get_status() );

		$this->assertSame( $this->covers['featured'], Cover_Resolver::for_album( $album ) );
	}

	public function test_removing_another_gallery_keeps_the_featured_one(): void {
		$album = $this->album( array( 'first', 'featured', 'other' ), 'featured' );

		$this->remove_in_album_editor( $album, 'other' );
		$this->remove_in_gallery_editor( $album, 'first' );

		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $album ) );
		$this->assertSame( $this->galleries['featured'], $this->featured_in_rest( $album ) );
		$this->assertSame( $this->covers['featured'], Cover_Resolver::for_album( $album ) );
	}

	public function test_the_bulk_action_keeps_a_featured_gallery_it_does_not_remove(): void {
		$featuring_it = $this->album( array( 'first', 'other' ), 'other' );
		$plain_child  = $this->album( array( 'other', 'featured' ), 'featured' );

		$this->bulk( 'remove_from_albums', 'other' );

		$this->assertSame( '', $this->picked( $featuring_it ) );
		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $plain_child ) );
	}

	public function test_removing_a_gallery_that_is_not_in_the_album_keeps_the_featured_one(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );

		$this->remove_in_album_editor( $album, 'other' );

		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $album ) );
	}

	public function test_a_failed_removal_keeps_the_featured_gallery(): void {
		global $wpdb;

		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		$break = static function ( $query ) use ( $wpdb ) {
			return 0 === strpos( $query, "DELETE FROM `{$wpdb->prefix}fotogrids_gallery_albums`" ) ? 'DELETE FROM fg_no_such_table' : $query;
		};
		add_filter( 'query', $break );
		$errors = $wpdb->suppress_errors( true );

		$response = $this->remove_in_album_editor( $album, 'featured' );

		$wpdb->suppress_errors( $errors );
		remove_filter( 'query', $break );

		$this->assertSame( 500, $response->get_status() );
		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $album ) );
	}

	public function test_removing_from_an_album_without_a_featured_gallery_writes_none(): void {
		$album = $this->album( array( 'first', 'featured' ) );

		$this->remove_in_album_editor( $album, 'featured' );

		$this->assertFalse( metadata_exists( 'post', $album, Post_Types::FEATURED_GALLERY_META_KEY ) );
	}

	public function test_reordering_keeps_the_featured_gallery(): void {
		$album   = $this->album( array( 'first', 'featured', 'other' ), 'featured' );
		$request = new WP_REST_Request( 'POST', "/fotogrids/v1/admin/albums/$album/galleries/reorder" );
		$request->set_param( 'gallery_ids', array( $this->galleries['other'], $this->galleries['featured'], $this->galleries['first'] ) );

		$this->assertSame( 200, rest_get_server()->dispatch( $request )->get_status() );

		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $album ) );
	}

	public function test_trashing_and_restoring_the_featured_gallery_keeps_it(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );

		wp_trash_post( $this->galleries['featured'] );
		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $album ) );

		wp_untrash_post( $this->galleries['featured'] );
		wp_publish_post( $this->galleries['featured'] );

		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $album ) );
		$this->assertSame( $this->covers['featured'], Cover_Resolver::for_album( $album ) );
	}

	public function test_deleting_the_featured_gallery_clears_it_only_where_it_was_featured(): void {
		$featuring_it = $this->album( array( 'first', 'featured' ), 'featured' );
		$plain_child  = $this->album( array( 'featured', 'other' ), 'other' );

		wp_delete_post( $this->galleries['featured'], true );

		$this->assertSame( '', $this->picked( $featuring_it ) );
		$this->assertSame( (string) $this->galleries['other'], $this->picked( $plain_child ) );
		$this->assertSame( $this->covers['first'], Cover_Resolver::for_album( $featuring_it ) );
	}

	public function test_a_gallery_outside_the_album_cannot_be_featured(): void {
		$album = $this->album( array( 'first' ) );

		$response = $this->feature( $album, $this->galleries['other'] );

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'fotogrids_gallery_not_in_album', $response->get_data()['code'] );
		$this->assertSame( '', $this->picked( $album ) );
	}

	public function test_a_user_who_cannot_edit_the_album_leaves_the_featured_gallery_alone(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$this->assertSame( 403, $this->remove_in_album_editor( $album, 'featured' )->get_status() );
		$this->assertSame( 403, $this->remove_in_gallery_editor( $album, 'featured' )->get_status() );

		$this->assertSame( (string) $this->galleries['featured'], $this->picked( $album ) );
	}

	public function test_an_export_after_the_removal_carries_no_featured_gallery(): void {
		$album = $this->album( array( 'first', 'featured' ), 'featured' );
		$this->remove_in_album_editor( $album, 'featured' );

		$method = new ReflectionMethod( Import_Export_Data::class, 'collect_export_data' );
		$method->setAccessible( true );
		$data = $method->invoke( null, array( 'galleries', 'albums' ) );

		$exported = array_values( array_filter( $data['albums'], static fn( $row ) => $album === (int) $row['id'] ) );
		$this->assertArrayNotHasKey( Post_Types::FEATURED_GALLERY_META_KEY, $exported[0]['meta'] );
	}
}
