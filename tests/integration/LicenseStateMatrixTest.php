<?php
declare(strict_types=1);

namespace {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }
}

namespace FotoGrids {
    final class License_Provider_Stub {
        /**
         * @param array<int, string> $allowed_tiers
         */
        public function __construct( private array $allowed_tiers ) {}

        public function is_on_plan( string $tier ): bool {
            return in_array( $tier, $this->allowed_tiers, true );
        }
    }

    final class License_Manager {
        public static ?License_Provider_Stub $provider = null;

        /**
         * @var array<string, bool>
         */
        public static array $status_data = [ 'is_valid' => false ];

        public static function provider(): License_Provider_Stub {
            if ( self::$provider === null ) {
                self::$provider = new License_Provider_Stub( [ 'free' ] );
            }

            return self::$provider;
        }

        /**
         * @return array<string, bool>
         */
        public static function get_license_status_data(): array {
            return self::$status_data;
        }
    }

    final class Debug_Log {
        public static function should_log( string $channel ): bool {
            return false;
        }

        public static function write( string $channel, string $message ): void {}
    }
}

namespace FotoGrids\Catalog {
    final class Catalog {
        /**
         * @var array<string, array<string, mixed>>
         */
        public static array $entries = [];

        /**
         * @return array<string, mixed>|null
         */
        public static function get( string $field_id ): ?array {
            return self::$entries[ $field_id ] ?? null;
        }
    }
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\Catalog\Catalog;
use FotoGrids\Catalog\State_Resolver;
use FotoGrids\License_Manager;
use FotoGrids\License_Provider_Stub;
use FotoGrids\Render\Api\Field_State;

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-field-state.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/catalog/class-state-resolver.php';

/**
 * Integration tests for edit-time license state transitions.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class LicenseStateMatrixTest {
    public static function run(): void {
        self::test_unknown_field_is_teaser();
        self::test_free_tier_field_is_editable_on_free_plan();
        self::test_pro_field_is_teaser_when_plan_does_not_include_tier();
        self::test_pro_field_is_locked_when_plan_matches_but_license_invalid();
        self::test_pro_field_is_editable_when_plan_matches_and_license_valid();
        self::test_option_tier_override_uses_option_requirement();
        self::test_simulate_state_ok_forces_editable_on_paid_field();
        self::test_simulate_state_expired_forces_locked_on_paid_field();
        self::test_simulate_state_unauthorized_forces_teaser_on_paid_field();
    }

    private static function test_unknown_field_is_teaser(): void {
        Catalog::$entries = [];
        License_Manager::$provider = new License_Provider_Stub( [ 'free', 'expert' ] );
        License_Manager::$status_data = [ 'is_valid' => true ];

        $state = State_Resolver::resolve( 'missing_field' );
        self::assert_same( Field_State::TEASER, $state, 'Unknown fields should resolve to TEASER state.' );
    }

    private static function test_free_tier_field_is_editable_on_free_plan(): void {
        Catalog::$entries = [
            'layout' => [ 'tier_required' => 'free' ],
        ];
        License_Manager::$provider = new License_Provider_Stub( [ 'free' ] );
        License_Manager::$status_data = [ 'is_valid' => false ];

        $state = State_Resolver::resolve( 'layout' );
        self::assert_same( Field_State::EDITABLE, $state, 'Free-tier fields should remain editable on free plan.' );
    }

    private static function test_pro_field_is_teaser_when_plan_does_not_include_tier(): void {
        Catalog::$entries = [
            'hover_effect' => [ 'tier_required' => 'expert' ],
        ];
        License_Manager::$provider = new License_Provider_Stub( [ 'free' ] );
        License_Manager::$status_data = [ 'is_valid' => true ];

        $state = State_Resolver::resolve( 'hover_effect' );
        self::assert_same( Field_State::TEASER, $state, 'Unavailable plan tier should resolve to TEASER.' );
    }

    private static function test_pro_field_is_locked_when_plan_matches_but_license_invalid(): void {
        Catalog::$entries = [
            'hover_effect' => [ 'tier_required' => 'expert' ],
        ];
        License_Manager::$provider = new License_Provider_Stub( [ 'free', 'expert' ] );
        License_Manager::$status_data = [ 'is_valid' => false ];

        $state = State_Resolver::resolve( 'hover_effect' );
        self::assert_same( Field_State::LOCKED, $state, 'Invalid license should lock non-free fields when tier is available.' );
    }

    private static function test_pro_field_is_editable_when_plan_matches_and_license_valid(): void {
        Catalog::$entries = [
            'hover_effect' => [ 'tier_required' => 'expert' ],
        ];
        License_Manager::$provider = new License_Provider_Stub( [ 'free', 'expert' ] );
        License_Manager::$status_data = [ 'is_valid' => true ];

        $state = State_Resolver::resolve( 'hover_effect' );
        self::assert_same( Field_State::EDITABLE, $state, 'Valid license should unlock eligible pro fields.' );
    }

    private static function test_option_tier_override_uses_option_requirement(): void {
        Catalog::$entries = [
            'layout' => [
                'tier_required' => 'free',
                'options' => [
                    'grid' => [ 'tier_required' => 'free' ],
                    'carousel' => [ 'tier_required' => 'expert' ],
                ],
            ],
        ];

        License_Manager::$provider = new License_Provider_Stub( [ 'free' ] );
        License_Manager::$status_data = [ 'is_valid' => true ];
        $teaser_state = State_Resolver::resolve( 'layout', 'carousel' );
        self::assert_same( Field_State::TEASER, $teaser_state, 'Option-level tier should gate unavailable options.' );

        License_Manager::$provider = new License_Provider_Stub( [ 'free', 'expert' ] );
        License_Manager::$status_data = [ 'is_valid' => true ];
        $editable_state = State_Resolver::resolve( 'layout', 'carousel' );
        self::assert_same( Field_State::EDITABLE, $editable_state, 'Option-level tier should be editable when plan allows it.' );
    }

    private static function test_simulate_state_ok_forces_editable_on_paid_field(): void {
        Catalog::$entries = [
            'hover_effect' => [ 'tier_required' => 'expert' ],
        ];

        License_Manager::$provider = new License_Provider_Stub( [ 'free' ] );
        License_Manager::$status_data = [ 'is_valid' => false ];

        $state = State_Resolver::resolve( 'hover_effect', null, 'ok' );
        self::assert_same( Field_State::EDITABLE, $state, 'simulate_state=ok should force EDITABLE for paid fields.' );
    }

    private static function test_simulate_state_expired_forces_locked_on_paid_field(): void {
        Catalog::$entries = [
            'hover_effect' => [ 'tier_required' => 'expert' ],
        ];

        License_Manager::$provider = new License_Provider_Stub( [ 'free' ] );
        License_Manager::$status_data = [ 'is_valid' => true ];

        $state = State_Resolver::resolve( 'hover_effect', null, 'expired' );
        self::assert_same( Field_State::LOCKED, $state, 'simulate_state=expired should force LOCKED for paid fields.' );
    }

    private static function test_simulate_state_unauthorized_forces_teaser_on_paid_field(): void {
        Catalog::$entries = [
            'hover_effect' => [ 'tier_required' => 'expert' ],
        ];

        License_Manager::$provider = new License_Provider_Stub( [ 'free', 'expert' ] );
        License_Manager::$status_data = [ 'is_valid' => true ];

        $state = State_Resolver::resolve( 'hover_effect', null, 'unauthorized' );
        self::assert_same( Field_State::TEASER, $state, 'simulate_state=unauthorized should force TEASER for paid fields.' );
    }

    private static function assert_same( mixed $expected, mixed $actual, string $message ): void {
        if ( $expected !== $actual ) {
            throw new \RuntimeException(
                $message . ' Expected: ' . var_export( $expected, true ) . '; Actual: ' . var_export( $actual, true )
            );
        }
    }
}

if ( PHP_SAPI === 'cli' && basename( __FILE__ ) === basename( (string) ( $_SERVER['SCRIPT_FILENAME'] ?? '' ) ) ) {
    LicenseStateMatrixTest::run();
    fwrite( STDOUT, "LicenseStateMatrixTest passed\n" );
}
}
