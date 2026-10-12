<?php
/**
 * What GET /album/{id} and GET /gallery/{id} report about album membership.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Gallery_Album_Relations;

class AlbumRestReadTest extends WP_UnitTestCase {

	private int $attachment;

	public function set_up(): void {
		parent::set_up();

		$this->attachment = self::factory()->attachment->create_object(
			array(
				'file'           => 'album-rest.jpg',
				'post_mime_type' => 'image/jpeg',
			)
		);
	}

	private function gallery( string $status = 'publish' ): int {
		$id = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => $status,
			)
		);
		Gallery_Repository::set_item_ids( $id, array( $this->attachment ) );

		return $id;
	}

	/** An album holding the given galleries, at the positions listed. */
	private function album( array $children, string $status = 'publish' ): int {
		$album = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_album',
				'post_status' => $status,
			)
		);
		foreach ( $children as $position => $gallery ) {
			Gallery_Album_Relations::add_gallery_to_album( $gallery, $album, $position );
		}

		return $album;
	}

	private function get( string $route ): WP_REST_Response {
		return rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/fotogrids/v1' . $route ) );
	}

	/** Gallery IDs the album route lists, in response order. */
	private function listed( int $album ): array {
		$response = $this->get( "/album/$album" );
		$this->assertSame( 200, $response->get_status() );

		return array_column( $response->get_data()['galleries'], 'id' );
	}

	public function test_lists_the_album_galleries_in_album_order(): void {
		$first  = $this->gallery();
		$second = $this->gallery();
		$third  = $this->gallery();
		$album  = $this->album( array( $third, $first, $second ) );
		$this->album( array( $this->gallery() ) );

		$this->assertSame( array( $third, $first, $second ), $this->listed( $album ) );
	}

	public function test_lists_each_gallery_with_its_summary_fields(): void {
		$gallery = $this->gallery();
		$album   = $this->album( array( $gallery ) );

		$listed = $this->get( "/album/$album" )->get_data()['galleries'][0];

		$this->assertSame( array( 'id', 'title', 'description', 'thumbnail', 'item_count' ), array_keys( $listed ) );
		$this->assertSame( 1, $listed['item_count'] );
	}

	public function test_a_visitor_sees_only_the_galleries_they_can_read(): void {
		$published = $this->gallery();
		$draft     = $this->gallery( 'draft' );
		$private   = $this->gallery( 'private' );
		$album     = $this->album( array( $draft, $published, $private ) );

		wp_set_current_user( 0 );
		$this->assertSame( array( $published ), $this->listed( $album ) );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$this->assertSame( array( $published ), $this->listed( $album ) );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->assertSame( array( $draft, $published, $private ), $this->listed( $album ) );
	}

	public function test_an_album_for_registered_users_is_refused_to_guests(): void {
		$gallery = $this->gallery();
		$album   = $this->album( array( $gallery ) );
		update_post_meta( $album, 'fotogrids_who_can_view', 'registered_users' );

		wp_set_current_user( 0 );
		$response = $this->get( "/album/$album" );
		$this->assertSame( 401, $response->get_status() );
		$this->assertSame( 'fotogrids_album_locked', $response->get_data()['code'] );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$this->assertSame( array( $gallery ), $this->listed( $album ) );
	}

	public function test_unpublished_and_missing_albums_keep_their_errors(): void {
		$draft = $this->album( array( $this->gallery() ), 'draft' );

		$response = $this->get( "/album/$draft" );
		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( 'album_not_published', $response->get_data()['code'] );

		$response = $this->get( '/album/' . ( $draft + 1000 ) );
		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( 'album_not_found', $response->get_data()['code'] );
	}

	public function test_gallery_route_carries_no_album_id(): void {
		$gallery = $this->gallery();
		$this->album( array( $gallery ) );
		update_post_meta( $gallery, 'fotogrids_album_id', 123 );

		$response = $this->get( "/gallery/$gallery" );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( array( 'layout', 'columns' ), array_keys( $response->get_data()['meta'] ) );
	}
}
