<?php
/**
 * Editing and deleting one's own published gallery or album with the type's
 * edit and delete capabilities, for a role built without the published-state
 * ones.
 *
 * @package FotoGrids
 */

use FotoGrids\Permissions\Published_Collection_Caps;
use FotoGrids\REST\Album\Album_Permissions;
use FotoGrids\REST\Gallery\Gallery_Permissions;

class PublishedCollectionCapsTest extends WP_UnitTestCase {

	private const NAMES = array(
		'fotogrids_gallery' => array( 'gallery', 'galleries' ),
		'fotogrids_album'   => array( 'album', 'albums' ),
	);

	private int $admin;

	public function set_up(): void {
		parent::set_up();

		$this->admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
	}

	/** A subscriber granted exactly $caps. */
	private function user_with( array $caps ): int {
		$id   = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$user = get_user_by( 'id', $id );
		foreach ( $caps as $cap ) {
			$user->add_cap( $cap );
		}

		return $id;
	}

	/** The caps of one collection type, without the published-state and others' caps. */
	private function one_type_caps( string $type ): array {
		list( $one, $many ) = self::NAMES[ $type ];

		return array(
			"edit_fotogrids_{$one}",
			"read_fotogrids_{$one}",
			"delete_fotogrids_{$one}",
			"edit_fotogrids_{$many}",
			"publish_fotogrids_{$many}",
			"delete_fotogrids_{$many}",
		);
	}

	private function one_type_user( string $type, array $without = array(), array $with = array() ): int {
		return $this->user_with( array_merge( array_diff( $this->one_type_caps( $type ), $without ), $with ) );
	}

	/** A collection of $type owned by $author; 'trash' is trashed after publishing. */
	private function collection( string $type, int $author, string $status = 'publish' ): int {
		$args = array(
			'post_type'   => $type,
			'post_author' => $author,
			'post_status' => 'trash' === $status ? 'publish' : $status,
		);
		if ( 'future' === $status ) {
			$args['post_date'] = gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS );
		}

		$id = self::factory()->post->create( $args );
		if ( 'trash' === $status ) {
			wp_trash_post( $id );
		}

		$this->assertSame( $status, get_post_status( $id ) );

