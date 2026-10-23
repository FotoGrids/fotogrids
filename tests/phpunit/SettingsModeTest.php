<?php
/**
 * Settings_Mode resolution, preferences and the upgrade tip.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Migrations\Settings_Mode_Tip;
use FotoGrids\Settings\Settings_Mode;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/stubs/wp-options.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-settings-mode.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/migrations/interface-migration.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/migrations/class-settings-mode-tip.php';

final class SettingsModeTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['fotogrids_test_options']     = array();
		$GLOBALS['fotogrids_test_user_meta']   = array();
		$GLOBALS['fotogrids_test_fail_writes'] = false;
	}

	protected function tearDown(): void {
		unset( $GLOBALS['fotogrids_test_options'], $GLOBALS['fotogrids_test_user_meta'], $GLOBALS['fotogrids_test_fail_writes'] );
	}

	private function set_site_mode( $value ): void {
		$GLOBALS['fotogrids_test_options']['fotogrids_settings_mode'] = $value;
	}

	private function set_user_meta( int $user_id, string $key, $value ): void {
		$GLOBALS['fotogrids_test_user_meta'][ $user_id ][ $key ] = $value;
	}

	public function test_is_valid_accepts_only_known_modes(): void {
		$this->assertTrue( Settings_Mode::is_valid( 'easy' ) );
		$this->assertTrue( Settings_Mode::is_valid( 'advanced' ) );
		$this->assertFalse( Settings_Mode::is_valid( '' ) );
		$this->assertFalse( Settings_Mode::is_valid( 'Easy' ) );
		$this->assertFalse( Settings_Mode::is_valid( 'expert' ) );
	}

	public function test_site_default_is_easy_when_unset(): void {
		$this->assertSame( 'easy', Settings_Mode::site_default() );
	}

	public function test_site_default_reads_the_option(): void {
		$this->set_site_mode( 'advanced' );

		$this->assertSame( 'advanced', Settings_Mode::site_default() );
	}

	/**
	 * @dataProvider invalid_stored_values
	 * @param mixed $value Stored value.
	 */
	public function test_site_default_falls_back_to_easy_on_invalid_option( $value ): void {
		$this->set_site_mode( $value );

		$this->assertSame( 'easy', Settings_Mode::site_default() );
	}

	/**
	 * @return array<string, array<int, mixed>>
	 */
	public function invalid_stored_values(): array {
		return array(
			'empty string' => array( '' ),
			'unknown'      => array( 'expert' ),
			'array'        => array( array( 'advanced' ) ),
			'boolean'      => array( true ),
		);
	}

	public function test_resolve_prefers_user_meta(): void {
		$this->set_site_mode( 'easy' );
		$this->set_user_meta( 5, 'fotogrids_settings_mode', 'advanced' );

		$this->assertSame( 'advanced', Settings_Mode::resolve( 5 ) );
	}

	public function test_resolve_uses_site_default_without_user_meta(): void {
		$this->set_site_mode( 'advanced' );

		$this->assertSame( 'advanced', Settings_Mode::resolve( 5 ) );
	}

	/**
	 * @dataProvider invalid_stored_values
	 * @param mixed $value Stored value.
	 */
	public function test_resolve_ignores_invalid_user_meta( $value ): void {
		$this->set_site_mode( 'advanced' );
		$this->set_user_meta( 5, 'fotogrids_settings_mode', $value );

		$this->assertSame( 'advanced', Settings_Mode::resolve( 5 ) );
	}

	public function test_resolve_is_easy_when_nothing_is_valid(): void {
		$this->set_site_mode( 'expert' );
		$this->set_user_meta( 5, 'fotogrids_settings_mode', 'expert' );

		$this->assertSame( 'easy', Settings_Mode::resolve( 5 ) );
	}

	public function test_resolve_without_a_user_uses_site_default(): void {
		$this->set_site_mode( 'advanced' );
		$this->set_user_meta( 0, 'fotogrids_settings_mode', 'easy' );

		$this->assertSame( 'advanced', Settings_Mode::resolve( 0 ) );
	}

	public function test_set_user_mode_writes_only_that_user(): void {
		$this->assertTrue( Settings_Mode::set_user_mode( 5, 'advanced' ) );

		$this->assertSame( 'advanced', Settings_Mode::resolve( 5 ) );
		$this->assertSame( 'easy', Settings_Mode::resolve( 6 ) );
		$this->assertArrayNotHasKey( 'fotogrids_settings_mode', $GLOBALS['fotogrids_test_options'] );
	}

	public function test_set_user_mode_succeeds_when_unchanged(): void {
		$this->set_user_meta( 5, 'fotogrids_settings_mode', 'advanced' );

		$this->assertTrue( Settings_Mode::set_user_mode( 5, 'advanced' ) );
	}

	public function test_set_user_mode_rejects_invalid_input(): void {
		$this->assertFalse( Settings_Mode::set_user_mode( 5, 'expert' ) );
		$this->assertFalse( Settings_Mode::set_user_mode( 0, 'advanced' ) );
		$this->assertSame( array(), $GLOBALS['fotogrids_test_user_meta'] );
	}

	public function test_set_user_mode_reports_a_failed_write(): void {
		$GLOBALS['fotogrids_test_fail_writes'] = true;

		$this->assertFalse( Settings_Mode::set_user_mode( 5, 'advanced' ) );
	}

	public function test_tip_hidden_without_the_site_flag(): void {
		$this->assertFalse( Settings_Mode::should_show_tip( 5 ) );
	}

	public function test_tip_shows_when_flagged_and_not_dismissed(): void {
		$GLOBALS['fotogrids_test_options']['fotogrids_settings_mode_tip'] = '1';

		$this->assertTrue( Settings_Mode::should_show_tip( 5 ) );
		$this->assertFalse( Settings_Mode::should_show_tip( 0 ) );
	}

	public function test_dismiss_tip_hides_it_for_that_user_only(): void {
		$GLOBALS['fotogrids_test_options']['fotogrids_settings_mode_tip'] = '1';

		$this->assertTrue( Settings_Mode::dismiss_tip( 5 ) );
		$this->assertFalse( Settings_Mode::should_show_tip( 5 ) );
		$this->assertTrue( Settings_Mode::should_show_tip( 6 ) );
		$this->assertSame( '1', $GLOBALS['fotogrids_test_user_meta'][5]['fotogrids_settings_mode_tip_dismissed'] );
	}

	public function test_dismiss_tip_is_idempotent(): void {
		$this->assertTrue( Settings_Mode::dismiss_tip( 5 ) );
		$this->assertTrue( Settings_Mode::dismiss_tip( 5 ) );
	}

	public function test_dismiss_tip_rejects_missing_user_and_failed_write(): void {
		$this->assertFalse( Settings_Mode::dismiss_tip( 0 ) );

		$GLOBALS['fotogrids_test_fail_writes'] = true;
		$this->assertFalse( Settings_Mode::dismiss_tip( 5 ) );
	}

	/**
	 * @dataProvider preference_cases
	 * @param string      $preference Preference name.
	 * @param string      $value      Submitted value.
	 * @param string|null $expected   Validated value.
	 */
	public function test_validate_preference( string $preference, string $value, ?string $expected ): void {
		$this->assertSame( $expected, Settings_Mode::validate_preference( $preference, $value ) );
	}

	/**
	 * @return array<string, array<int, string|null>>
	 */
	public function preference_cases(): array {
		return array(
			'mode easy'          => array( 'settings_mode', 'easy', 'easy' ),
			'mode advanced'      => array( 'settings_mode', 'advanced', 'advanced' ),
			'mode unknown'       => array( 'settings_mode', 'expert', null ),
			'mode empty'         => array( 'settings_mode', '', null ),
			'tip dismissed'      => array( 'settings_mode_tip_dismissed', '1', '1' ),
			'tip zero'           => array( 'settings_mode_tip_dismissed', '0', null ),
			'unknown preference' => array( 'fotogrids_settings_mode', 'easy', null ),
			'empty preference'   => array( '', '1', null ),
		);
	}

	public function test_save_preference_routes_to_the_user_meta(): void {
		$this->assertTrue( Settings_Mode::save_preference( 5, 'settings_mode', 'advanced' ) );
		$this->assertTrue( Settings_Mode::save_preference( 5, 'settings_mode_tip_dismissed', '1' ) );
		$this->assertFalse( Settings_Mode::save_preference( 5, 'other', '1' ) );

		$this->assertSame(
			array(
				'fotogrids_settings_mode'               => 'advanced',
				'fotogrids_settings_mode_tip_dismissed' => '1',
			),
			$GLOBALS['fotogrids_test_user_meta'][5]
		);
	}

	/**
	 * @dataProvider stored_plugin_versions
	 * @param mixed $stored   Stored fotogrids_version.
	 * @param bool  $expected Whether the tip is flagged.
	 */
	public function test_migration_flags_the_tip_only_on_an_existing_install( $stored, bool $expected ): void {
		if ( null !== $stored ) {
			$GLOBALS['fotogrids_test_options']['fotogrids_version'] = $stored;
		}

		Settings_Mode_Tip::run();

		$flag = $GLOBALS['fotogrids_test_options']['fotogrids_settings_mode_tip'] ?? '';

		$this->assertSame( $expected, '1' === $flag );
	}

	/**
	 * @return array<string, array<int, mixed>>
	 */
	public function stored_plugin_versions(): array {
		return array(
			'fresh install' => array( null, false ),
			'empty version' => array( '', false ),
			'non-string'    => array( false, false ),
			'1.0.0'         => array( '1.0.0', true ),
			'1.2.0'         => array( '1.2.0', true ),
		);
	}

	public function test_migration_id_follows_the_runner_sequence(): void {
		$this->assertSame( '0005-settings-mode-tip', Settings_Mode_Tip::id() );
		$this->assertContains( 'FotoGrids\Migrations\Migration', class_implements( Settings_Mode_Tip::class ) );
	}

	public function test_preference_request_rejects_a_logged_out_user(): void {
		$this->assertSame(
			array(
				'ok'    => false,
				'error' => Settings_Mode::ERROR_FORBIDDEN,
			),
			Settings_Mode::handle_preference_request( 0, true, 'settings_mode', 'advanced' )
		);
		$this->assertSame( array(), $GLOBALS['fotogrids_test_user_meta'] );
	}

	public function test_preference_request_rejects_a_user_without_read(): void {
		$result = Settings_Mode::handle_preference_request( 5, false, 'settings_mode', 'advanced' );

		$this->assertSame( Settings_Mode::ERROR_FORBIDDEN, $result['error'] );
		$this->assertFalse( $result['ok'] );
		$this->assertSame( array(), $GLOBALS['fotogrids_test_user_meta'] );
	}

	/**
	 * @dataProvider invalid_requests
	 * @param string $preference Preference name.
	 * @param string $value      Submitted value.
	 */
	public function test_preference_request_rejects_invalid_input( string $preference, string $value ): void {
		$this->assertSame(
			array(
				'ok'    => false,
				'error' => Settings_Mode::ERROR_INVALID,
			),
			Settings_Mode::handle_preference_request( 5, true, $preference, $value )
		);
		$this->assertSame( array(), $GLOBALS['fotogrids_test_user_meta'] );
	}

	/**
	 * @return array<string, array<int, string>>
	 */
	public function invalid_requests(): array {
		return array(
			'bad preference' => array( 'fotogrids_settings_mode', 'advanced' ),
			'bad mode'       => array( 'settings_mode', 'expert' ),
			'bad tip value'  => array( 'settings_mode_tip_dismissed', '0' ),
		);
	}

	public function test_preference_request_reports_a_failed_write(): void {
		$GLOBALS['fotogrids_test_fail_writes'] = true;

		$result = Settings_Mode::handle_preference_request( 5, true, 'settings_mode', 'advanced' );

		$this->assertSame( Settings_Mode::ERROR_FAILED, $result['error'] );
	}

	public function test_preference_request_writes_only_that_users_meta(): void {
		$this->set_site_mode( 'easy' );

		$this->assertSame(
			array(
				'ok'    => true,
				'value' => 'advanced',
			),
			Settings_Mode::handle_preference_request( 5, true, 'settings_mode', 'advanced' )
		);
		$this->assertSame(
			array(
				'ok'    => true,
				'value' => '1',
			),
			Settings_Mode::handle_preference_request( 5, true, 'settings_mode_tip_dismissed', '1' )
		);

		$this->assertSame(
			array(
				5 => array(
					'fotogrids_settings_mode'               => 'advanced',
					'fotogrids_settings_mode_tip_dismissed' => '1',
				),
			),
			$GLOBALS['fotogrids_test_user_meta']
		);
		$this->assertSame( 'easy', $GLOBALS['fotogrids_test_options']['fotogrids_settings_mode'] );
	}
}
