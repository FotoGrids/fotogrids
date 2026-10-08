<?php
/**
 * Permission_Gate::split_payload — which keys a save is allowed to write.
 *
 * ROLE-06 proves the same classification end to end through the editor. Here
 * it is a function call against real users and real capabilities, so every
 * branch is reachable without a browser.
 *
 * @package FotoGrids
 */

use FotoGrids\Permissions\Permission_Gate;

class PermissionGateTest extends WP_UnitTestCase {

	private int $gallery;

	public function set_up(): void {
		parent::set_up();

		$this->gallery = self::factory()->post->create(
			array( 'post_type' => 'fotogrids_gallery' )
		);
	}

	/** A payload mixing one content key with one settings key. */
	private function payload(): array {
		return array(
			'post_title'       => 'a title',
			'fotogrids_layout' => 'masonry',
		);
	}

	public function test_an_administrator_keeps_the_whole_payload(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		list( $allowed, $skipped ) = Permission_Gate::split_payload(
			$this->payload(),
			$this->gallery,
			'fotogrids_gallery'
		);

		$this->assertSame( $this->payload(), $allowed );
		$this->assertSame( array(), $skipped );
	}

	public function test_an_author_keeps_content_and_loses_settings(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		list( $allowed, $skipped ) = Permission_Gate::split_payload(
			$this->payload(),
			$this->gallery,
			'fotogrids_gallery'
		);

		$this->assertSame( array( 'post_title' => 'a title' ), $allowed );
		$this->assertSame( array( 'fotogrids_layout' ), $skipped );
	}

	/**
	 * The classification has to be the reason, not the role. An author who is
	 * granted the settings capability keeps the key.
	 */
	public function test_granting_the_capability_puts_the_settings_key_back(): void {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		get_user_by( 'id', $author )->add_cap( 'modify_fotogrids_gallery_settings' );
		wp_set_current_user( $author );

		list( $allowed, $skipped ) = Permission_Gate::split_payload(
			$this->payload(),
			$this->gallery,
			'fotogrids_gallery'
		);

		$this->assertSame( $this->payload(), $allowed );
		$this->assertSame( array(), $skipped );
	}

	/**
	 * A post type the gate does not own passes through untouched, so the gate
	 * cannot corrupt another plugin's save.
	 */
	public function test_an_unknown_post_type_passes_through(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		list( $allowed, $skipped ) = Permission_Gate::split_payload(
			$this->payload(),
			self::factory()->post->create(),
			'post'
		);

		$this->assertSame( $this->payload(), $allowed );
		$this->assertSame( array(), $skipped );
	}

	public function test_albums_are_gated_on_their_own_capability(): void {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		get_user_by( 'id', $author )->add_cap( 'modify_fotogrids_gallery_settings' );
		wp_set_current_user( $author );

		$album = self::factory()->post->create( array( 'post_type' => 'fotogrids_album' ) );

		list( , $skipped ) = Permission_Gate::split_payload(
			$this->payload(),
			$album,
			'fotogrids_album'
		);

		$this->assertSame(
			array( 'fotogrids_layout' ),
			$skipped,
			'the gallery capability unlocked album settings'
		);
	}

	/** Nothing to classify is not the same as nothing allowed. */
	public function test_an_empty_payload_skips_nothing(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		list( $allowed, $skipped ) = Permission_Gate::split_payload(
			array(),
			$this->gallery,
			'fotogrids_gallery'
		);

		$this->assertSame( array(), $allowed );
		$this->assertSame( array(), $skipped );
	}
}
