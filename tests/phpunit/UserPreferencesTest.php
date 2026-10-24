<?php
/**
 * User_Preferences request handling.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Admin\User_Preferences;
use FotoGrids\Hooks\Filters_Admin;
use PHPUnit\Framework\TestCase;

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/filters/class-filters-admin.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-user-preferences.php';

final class UserPreferencesTest extends TestCase {

	/**
	 * Values passed to the test handler's save callback.
	 *
	 * @var array<int, array{0:int,1:string}>
	 */
	private $saved = array();

	protected function setUp(): void {
		$this->saved = array();
		$this->use_handlers(
			array(
				'colour' => array(
					'validate' => static function ( string $value ): ?string {
						return in_array( $value, array( 'red', 'blue' ), true ) ? $value : null;
					},
					'save'     => function ( int $user_id, string $value ): bool {
						$this->saved[] = array( $user_id, $value );
						return 'blue' !== $value;
					},
				),
			)
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['fotogrids_test_filters'] );
	}

	/**
	 * @param mixed $handlers Value the preference filter returns.
	 */
	private function use_handlers( $handlers ): void {
		$GLOBALS['fotogrids_test_filters'] = array(
			Filters_Admin::USER_PREFERENCES => static function () use ( $handlers ) {
				return $handlers;
			},
		);
	}

	public function test_stores_a_valid_preference(): void {
		$this->assertSame(
			array(
				'ok'    => true,
				'value' => 'red',
			),
			User_Preferences::handle_request( 7, true, 'colour', 'red' )
		);
		$this->assertSame( array( array( 7, 'red' ) ), $this->saved );
	}

	public function test_rejects_a_logged_out_user_or_one_without_read(): void {
		$this->assertSame( User_Preferences::ERROR_FORBIDDEN, User_Preferences::handle_request( 0, true, 'colour', 'red' )['error'] );
		$this->assertSame( User_Preferences::ERROR_FORBIDDEN, User_Preferences::handle_request( 7, false, 'colour', 'red' )['error'] );
		$this->assertSame( array(), $this->saved );
	}

	public function test_rejects_an_unknown_preference_or_value(): void {
		$this->assertSame( User_Preferences::ERROR_INVALID, User_Preferences::handle_request( 7, true, 'size', 'red' )['error'] );
		$this->assertSame( User_Preferences::ERROR_INVALID, User_Preferences::handle_request( 7, true, 'colour', 'green' )['error'] );
		$this->assertSame( array(), $this->saved );
	}

	public function test_reports_a_failed_save(): void {
		$result = User_Preferences::handle_request( 7, true, 'colour', 'blue' );

		$this->assertFalse( $result['ok'] );
		$this->assertSame( User_Preferences::ERROR_FAILED, $result['error'] );
	}

	public function test_drops_malformed_handlers(): void {
		$this->use_handlers(
			array(
				'no-save'      => array( 'validate' => 'strval' ),
				'not-callable' => array(
					'validate' => 'no_such_function_here',
					'save'     => 'strval',
				),
				0              => array(
					'validate' => 'strval',
					'save'     => 'strval',
				),
				'ok'           => array(
					'validate' => 'strval',
					'save'     => 'is_int',
				),
			)
		);

		$this->assertSame( array( 'ok' ), array_keys( User_Preferences::handlers() ) );
	}

	public function test_a_non_array_filter_result_registers_nothing(): void {
		$this->use_handlers( 'colour' );

		$this->assertSame( array(), User_Preferences::handlers() );
		$this->assertSame( User_Preferences::ERROR_INVALID, User_Preferences::handle_request( 7, true, 'colour', 'red' )['error'] );
	}

	public function test_a_validator_returning_a_non_string_is_invalid(): void {
		$this->use_handlers(
			array(
				'flag' => array(
					'validate' => static function () {
						return true;
					},
					'save'     => static function (): bool {
						return true;
					},
				),
			)
		);

		$this->assertSame( User_Preferences::ERROR_INVALID, User_Preferences::handle_request( 7, true, 'flag', '1' )['error'] );
	}

	public function test_a_save_returning_a_truthy_non_bool_counts_as_failed(): void {
		$this->use_handlers(
			array(
				'flag' => array(
					'validate' => 'strval',
					'save'     => static function () {
						return 1;
					},
				),
			)
		);

		$this->assertSame( User_Preferences::ERROR_FAILED, User_Preferences::handle_request( 7, true, 'flag', '1' )['error'] );
	}
}
