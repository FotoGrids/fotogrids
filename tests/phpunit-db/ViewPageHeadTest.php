<?php
/**
 * What a view page request registers for its document head: the SEO conflict
 * guard engaging before the SEO plugins read their switches, and the noindex
 * reaching WordPress' robots meta.
 *
 * @package FotoGrids
 */

use FotoGrids\Modules\ViewCollections\Router;
use FotoGrids\Modules\ViewCollections\SEO_Conflict_Guard;

class ViewPageHeadTest extends WP_UnitTestCase {

	private int $gallery;

	public function set_up(): void {
		parent::set_up();

		$this->gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
	}

	public function test_the_guard_engages_on_wp_ahead_of_rank_math(): void {
		$this->assertSame( 1, has_action( 'wp', array( SEO_Conflict_Guard::class, 'maybe_engage' ) ) );
	}

	public function test_the_guard_engages_on_a_view_page_before_it_is_routed(): void {
		$this->go_to( get_permalink( $this->gallery ) );

		$this->assertSame( $this->gallery, Router::view_post()->ID );

		SEO_Conflict_Guard::maybe_engage();

		$this->assertNotFalse( has_filter( 'rank_math/frontend/disable_integration', '__return_true' ) );
		$this->assertNotFalse( has_filter( 'aioseo_disable', '__return_true' ) );
		$this->assertNotFalse( has_filter( 'seopress_titles_canonical', '__return_empty_string' ) );
		$this->assertNotFalse( has_filter( 'wpseo_frontend_presenters', array( SEO_Conflict_Guard::class, 'filter_yoast_presenters' ) ) );
	}

	public function test_the_guard_stays_out_of_other_pages(): void {
		$this->go_to( get_permalink( self::factory()->post->create() ) );

		$this->assertNull( Router::view_post() );

		SEO_Conflict_Guard::maybe_engage();

		$this->assertFalse( has_filter( 'rank_math/frontend/disable_integration', '__return_true' ) );
	}

	public function test_a_noindexed_view_page_adds_noindex_to_the_robots_meta(): void {
		update_post_meta( $this->gallery, 'fotogrids_noindex', '1' );
		$this->go_to( get_permalink( $this->gallery ) );
		Router::route( 'index.php' );

		$robots = apply_filters( 'wp_robots', array() );

		$this->assertTrue( $robots['noindex'] ?? false );
		$this->assertTrue( $robots['nofollow'] ?? false );
	}

	public function test_an_indexed_view_page_leaves_the_robots_meta_alone(): void {
		$this->go_to( get_permalink( $this->gallery ) );
		Router::route( 'index.php' );

		$robots = apply_filters( 'wp_robots', array() );

		$this->assertArrayNotHasKey( 'noindex', $robots );
	}

	public function test_deferring_keeps_the_noindex_for_draft_previews_only(): void {
		\FotoGrids\Settings\SEO_Settings_Store::save(
			array_merge( \FotoGrids\Settings\SEO_Settings_Store::get(), array( 'defer_to_seo_plugins' => true ) )
		);
		update_post_meta( $this->gallery, 'fotogrids_noindex', '1' );

		$this->go_to( get_permalink( $this->gallery ) );
		Router::route( 'index.php' );
		$this->assertArrayNotHasKey( 'noindex', apply_filters( 'wp_robots', array() ) );

		$draft = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'draft',
			)
		);
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->go_to( get_permalink( $draft ) );
		Router::route( 'index.php' );
		$this->assertTrue( apply_filters( 'wp_robots', array() )['noindex'] ?? false );
	}
}
