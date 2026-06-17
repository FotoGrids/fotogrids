<?php
declare(strict_types=1);

namespace {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }

    final class WP_REST_Request {
        /**
         * @param array<string, mixed> $params
         */
        public function __construct( private array $params = [] ) {}

        public function get_param( string $key ): mixed {
            return $this->params[ $key ] ?? null;
        }
    }

    /**
     * @implements \ArrayAccess<string, mixed>
     */
    final class WP_REST_Response implements \ArrayAccess {
        /**
         * @param array<string, mixed> $data
         */
        public function __construct( private array $data = [] ) {}

        /**
         * @return array<string, mixed>
         */
        public function get_data(): array {
            return $this->data;
        }

        public function offsetExists( mixed $offset ): bool {
            return isset( $this->data[ $offset ] );
        }

        public function offsetGet( mixed $offset ): mixed {
            return $this->data[ $offset ] ?? null;
        }

        public function offsetSet( mixed $offset, mixed $value ): void {
            if ( null === $offset ) {
                $this->data[] = $value;
            } else {
                $this->data[ $offset ] = $value;
            }
        }

        public function offsetUnset( mixed $offset ): void {
            unset( $this->data[ $offset ] );
        }
    }

    function sanitize_text_field( string $value ): string {
        return trim( $value );
    }

    function rest_ensure_response( mixed $value ): \WP_REST_Response {
        if ( $value instanceof \WP_REST_Response ) {
            return $value;
        }

        return new \WP_REST_Response( is_array( $value ) ? $value : [ $value ] );
    }

    /**
     * @var array<int, string>
     */
    $GLOBALS['fg_current_user_caps'] = [];

    function current_user_can( string $capability ): bool {
        return in_array( $capability, $GLOBALS['fg_current_user_caps'], true );
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

        /**
         * @return array<string, array<string, mixed>>
         */
        public static function all(): array {
            return self::$entries;
        }
    }
}

namespace FotoGrids\Tests\Integration {

    use FotoGrids\Catalog\Catalog;
    use FotoGrids\License_Manager;
    use FotoGrids\License_Provider_Stub;
    use FotoGrids\REST\Admin\Catalog_Field_States_Endpoint;

    require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-field-state.php';
    require_once dirname( __DIR__, 2 ) . '/src/includes/catalog/class-state-resolver.php';
    require_once dirname( __DIR__, 2 ) . '/src/includes/catalog/class-catalog-rest-endpoint.php';
    require_once dirname( __DIR__, 2 ) . '/src/includes/rest/admin/class-catalog-field-states-endpoint.php';

    /**
     * Integration tests for catalog field-states endpoint simulation behavior.
     *
     * @package FotoGrids\Tests\Integration
     * @since   1.0.0
     */
    final class CatalogFieldStatesEndpointTest {
        public static function run(): void {
            self::test_simulation_is_ignored_without_license_manage_capability();
            self::test_simulation_is_applied_with_license_manage_capability();
        }

        private static function seed_catalog_and_license(): void {
            Catalog::$entries = [
                'hover_effect' => [ 'tier_required' => 'expert' ],
                'layout' => [ 'tier_required' => 'free' ],
            ];
            License_Manager::$provider = new License_Provider_Stub( [ 'free' ] );
            License_Manager::$status_data = [ 'is_valid' => false ];
        }

        private static function test_simulation_is_ignored_without_license_manage_capability(): void {
            self::seed_catalog_and_license();
            $GLOBALS['fg_current_user_caps'] = [ 'edit_posts' ];

            $request = new \WP_REST_Request(
                [
                    'simulate_state' => 'ok',
                ]
            );

            $result = Catalog_Field_States_Endpoint::get_field_states( $request );

            self::assert_same(
                'locked',
                $result['field_states']['hover_effect'],
                'Without manage_fotogrids_settings, simulate_state should be ignored.'
            );
            self::assert_same( null, $result['simulate_state'], 'simulate_state should be null when dropped.' );
        }

        private static function test_simulation_is_applied_with_license_manage_capability(): void {
            self::seed_catalog_and_license();
            $GLOBALS['fg_current_user_caps'] = [ 'edit_posts', 'manage_fotogrids_settings' ];

            $request = new \WP_REST_Request(
                [
                    'simulate_state' => 'ok',
                ]
            );

            $result = Catalog_Field_States_Endpoint::get_field_states( $request );

            self::assert_same(
                'editable',
                $result['field_states']['hover_effect'],
                'With manage_fotogrids_settings, simulate_state should be applied.'
            );
            self::assert_same( 'ok', $result['simulate_state'], 'simulate_state should be preserved when allowed.' );
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
        CatalogFieldStatesEndpointTest::run();
        fwrite( STDOUT, "CatalogFieldStatesEndpointTest passed\n" );
    }
}
