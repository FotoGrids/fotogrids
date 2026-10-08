<?php
/**
 * How a collection's post status decides its view page and its view count.
 *
 * Private collections render as normal view pages and keep the Stats feature;
 * drafts, pending and scheduled collections render as draft previews.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Hooks\Actions_View;
use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Modules\ViewCollections\Renderer;
use FotoGrids\Public_Render;

class ViewPagePostStatusTest extends WP_UnitTestCase {

	private int $admin;

	private int $attachment;

	public function set_up(): void {
		parent::set_up();

		$this->admin      = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->attachment = self::factory()->attachment->create_object(
			array(
				'file'           => 'view-page.jpg',
				'post_mime_type' => 'image/jpeg',
			)
		);
	}

	private function collection( string $post_type, string $status ): int {
		$args = array(
			'post_type'   => $post_type,
			'post_status' => $status,
		);
		if ( 'future' === $status ) {
			$args['post_date'] = gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS );
		}

		$id = self::factory()->post->create( $args );
		if ( 'fotogrids_gallery' === $post_type ) {
			Gallery_Repository::set_item_ids( $id, array( $this->attachment ) );
		}

		return $id;
	}

	public function status_provider(): array {
		return array(
			'publish' => array( 'publish', false ),
			'private' => array( 'private', false ),
			'draft'   => array( 'draft', true ),
			'pending' => array( 'pending', true ),
			'future'  => array( 'future', true ),
		);
	}

	/**
	 * @dataProvider status_provider
	 */
	public function test_only_unpublished_statuses_are_draft_previews( string $status, bool $expected ): void {
		$post = get_post( $this->collection( 'fotogrids_gallery', $status ) );

		$this->assertSame( $status, $post->post_status );
		$this->assertSame( $expected, Renderer::for_post( $post )->is_draft_preview() );
	}

	public function test_a_private_gallery_renders_with_stats_for_a_reader(): void {
		$gallery = $this->collection( 'fotogrids_gallery', 'private' );
		wp_set_current_user( $this->admin );

		$html = Public_Render::gallery_shortcode( array( 'id' => $gallery ) );

		$this->assertStringContainsString( 'data-fg-gallery-id="' . $gallery . '"', $html );
		$this->assertStringContainsString( 'data-fg-stats', $html );
	}

	public function test_a_private_gallery_does_not_render_for_a_visitor(): void {
		$gallery = $this->collection( 'fotogrids_gallery', 'private' );
		wp_set_current_user( 0 );

		$html = Public_Render::gallery_shortcode( array( 'id' => $gallery ) );

		$this->assertStringContainsString( 'fotogrids-error', $html );
		$this->assertStringNotContainsString( 'data-fg-gallery-id', $html );
	}

	public function test_a_draft_gallery_does_not_render_for_its_editor(): void {
		$gallery = $this->collection( 'fotogrids_gallery', 'draft' );
		wp_set_current_user( $this->admin );

		$html = Public_Render::gallery_shortcode( array( 'id' => $gallery ) );

		$this->assertStringContainsString( 'fotogrids-error', $html );
		$this->assertStringNotContainsString( 'data-fg-gallery-id', $html );
	}

	public function test_a_private_album_keeps_stats_and_a_draft_album_does_not(): void {
		$child = $this->collection( 'fotogrids_gallery', 'publish' );
		wp_set_current_user( $this->admin );

		foreach ( array(
			'private' => true,
			'draft'   => false,
		) as $status => $has_stats ) {
			$album = $this->collection( 'fotogrids_album', $status );
			Gallery_Album_Relations::add_gallery_to_album( $child, $album );

			$html = Public_Render::album_shortcode( array( 'id' => $album ) );

			$this->assertStringContainsString( 'data-fg-album-id="' . $album . '"', $html, $status );
			$this->assertSame( $has_stats, str_contains( $html, 'data-fg-stats' ), $status );
		}
	}

	public function test_track_view_fires_the_tracked_action_without_writing_a_view(): void {
		global $wpdb;

		foreach ( array(
			'private' => 1,
			'draft'   => 0,
		) as $status => $fired ) {
			$gallery = $this->collection( 'fotogrids_gallery', $status );
			$before  = did_action( Actions_View::TRACKED );

			Renderer::for_post( get_post( $gallery ) )->track_view();

			$this->assertSame( $fired, did_action( Actions_View::TRACKED ) - $before, $status );
			$this->assertSame(
				0,
				(int) $wpdb->get_var(
					$wpdb->prepare(
						"SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_statistics WHERE object_type = 'gallery' AND object_id = %d",
						$gallery
					)
				),
				$status
			);
		}
	}
}
