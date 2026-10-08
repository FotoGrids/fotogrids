<?php
/**
 * The admin lists that name or link to collections — Recently Edited, the
 * Statistics tables and the popular-galleries chart — against users who cannot
 * edit, or cannot read, every row.
 *
 * @package FotoGrids
 */

use FotoGrids\REST\Admin\Admin_Data;

class AdminListsEditPermissionTest extends WP_UnitTestCase {

	private int $admin;

	private int $author;

	public function set_up(): void {
		parent::set_up();

		$this->admin  = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->author = self::factory()->user->create( array( 'role' => 'author' ) );
	}

	/** A collection owned by $author, modified $age seconds ago. */
	private function collection( int $author, string $status, int $age, string $type = 'fotogrids_gallery' ): int {
		$modified = gmdate( 'Y-m-d H:i:s', time() - $age );

		$id = self::factory()->post->create(
			array(
				'post_type'   => $type,
				'post_status' => $status,
				'post_author' => $author,
				'post_title'  => "$type $status $age",
			)
		);

		global $wpdb;
		$wpdb->update(
			$wpdb->posts,
			array(
				'post_modified'     => $modified,
				'post_modified_gmt' => $modified,
			),
			array( 'ID' => $id )
		);
		clean_post_cache( $id );

		return $id;
	}

	private function recently_edited_ids( int $limit = 10 ): array {
		return array_column(
			Admin_Data::fetch_recently_edited(
				array(
					'limit'       => $limit,
					'post_status' => array( 'publish', 'draft', 'private' ),
				)
			),
			'id'
		);
	}

	public function test_a_user_who_can_edit_nothing_sees_no_recently_edited_rows(): void {
		$this->collection( $this->admin, 'publish', 10 );
		$this->collection( $this->admin, 'private', 20, 'fotogrids_album' );

		$viewer = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		get_user_by( 'id', $viewer )->add_cap( 'manage_fotogrids' );
		wp_set_current_user( $viewer );

		$this->assertSame( array(), $this->recently_edited_ids() );
	}

	public function test_an_administrator_sees_every_status_and_type(): void {
		$gallery = $this->collection( $this->author, 'publish', 10 );
		$album   = $this->collection( $this->author, 'private', 20, 'fotogrids_album' );
		$draft   = $this->collection( $this->admin, 'draft', 30 );

		wp_set_current_user( $this->admin );

		$this->assertSame( array( $gallery, $album, $draft ), $this->recently_edited_ids() );
	}

	/**
	 * Rows the user cannot edit are skipped before the limit is applied, so a
	 * page of newer uneditable collections does not empty the list.
	 */
	public function test_the_limit_is_filled_from_editable_rows_only(): void {
		$own = array(
			$this->collection( $this->author, 'publish', 100 ),
			$this->collection( $this->author, 'draft', 110 ),
			$this->collection( $this->author, 'publish', 120 ),
		);
		for ( $i = 1; $i <= 5; $i++ ) {
			$this->collection( $this->admin, 'publish', $i );
		}
		$this->collection( $this->admin, 'private', 6 );

		wp_set_current_user( $this->author );

		$this->assertSame( array_slice( $own, 0, 2 ), $this->recently_edited_ids( 2 ) );
		$this->assertSame( $own, $this->recently_edited_ids( 10 ) );
	}

	/**
	 * A user who may edit other users' collections, but not every one of them,
	 * is searched past the first batch rather than limited to their own.
	 */
	public function test_editable_rows_beyond_the_first_batch_are_found(): void {
		$drafts = array(
			$this->collection( $this->admin, 'draft', 1000 ),
			$this->collection( $this->admin, 'draft', 1010 ),
		);
		for ( $i = 1; $i <= 110; $i++ ) {
			$this->collection( $this->admin, 'publish', $i );
		}

		$editor = self::factory()->user->create( array( 'role' => 'editor' ) );
		get_user_by( 'id', $editor )->add_cap( 'edit_published_fotogrids_galleries', false );
		wp_set_current_user( $editor );

		$this->assertSame( $drafts, $this->recently_edited_ids( 5 ) );
	}

