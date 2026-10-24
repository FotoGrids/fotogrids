<?php
/**
 * Walkthrough_State storage and the walkthrough preference.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Admin\User_Preferences;
use FotoGrids\Hooks\Filters_Admin;
use FotoGrids\Modules\Walkthrough\Walkthrough_State;
use FotoGrids\Settings\Settings_Mode;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/stubs/wp-options.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/filters/class-filters-admin.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/filters/class-filters-settings.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-user-preferences.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-settings-mode.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/Walkthrough/class-walkthrough-state.php';

final class WalkthroughStateTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['fotogrids_test_options']     = array();
		$GLOBALS['fotogrids_test_user_meta']   = array();
		$GLOBALS['fotogrids_test_fail_writes'] = false;
		$GLOBALS['fotogrids_test_filters']     = array(
			Filters_Admin::USER_PREFERENCES => static function ( $handlers ) {
				return Walkthrough_State::register_preferences( Settings_Mode::register_preferences( $handlers ) );
			},
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['fotogrids_test_options'], $GLOBALS['fotogrids_test_user_meta'], $GLOBALS['fotogrids_test_fail_writes'], $GLOBALS['fotogrids_test_filters'] );
	}

	public function test_a_tour_that_never_ran_has_no_state(): void {
		$this->assertSame( '', Walkthrough_State::get( 5, 'gallery' ) );
		$this->assertSame( array(), Walkthrough_State::all( 5 ) );
		$this->assertSame( array(), Walkthrough_State::all( 0 ) );
	}

	public function test_set_stores_each_tour_in_one_meta_for_that_user_only(): void {
		$this->assertTrue( Walkthrough_State::set( 5, 'gallery', 'done' ) );
		$this->assertTrue( Walkthrough_State::set( 5, 'dashboard', 'skipped' ) );

		$this->assertSame(
			array(
				5 => array(
					'fotogrids_walkthroughs' => array(
						'gallery'   => 'done',
						'dashboard' => 'skipped',
					),
				),
			),
			$GLOBALS['fotogrids_test_user_meta']
		);
		$this->assertSame( '', Walkthrough_State::get( 6, 'gallery' ) );
	}

	public function test_set_succeeds_when_unchanged(): void {
		Walkthrough_State::set( 5, 'album', 'publish-pending' );

		$this->assertTrue( Walkthrough_State::set( 5, 'album', 'publish-pending' ) );
	}

	public function test_set_moves_a_pending_tour_on(): void {
		Walkthrough_State::set( 5, 'gallery', 'publish-pending' );
		Walkthrough_State::set( 5, 'gallery', 'done' );

		$this->assertSame( 'done', Walkthrough_State::get( 5, 'gallery' ) );
	}

	/**
	 * @dataProvider rejected_writes
	 * @param int    $user_id User ID.
	 * @param string $tour    Tour id.
	 * @param string $state   State.
	 */
	public function test_set_rejects_bad_input( int $user_id, string $tour, string $state ): void {
		$this->assertFalse( Walkthrough_State::set( $user_id, $tour, $state ) );
		$this->assertSame( array(), $GLOBALS['fotogrids_test_user_meta'] );
	}

	/**
	 * @return array<string, array<int, int|string>>
	 */
	public function rejected_writes(): array {
		return array(
			'no user'       => array( 0, 'gallery', 'done' ),
			'unknown tour'  => array( 5, 'settings', 'done' ),
			'unknown state' => array( 5, 'gallery', 'started' ),
			'empty state'   => array( 5, 'gallery', '' ),
		);
	}

	public function test_set_reports_a_failed_write(): void {
		$GLOBALS['fotogrids_test_fail_writes'] = true;

		$this->assertFalse( Walkthrough_State::set( 5, 'gallery', 'done' ) );
	}

	/**
	 * @dataProvider stored_values
	 * @param mixed                 $stored   Stored meta value.
	 * @param array<string, string> $expected Clean states.
	 */
	public function test_all_drops_unknown_entries( $stored, array $expected ): void {
		$GLOBALS['fotogrids_test_user_meta'][5]['fotogrids_walkthroughs'] = $stored;

		$this->assertSame( $expected, Walkthrough_State::all( 5 ) );
	}

	/**
	 * @return array<string, array<int, mixed>>
	 */
	public function stored_values(): array {
		return array(
			'string'        => array( 'done', array() ),
			'unknown tour'  => array( array( 'library' => 'done' ), array() ),
			'unknown state' => array( array( 'gallery' => 'seen' ), array() ),
			'mixed'         => array(
				array(
					'gallery' => 'done',
					'album'   => 1,
				),
				array( 'gallery' => 'done' ),
			),
		);
	}

	/**
	 * @dataProvider preference_values
	 * @param string      $value    Submitted value.
	 * @param string|null $expected Validated value.
	 */
	public function test_validate_preference( string $value, ?string $expected ): void {
		$this->assertSame( $expected, Walkthrough_State::validate_preference( $value ) );
	}

	/**
	 * @return array<string, array<int, string|null>>
	 */
	public function preference_values(): array {
		return array(
			'gallery done'      => array( 'gallery:done', 'gallery:done' ),
			'album pending'     => array( 'album:publish-pending', 'album:publish-pending' ),
			'dashboard skipped' => array( 'dashboard:skipped', 'dashboard:skipped' ),
			'unknown tour'      => array( 'stats:done', null ),
			'unknown state'     => array( 'gallery:open', null ),
			'no separator'      => array( 'gallery', null ),
			'extra part'        => array( 'gallery:done:1', null ),
			'empty'             => array( '', null ),
		);
	}

	public function test_preference_request_stores_the_state(): void {
		$this->assertSame(
			array(
				'ok'    => true,
				'value' => 'gallery:skipped',
			),
			User_Preferences::handle_request( 5, true, 'walkthrough', 'gallery:skipped' )
		);
		$this->assertSame( 'skipped', Walkthrough_State::get( 5, 'gallery' ) );
	}

	public function test_preference_request_rejects_a_bad_value_without_writing(): void {
		$result = User_Preferences::handle_request( 5, true, 'walkthrough', 'gallery:open' );

		$this->assertSame( User_Preferences::ERROR_INVALID, $result['error'] );
		$this->assertSame( array(), $GLOBALS['fotogrids_test_user_meta'] );
	}

	public function test_preference_request_refuses_a_logged_out_user(): void {
		$result = User_Preferences::handle_request( 0, true, 'walkthrough', 'gallery:done' );

		$this->assertSame( User_Preferences::ERROR_FORBIDDEN, $result['error'] );
	}

	public function test_settings_mode_preferences_still_work_alongside(): void {
		$this->assertTrue( User_Preferences::handle_request( 5, true, 'settings_mode', 'advanced' )['ok'] );
		$this->assertTrue( User_Preferences::handle_request( 5, true, 'walkthrough', 'album:done' )['ok'] );

		$this->assertSame( 'advanced', $GLOBALS['fotogrids_test_user_meta'][5]['fotogrids_settings_mode'] );
		$this->assertSame( array( 'album' => 'done' ), $GLOBALS['fotogrids_test_user_meta'][5]['fotogrids_walkthroughs'] );
	}

	public function test_meta_key_is_removed_by_uninstall_pattern(): void {
		$this->assertStringStartsWith( 'fotogrids_', Walkthrough_State::META_KEY );
	}
}
