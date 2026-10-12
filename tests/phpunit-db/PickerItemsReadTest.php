<?php
/**
 * Who may list galleries in the page-builder picker, and what the listing holds.
 *
 * @package FotoGrids
 */

class PickerItemsReadTest extends WP_UnitTestCase {

	/** @var int */
	private $published;

	/** @var int */
	private $private;

	public function set_up(): void {
		parent::set_up();

		$owner           = self::factory()->user->create( array( 'role' => 'administrator' ) );
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
}
