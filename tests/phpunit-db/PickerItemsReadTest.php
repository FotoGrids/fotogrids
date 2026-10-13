<?php
/**
 * Who may list and preview galleries in the page builders, and what they see.
 *
 * @package FotoGrids
 */

class PickerItemsReadTest extends WP_UnitTestCase {

	/** @var int */
	private $published;

	/** @var int */
	private $private;

	/** @var int */
	private $owner;

	public function set_up(): void {
		parent::set_up();

		$owner           = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->owner     = $owner;
		$this->published = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
				'post_author' => $owner,
			)
		);
		$this->private   = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'private',
				'post_author' => $owner,
			)
		);
	}

	/** A subscriber holding exactly the capabilities given. */
	private function user_with( array $caps ): int {
		$id   = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$user = get_user_by( 'id', $id );
		foreach ( $caps as $cap ) {
			$user->add_cap( $cap );
		}

		return $id;
	}

	private function picker(): WP_REST_Response {
		$request = new WP_REST_Request( 'GET', '/fotogrids/v1/picker/items' );
		$request->set_param( 'type', 'gallery' );

		return rest_get_server()->dispatch( $request );
	}

	/** Listed gallery IDs mapped to their can_edit flag. */
	private function listed(): array {
		$out = array();
		foreach ( $this->picker()->get_data()['items'] as $item ) {
			$out[ $item['id'] ] = $item['can_edit'];
		}

		return $out;
	}

	public function test_a_user_who_cannot_edit_posts_is_refused(): void {
		wp_set_current_user( $this->user_with( array() ) );

		$this->assertSame( 403, $this->picker()->get_status() );
	}

	public function test_a_user_who_can_edit_posts_lists_what_they_can_read_without_edit_rights(): void {
		wp_set_current_user( $this->user_with( array( 'edit_posts' ) ) );

		$this->assertSame( array( $this->published => false ), $this->listed() );
	}

	public function test_a_user_with_gallery_rights_lists_private_galleries_and_can_edit_them(): void {
		wp_set_current_user(
			$this->user_with(
				array(
					'edit_posts',
					'read_private_fotogrids_galleries',
					'edit_fotogrids_galleries',
					'edit_others_fotogrids_galleries',
					'edit_published_fotogrids_galleries',
					'edit_private_fotogrids_galleries',
				)
			)
		);

		$listed = $this->listed();
		ksort( $listed );

		$this->assertSame(
			array(
				$this->published => true,
				$this->private   => true,
			),
			$listed
		);
	}

	private function draft_by( int $author ): int {
		return self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'draft',
				'post_author' => $author,
			)
		);
	}

	public function test_a_contributor_lists_only_galleries_anyone_can_read(): void {
		$this->draft_by( $this->owner );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'contributor' ) ) );

		$this->assertSame( array( $this->published => false ), $this->listed() );
	}

	public function test_a_gallery_author_lists_their_own_drafts_but_not_others(): void {
		$this->draft_by( $this->owner );
		$author = $this->user_with( array( 'edit_posts', 'edit_fotogrids_galleries' ) );
		$own    = $this->draft_by( $author );
		wp_set_current_user( $author );

		$listed = $this->listed();
		ksort( $listed );

		$this->assertSame(
			array(
				$this->published => false,
				$own             => true,
			),
			$listed
		);
	}

	private function preview( int $id ): WP_REST_Response {
		return rest_get_server()->dispatch( new WP_REST_Request( 'POST', '/fotogrids/v1/preview/gallery/' . $id ) );
	}

	private function protect( int $gallery_id ): void {
		$attachment = self::factory()->attachment->create_upload_object( DIR_TESTDATA . '/images/canola.jpg' );
		update_post_meta( $gallery_id, 'fotogrids_gallery_items', wp_json_encode( array( $attachment ) ) );
		update_post_meta( $gallery_id, 'fotogrids_password_protect', '1' );
		// The gate only checks that a ciphertext is stored.
		update_post_meta( $gallery_id, 'fotogrids_password', base64_encode( str_repeat( 'x', 32 ) ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	private function thumb_of( int $id ) {
		foreach ( $this->picker()->get_data()['items'] as $item ) {
			if ( $id === $item['id'] ) {
				return $item['featured_thumb'];
			}
		}

		return false;
	}

	public function test_a_protected_gallery_shows_no_thumbnail_to_users_who_cannot_edit_it(): void {
		$this->protect( $this->published );

		wp_set_current_user( $this->user_with( array( 'edit_posts' ) ) );
		$this->assertNull( $this->thumb_of( $this->published ) );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->assertIsString( $this->thumb_of( $this->published ) );
	}

	public function test_a_user_who_cannot_edit_posts_cannot_preview(): void {
		wp_set_current_user( $this->user_with( array() ) );

		$this->assertSame( 403, $this->preview( $this->published )->get_status() );
	}

	public function test_a_user_who_cannot_read_a_gallery_cannot_preview_it(): void {
		wp_set_current_user( $this->user_with( array( 'edit_posts' ) ) );

		$this->assertSame( 403, $this->preview( $this->private )->get_status() );
	}

	public function test_a_user_who_cannot_edit_a_protected_gallery_meets_its_password(): void {
		$this->protect( $this->published );
		wp_set_current_user( $this->user_with( array( 'edit_posts' ) ) );

		$response = $this->preview( $this->published );

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringContainsString( 'fg-lock-form', $response->get_data()['html'] );
	}

	public function test_a_user_who_can_edit_a_protected_gallery_sees_it(): void {
		$this->protect( $this->published );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$html = $this->preview( $this->published )->get_data()['html'];

		$this->assertStringNotContainsString( 'fg-lock-form', $html );
		$this->assertStringContainsString( 'canola', $html );
	}
}