		return $id;
	}

	private function request( int $id, string $method = 'POST' ): WP_REST_Request {
		$request = new WP_REST_Request( $method );
		$request->set_param( 'id', $id );

		return $request;
	}

	public function types(): array {
		return array(
			'gallery' => array( 'fotogrids_gallery' ),
			'album'   => array( 'fotogrids_album' ),
		);
	}

	public function types_and_published_states(): array {
		$cases = array();
		foreach ( array_keys( self::NAMES ) as $type ) {
			foreach ( array( 'publish', 'future', 'trash' ) as $status ) {
				$cases[ "$type $status" ] = array( $type, $status );
			}
		}

		return $cases;
	}

	/**
	 * @dataProvider types_and_published_states
	 */
	public function test_own_published_collection_is_editable_and_deletable( string $type, string $status ): void {
		$user = $this->one_type_user( $type );
		$id   = $this->collection( $type, $user, $status );

		$this->assertTrue( user_can( $user, 'edit_post', $id ) );
		$this->assertTrue( user_can( $user, 'delete_post', $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_own_draft_is_editable_and_deletable( string $type ): void {
		$user = $this->one_type_user( $type );
		$id   = $this->collection( $type, $user, 'draft' );

		$this->assertTrue( user_can( $user, 'edit_post', $id ) );
		$this->assertTrue( user_can( $user, 'delete_post', $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_published_caps_are_replaced_by_the_type_caps( string $type ): void {
		list( , $many ) = self::NAMES[ $type ];

		$user = $this->one_type_user( $type );
		$id   = $this->collection( $type, $user );

		$this->assertSame( array( "edit_fotogrids_{$many}" ), map_meta_cap( 'edit_post', $user, $id ) );
		$this->assertSame( array( "delete_fotogrids_{$many}" ), map_meta_cap( 'delete_post', $user, $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_a_user_holding_the_published_caps_keeps_them( string $type ): void {
		list( , $many ) = self::NAMES[ $type ];

		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->collection( $type, $author );

		$this->assertSame( array( "edit_published_fotogrids_{$many}" ), map_meta_cap( 'edit_post', $author, $id ) );
		$this->assertSame( array( "delete_published_fotogrids_{$many}" ), map_meta_cap( 'delete_post', $author, $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_published_caps_alone_still_cover_own_published_collection( string $type ): void {
		list( , $many ) = self::NAMES[ $type ];

		$user = $this->user_with( array( "edit_published_fotogrids_{$many}", "delete_published_fotogrids_{$many}" ) );
		$id   = $this->collection( $type, $user );

		$this->assertTrue( user_can( $user, 'edit_post', $id ) );
		$this->assertTrue( user_can( $user, 'delete_post', $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_the_edit_link_resolves_for_own_published_collection( string $type ): void {
		$user = $this->one_type_user( $type );
		$id   = $this->collection( $type, $user );

		wp_set_current_user( $user );

		$this->assertStringContainsString( "post=$id", (string) get_edit_post_link( $id, 'url' ) );
	}

	public function test_plugin_rest_edit_checks_pass_for_own_published_collections(): void {
		$gallery_user = $this->one_type_user( 'fotogrids_gallery' );
		$gallery      = $this->collection( 'fotogrids_gallery', $gallery_user );
		$album_user   = $this->one_type_user( 'fotogrids_album' );
		$album        = $this->collection( 'fotogrids_album', $album_user );

		wp_set_current_user( $gallery_user );
		$this->assertTrue( Gallery_Permissions::check_featured_item_write( $this->request( $gallery ) ) );

		wp_set_current_user( $album_user );
		$this->assertTrue( Album_Permissions::check_featured_gallery_write( $this->request( $album ) ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_core_rest_updates_and_trashes_own_published_collection( string $type ): void {
		$user = $this->one_type_user( $type );
		$id   = $this->collection( $type, $user );
		$base = get_post_type_object( $type )->rest_base;

		wp_set_current_user( $user );

		$update = new WP_REST_Request( 'POST', "/wp/v2/$base/$id" );
		$update->set_param( 'title', 'Renamed' );
		$response = rest_do_request( $update );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'Renamed', get_post( $id )->post_title );

		$response = rest_do_request( new WP_REST_Request( 'DELETE', "/wp/v2/$base/$id" ) );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'trash', get_post_status( $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_another_users_published_collection_stays_refused( string $type ): void {
		list( , $many ) = self::NAMES[ $type ];

		$user  = $this->one_type_user( $type );
		$other = $this->collection( $type, $this->admin );

		$this->assertFalse( user_can( $user, 'edit_post', $other ) );
		$this->assertFalse( user_can( $user, 'delete_post', $other ) );

		$editor_of_others = $this->one_type_user( $type, array(), array( "edit_others_fotogrids_{$many}", "delete_others_fotogrids_{$many}" ) );

		$this->assertFalse( user_can( $editor_of_others, 'edit_post', $other ) );
		$this->assertFalse( user_can( $editor_of_others, 'delete_post', $other ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_the_other_collection_type_stays_refused( string $type ): void {
		$other_type = 'fotogrids_gallery' === $type ? 'fotogrids_album' : 'fotogrids_gallery';

		$user = $this->one_type_user( $type );
		$id   = $this->collection( $other_type, $user );

		$this->assertFalse( user_can( $user, 'edit_post', $id ) );
		$this->assertFalse( user_can( $user, 'delete_post', $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_without_the_delete_cap_own_published_collection_cannot_be_deleted( string $type ): void {
		list( , $many ) = self::NAMES[ $type ];

		$user = $this->one_type_user( $type, array( "delete_fotogrids_{$many}" ) );
		$id   = $this->collection( $type, $user );

		$this->assertTrue( user_can( $user, 'edit_post', $id ) );
		$this->assertFalse( user_can( $user, 'delete_post', $id ) );
	}

	/**
	 * @dataProvider types
	 */
	public function test_without_the_edit_cap_own_published_collection_cannot_be_edited( string $type ): void {
		list( , $many ) = self::NAMES[ $type ];

		$user = $this->one_type_user( $type, array( "edit_fotogrids_{$many}" ) );
		$id   = $this->collection( $type, $user );

		$this->assertFalse( user_can( $user, 'edit_post', $id ) );
		$this->assertTrue( user_can( $user, 'delete_post', $id ) );
	}

	public function test_core_posts_are_unchanged(): void {
		$user = $this->user_with( array( 'edit_posts', 'publish_posts', 'delete_posts' ) );
		$id   = self::factory()->post->create(
			array(
				'post_author' => $user,
				'post_status' => 'publish',
			)
		);

		$this->assertSame( array( 'edit_published_posts' ), map_meta_cap( 'edit_post', $user, $id ) );
		$this->assertFalse( user_can( $user, 'edit_post', $id ) );
		$this->assertFalse( user_can( $user, 'delete_post', $id ) );
	}

	public function roles(): array {
		return array(
			'administrator, own'   => array( 'administrator', true, true, true ),
			'administrator, other' => array( 'administrator', false, true, true ),
			'editor, other'        => array( 'editor', false, true, true ),
			'author, own'          => array( 'author', true, true, true ),
			'author, other'        => array( 'author', false, false, false ),
			'contributor, own'     => array( 'contributor', true, false, false ),
			'subscriber, own'      => array( 'subscriber', true, false, false ),
		);
	}

	/**
	 * @dataProvider roles
	 */
	public function test_default_roles_are_unchanged( string $role, bool $own, bool $can_edit, bool $can_delete ): void {
		$user = self::factory()->user->create( array( 'role' => $role ) );

		foreach ( array_keys( self::NAMES ) as $type ) {
			$id = $this->collection( $type, $own ? $user : $this->admin );

			$this->assertSame( $can_edit, user_can( $user, 'edit_post', $id ), "$role edit $type" );
			$this->assertSame( $can_delete, user_can( $user, 'delete_post', $id ), "$role delete $type" );
		}
	}

	public function test_the_filter_ignores_what_it_does_not_handle(): void {
		$user    = $this->one_type_user( 'fotogrids_gallery' );
		$gallery = $this->collection( 'fotogrids_gallery', $user );
		$caps    = array( 'edit_published_fotogrids_galleries' );

		$this->assertSame( $caps, Published_Collection_Caps::map_meta_cap( $caps, 'read_post', $user, array( $gallery ) ) );
		$this->assertSame( $caps, Published_Collection_Caps::map_meta_cap( $caps, 'edit_post', $user, array() ) );
		$this->assertSame( $caps, Published_Collection_Caps::map_meta_cap( $caps, 'edit_post', $user, array( PHP_INT_MAX ) ) );
		$this->assertSame( $caps, Published_Collection_Caps::map_meta_cap( $caps, 'edit_post', 0, array( $gallery ) ) );
		$this->assertSame( array( 'do_not_allow' ), Published_Collection_Caps::map_meta_cap( array( 'do_not_allow' ), 'edit_post', $user, array( $gallery ) ) );
	}

	public function test_the_filter_is_registered(): void {
		$this->assertSame( 10, has_filter( 'map_meta_cap', array( Published_Collection_Caps::class, 'map_meta_cap' ) ) );
	}
}
