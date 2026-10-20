<?php
/**
 * The repair of album featured-gallery picks that name a gallery outside the album.
 *
 * @package FotoGrids
 */

use FotoGrids\Activator;
use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Migrations\Featured_Gallery_Repair;
use FotoGrids\Migrations\Migration_Runner;
use FotoGrids\Post_Types;

class FeaturedGalleryRepairTest extends WP_UnitTestCase {

	private function post( string $post_type ): int {
		return self::factory()->post->create(
			array(
				'post_type'   => $post_type,
				'post_status' => 'publish',
			)
		);
	}

	private function pick( int $album, $value ): void {
		update_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, $value );
	}

	private function picked( int $post_id ): string {
		return (string) get_post_meta( $post_id, Post_Types::FEATURED_GALLERY_META_KEY, true );
	}

	public function test_a_pick_outside_the_album_is_deleted(): void {
		$album   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		$this->pick( $album, $gallery );

		Featured_Gallery_Repair::run();

		$this->assertSame( '', $this->picked( $album ) );
	}

	public function test_a_pick_inside_the_album_is_kept(): void {
		$album   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $album );
		$this->pick( $album, $gallery );

		Featured_Gallery_Repair::run();

		$this->assertSame( (string) $gallery, $this->picked( $album ) );
	}

	public function test_a_repaired_gallery_is_not_featured_when_added_back(): void {
		$album   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		$this->pick( $album, $gallery );

		Featured_Gallery_Repair::run();
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $album );

		$this->assertSame( '', $this->picked( $album ) );
	}

	public function invalid_pick_provider(): array {
		return array(
			'deleted gallery'  => array( 'deleted' ),
			'not a gallery'    => array( 'page' ),
			'zero'             => array( '0' ),
			'not a number'     => array( 'abc' ),
			'number then text' => array( 'gallery' ),
		);
	}

	/**
	 * @dataProvider invalid_pick_provider
	 *
	 * @param string $kind Kind of invalid pick.
	 */
	public function test_an_invalid_pick_is_deleted( string $kind ): void {
		$album   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $album );

		switch ( $kind ) {
			case 'deleted':
				$gone = $this->post( Post_Types::GALLERY );
				wp_delete_post( $gone, true );
				$value = (string) $gone;
				break;
			case 'page':
				$value = (string) $this->post( 'page' );
				break;
			case 'gallery':
				$value = $gallery . 'x';
				break;
			default:
				$value = $kind;
		}
		$this->pick( $album, $value );

		Featured_Gallery_Repair::run();

		$this->assertSame( '', $this->picked( $album ) );
	}

	public function test_a_second_run_changes_nothing(): void {
		$album   = $this->post( Post_Types::ALBUM );
		$kept    = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $kept );
		$this->pick( $album, $gallery );
		$this->pick( $kept, $gallery );

		Featured_Gallery_Repair::run();
		$flushes = did_action( Actions_Cache::FLUSHED_ALL );
		Featured_Gallery_Repair::run();

		$this->assertSame( $flushes, did_action( Actions_Cache::FLUSHED_ALL ), 'the second run deleted something' );
		$this->assertSame( '', $this->picked( $album ) );
		$this->assertSame( (string) $gallery, $this->picked( $kept ) );
	}

	public function test_the_upgrade_runs_the_repair_once(): void {
		$album   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		$this->pick( $album, $gallery );
		update_option( Migration_Runner::RECORD_OPTION, array_values( array_diff( Migration_Runner::completed(), array( Featured_Gallery_Repair::id() ) ) ) );

		Activator::maybe_upgrade();

		$this->assertSame( '', $this->picked( $album ) );
		$this->assertContains( Featured_Gallery_Repair::id(), Migration_Runner::completed() );

		$this->pick( $album, $gallery );
		Activator::maybe_upgrade();
		$this->assertSame( (string) $gallery, $this->picked( $album ), 'the repair ran a second time' );
	}

	public function test_repairing_some_albums_leaves_the_others_alone(): void {
		$checked = $this->post( Post_Types::ALBUM );
		$other   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		$this->pick( $checked, $gallery );
		$this->pick( $other, $gallery );

		Featured_Gallery_Repair::repair_albums( array( $checked ) );

		$this->assertSame( '', $this->picked( $checked ) );
		$this->assertSame( (string) $gallery, $this->picked( $other ) );
	}

	public function test_the_render_cache_is_flushed_only_when_a_pick_was_deleted(): void {
		$album   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );

		$flushes = did_action( Actions_Cache::FLUSHED_ALL );
		Featured_Gallery_Repair::run();
		$this->assertSame( $flushes, did_action( Actions_Cache::FLUSHED_ALL ) );

		$this->pick( $album, $gallery );
		Featured_Gallery_Repair::run();
		$this->assertSame( $flushes + 1, did_action( Actions_Cache::FLUSHED_ALL ) );
	}

	public function test_a_site_without_picks_has_nothing_to_repair(): void {
		$this->post( Post_Types::ALBUM );
		$flushes = did_action( Actions_Cache::FLUSHED_ALL );

		Featured_Gallery_Repair::run();

		$this->assertSame( $flushes, did_action( Actions_Cache::FLUSHED_ALL ) );
	}

	public function test_only_albums_are_touched_and_a_trashed_child_still_counts(): void {
		$album   = $this->post( Post_Types::ALBUM );
		$gallery = $this->post( Post_Types::GALLERY );
		$page    = $this->post( 'page' );
		Gallery_Album_Relations::add_gallery_to_album( $gallery, $album );
		$this->pick( $album, $gallery );
		$this->pick( $gallery, 12345 );
		$this->pick( $page, 12345 );
		wp_trash_post( $gallery );

		Featured_Gallery_Repair::run();

		$this->assertSame( (string) $gallery, $this->picked( $album ) );
		$this->assertSame( '12345', $this->picked( $gallery ) );
		$this->assertSame( '12345', $this->picked( $page ) );
	}
}
