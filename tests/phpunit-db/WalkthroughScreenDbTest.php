<?php
/**
 * Which tour the current admin screen offers, against real posts and users.
 *
 * @package FotoGrids
 */

use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Modules\Walkthrough\Walkthrough_Screen;
use FotoGrids\Modules\Walkthrough\Walkthrough_State;
use FotoGrids\Settings\Settings_Mode;

class WalkthroughScreenDbTest extends WP_UnitTestCase {

	private int $user_id;

	public function set_up(): void {
		parent::set_up();

		$this->user_id = self::factory()->user->create( array( 'role' => 'editor' ) );
		wp_set_current_user( $this->user_id );
		Walkthrough_Screen::reset();
		unset( $_GET[ Walkthrough_Screen::START_ARG ] );
	}

	public function tear_down(): void {
		Walkthrough_Screen::reset();
		unset( $_GET[ Walkthrough_Screen::START_ARG ], $GLOBALS['post'] );
		set_current_screen( 'front' );

		parent::tear_down();
	}

	/** Open a collection's edit screen. */
	private function edit( int $post_id ): void {
		$post            = get_post( $post_id );
		$GLOBALS['post'] = $post;
		set_current_screen( $post->post_type );
	}

	private function collection( string $type, array $args = array() ): int {
		return self::factory()->post->create(
			array_merge(
				array(
					'post_type'   => $type,
					'post_author' => $this->user_id,
					'post_status' => 'draft',
				),
				$args
			)
		);
	}

	public function test_a_first_gallery_opens_its_tour(): void {
		$this->edit( $this->collection( 'fotogrids_gallery', array( 'post_status' => 'auto-draft' ) ) );

		$current = Walkthrough_Screen::current();

		$this->assertSame( 'gallery', $current['tour'] );
		$this->assertTrue( $current['auto_start'] );
		$this->assertFalse( $current['resume'] );
		$this->assertTrue( Walkthrough_Screen::opens_by_itself() );
	}

	public function test_a_gallery_with_items_does_not(): void {
		$id      = $this->collection( 'fotogrids_gallery' );
		$item_id = self::factory()->attachment->create_object( 'a.jpg', $id, array( 'post_mime_type' => 'image/jpeg' ) );
		update_post_meta( $id, 'fotogrids_gallery_items', wp_json_encode( array( $item_id ) ) );
		$this->edit( $id );

		$this->assertFalse( Walkthrough_Screen::current()['auto_start'] );
	}

	public function test_a_user_with_another_gallery_does_not_get_it(): void {
		$this->collection( 'fotogrids_gallery', array( 'post_status' => 'trash' ) );
		$this->edit( $this->collection( 'fotogrids_gallery', array( 'post_status' => 'auto-draft' ) ) );

		$this->assertFalse( Walkthrough_Screen::current()['auto_start'] );
	}

	public function test_galleries_by_someone_else_do_not_count(): void {
		$other = self::factory()->user->create( array( 'role' => 'editor' ) );
		$this->collection( 'fotogrids_gallery', array( 'post_author' => $other ) );
		$this->edit( $this->collection( 'fotogrids_gallery', array( 'post_status' => 'auto-draft' ) ) );

		$this->assertTrue( Walkthrough_Screen::current()['auto_start'] );
	}

	public function test_a_stored_state_stops_the_auto_start(): void {
		Walkthrough_State::set( $this->user_id, 'gallery', 'skipped' );
		$this->edit( $this->collection( 'fotogrids_gallery', array( 'post_status' => 'auto-draft' ) ) );

		$this->assertFalse( Walkthrough_Screen::current()['auto_start'] );
		$this->assertFalse( Walkthrough_Screen::opens_by_itself() );
	}

	public function test_a_pending_tour_resumes_on_a_saved_gallery_only(): void {
		Walkthrough_State::set( $this->user_id, 'gallery', 'publish-pending' );

		$this->edit( $this->collection( 'fotogrids_gallery', array( 'post_status' => 'auto-draft' ) ) );
		$this->assertFalse( Walkthrough_Screen::current()['resume'] );

		Walkthrough_Screen::reset();
		$this->edit( $this->collection( 'fotogrids_gallery' ) );
		$this->assertTrue( Walkthrough_Screen::current()['resume'] );
	}

	public function test_the_start_argument_forces_the_tour(): void {
		Walkthrough_State::set( $this->user_id, 'gallery', 'done' );
		$_GET[ Walkthrough_Screen::START_ARG ] = '1';
		$this->edit( $this->collection( 'fotogrids_gallery' ) );

		$this->assertTrue( Walkthrough_Screen::current()['forced'] );
		$this->assertTrue( Walkthrough_Screen::opens_by_itself() );
	}

	public function test_an_album_with_galleries_does_not_open_its_tour(): void {
		$album = $this->collection( 'fotogrids_album', array( 'post_status' => 'auto-draft' ) );
		$this->edit( $album );
		$this->assertTrue( Walkthrough_Screen::current()['auto_start'] );
		$this->assertSame( 'album', Walkthrough_Screen::current()['tour'] );

		$gallery = self::factory()->post->create( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'publish' ) );
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $album );
		Walkthrough_Screen::reset();
		$this->edit( $album );
		$this->assertFalse( Walkthrough_Screen::current()['auto_start'] );
	}

	public function test_the_dashboard_tour_is_for_users_who_made_no_gallery(): void {
		set_current_screen( 'toplevel_page_fotogrids' );
		$this->assertTrue( Walkthrough_Screen::current()['auto_start'] );
		$this->assertSame( 'dashboard', Walkthrough_Screen::current()['tour'] );

		$this->collection( 'fotogrids_gallery' );
		Walkthrough_Screen::reset();
		$this->assertFalse( Walkthrough_Screen::current()['auto_start'] );
	}

	public function test_other_screens_have_no_tour(): void {
		set_current_screen( 'edit-fotogrids_gallery' );

		$this->assertNull( Walkthrough_Screen::current() );
		$this->assertFalse( Walkthrough_Screen::opens_by_itself() );
	}

	public function test_the_mode_tip_waits_while_a_tour_opens(): void {
		update_option( Settings_Mode::TIP_OPTION, '1' );
		$this->edit( $this->collection( 'fotogrids_gallery', array( 'post_status' => 'auto-draft' ) ) );
		$this->assertFalse( Settings_Mode::should_show_tip( $this->user_id ) );

		Walkthrough_State::set( $this->user_id, 'gallery', 'skipped' );
		Walkthrough_Screen::reset();
		$this->assertTrue( Settings_Mode::should_show_tip( $this->user_id ) );

		delete_option( Settings_Mode::TIP_OPTION );
	}

	public function test_the_walkthrough_preference_is_registered(): void {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-user-preferences.php';

		$this->assertArrayHasKey( 'walkthrough', \FotoGrids\Admin\User_Preferences::handlers() );
	}
}