	public function test_every_recently_edited_row_carries_an_edit_link(): void {
		$this->collection( $this->author, 'publish', 10 );
		$this->collection( $this->admin, 'publish', 20 );

		wp_set_current_user( $this->author );

		$rows = Admin_Data::fetch_recently_edited();
		$this->assertCount( 1, $rows );
		foreach ( $rows as $row ) {
			$this->assertIsString( $row['edit_url'] );
			$this->assertNotSame( '', $row['edit_url'] );
		}
	}

	/** Seeds one statistics row per collection. */
	private function stats_for( array $ids ): void {
		global $wpdb;

		foreach ( $ids as $i => $id ) {
			$wpdb->insert(
				$wpdb->prefix . 'fotogrids_statistics',
				array(
					'object_type' => 'gallery',
					'object_id'   => $id,
					'views'       => 100 - $i,
					'shares'      => 0,
					'last_viewed' => gmdate( 'Y-m-d H:i:s', time() - $i ),
				)
			);
		}
	}

	private function stats_rows( string $method ): array {
		$request = new WP_REST_Request( 'GET' );
		$request->set_param( 'days', 0 );

		$data = Admin_Data::$method( $request )->get_data();

		return array_column( $data, 'edit_url', 'id' );
	}

	public function stats_methods(): array {
		return array(
			'recent activity' => array( 'get_recent_activity' ),
			'top content'     => array( 'get_top_content' ),
		);
	}

	/**
	 * @dataProvider stats_methods
	 */
	public function test_stats_rows_hide_unreadable_collections_and_link_only_editable_ones( string $method ): void {
		$own      = $this->collection( $this->author, 'publish', 10 );
		$readable = $this->collection( $this->admin, 'publish', 20 );
		$private  = $this->collection( $this->admin, 'private', 30 );
		$this->stats_for( array( $own, $readable, $private ) );

		wp_set_current_user( $this->author );

		$rows = $this->stats_rows( $method );

		$this->assertSame( array( $own, $readable ), array_keys( $rows ) );
		$this->assertNotSame( '', $rows[ $own ] );
		$this->assertSame( '', $rows[ $readable ] );
	}

	/**
	 * @dataProvider stats_methods
	 */
	public function test_an_administrator_gets_every_stats_row_with_a_link( string $method ): void {
		$ids = array(
			$this->collection( $this->author, 'publish', 10 ),
			$this->collection( $this->admin, 'private', 20 ),
		);
		$this->stats_for( $ids );

		wp_set_current_user( $this->admin );

		$rows = $this->stats_rows( $method );

		$this->assertSame( $ids, array_keys( $rows ) );
		$this->assertNotContains( '', $rows );
	}

	private function popular_galleries(): array {
		$request = new WP_REST_Request( 'GET' );
		$request->set_param( 'days', 0 );

		return Admin_Data::get_popular_galleries( $request )->get_data();
	}

	/**
	 * An unreadable gallery drops out of the chart by name, and its views stay
	 * in the total so they land in the remainder slice.
	 */
	public function test_popular_galleries_hide_unreadable_titles_but_keep_their_views_in_the_total(): void {
		$own      = $this->collection( $this->author, 'publish', 10 );
		$readable = $this->collection( $this->admin, 'publish', 20 );
		$private  = $this->collection( $this->admin, 'private', 30 );
		$this->stats_for( array( $own, $readable, $private ) );

		wp_set_current_user( $this->author );

		$chart = $this->popular_galleries();

		$this->assertSame( array( $own, $readable ), $chart['ids'] );
		$this->assertNotContains( get_post( $private )->post_title, $chart['labels'] );
		$this->assertSame( 100 + 99 + 98, $chart['total'] );
	}

	public function test_an_administrator_sees_every_popular_gallery(): void {
		$ids = array(
			$this->collection( $this->author, 'publish', 10 ),
			$this->collection( $this->admin, 'private', 20 ),
		);
		$this->stats_for( $ids );

		wp_set_current_user( $this->admin );

		$this->assertSame( $ids, $this->popular_galleries()['ids'] );
	}
}
