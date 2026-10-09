<?php
/**
 * Who may read the admin routes behind the Dashboard widget, the FotoGrids
 * Dashboard, the Statistics screen and the What's New panel.
 *
 * Each route answers exactly the users who can open a screen that reads it.
 *
 * @package FotoGrids
 */

class AdminReadRoutePermissionsTest extends WP_UnitTestCase {

	private const ROUTES = array(
		'stats/overview',
		'stats/views',
		'stats/popular-galleries',
		'stats/recent-activity',
		'stats/top-content',
		'recently-edited',
		'news',
	);

	public function set_up(): void {
		parent::set_up();

		// The news feed would otherwise fetch from the network; its fallback is enough here.
		add_filter(
			'pre_http_request',
			static function () {
				return new WP_Error( 'offline', 'No network in tests.' );
			}
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

	/** HTTP status of every route, for the current user. */
	private function statuses(): array {
		$out = array();
		foreach ( self::ROUTES as $route ) {
			$response      = rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/fotogrids/v1/admin/' . $route ) );
			$out[ $route ] = $response->get_status();
		}

		return $out;
	}

	private function expect_open( array $open ): void {
		$expected = array();
		foreach ( self::ROUTES as $route ) {
			$expected[ $route ] = in_array( $route, $open, true ) ? 200 : 403;
		}

		$this->assertSame( $expected, $this->statuses() );
	}

	public function test_manage_fotogrids_alone_opens_what_the_dashboards_read(): void {
		wp_set_current_user( $this->user_with( array( 'manage_fotogrids' ) ) );

		$this->expect_open( array( 'stats/overview', 'recently-edited', 'news' ) );
	}

	public function test_view_fotogrids_stats_alone_opens_every_statistics_route(): void {
		wp_set_current_user( $this->user_with( array( 'view_fotogrids_stats' ) ) );

		$this->expect_open( array( 'stats/overview', 'stats/views', 'stats/popular-galleries', 'stats/recent-activity', 'stats/top-content' ) );
	}

	public function test_gallery_capabilities_alone_open_the_news(): void {
		wp_set_current_user( $this->user_with( array( 'edit_fotogrids_galleries' ) ) );

		$this->expect_open( array( 'news' ) );
	}

	public function test_a_contributor_keeps_the_routes_edit_posts_opened(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'contributor' ) ) );

		$this->expect_open( array( 'recently-edited', 'news' ) );
	}

	public function test_a_subscriber_opens_nothing(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$this->expect_open( array() );
	}

	public function test_an_administrator_opens_everything(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$this->expect_open( self::ROUTES );
	}
}
