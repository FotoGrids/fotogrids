<?php
declare(strict_types=1);

namespace {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }
    if ( ! defined( 'ABSPATH' ) ) {
        define( 'ABSPATH', __DIR__ . '/' );
    }

    if ( ! function_exists( 'apply_filters' ) ) {
        function apply_filters( string $hook_name, mixed $value, mixed ...$args ): mixed {
            return $value;
        }
    }

    if ( ! function_exists( 'do_action' ) ) {
        function do_action( string $hook_name, mixed ...$args ): void {}
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

    function rest_ensure_response( mixed $value ): \WP_REST_Response {
        if ( $value instanceof \WP_REST_Response ) {
            return $value;
        }

        return new \WP_REST_Response( is_array( $value ) ? $value : [ $value ] );
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
    use FotoGrids\REST\Admin\Catalog_Field_States_Endpoint;

    require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-catalog.php';
    require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-field-state.php';
    require_once dirname( __DIR__, 2 ) . '/src/includes/catalog/class-state-resolver.php';
    require_once dirname( __DIR__, 2 ) . '/src/includes/catalog/class-catalog-rest-endpoint.php';
    require_once dirname( __DIR__, 2 ) . '/src/includes/rest/admin/class-catalog-field-states-endpoint.php';

    /**
     * Integration tests for the catalog field-states endpoint.
     *
     * State is derived statically from each field's declared tier with no
     * license or plan check: free fields are editable, higher-tier fields are
     * a static teaser.
     *
     * @package FotoGrids\Tests\Integration
     * @since   1.0.0
     */
    final class CatalogFieldStatesEndpointTest {
        public static function run(): void {
            self::test_free_field_is_editable();
            self::test_higher_tier_field_is_teaser();
            self::test_payload_carries_no_simulate_state();
        }

        private static function seed_catalog(): void {
            Catalog::$entries = [
                'hover_effect' => [ 'tier_required' => 'pro_starter' ],
                'layout'       => [ 'tier_required' => 'free' ],
            ];
        }

        private static function test_free_field_is_editable(): void {
            self::seed_catalog();

            $result = Catalog_Field_States_Endpoint::get_field_states( new \WP_REST_Request() );

            self::assert_same(
                'editable',
                $result['field_states']['layout'],
                'A free-tier field resolves to editable.'
            );
        }

        private static function test_higher_tier_field_is_teaser(): void {
            self::seed_catalog();

            $result = Catalog_Field_States_Endpoint::get_field_states( new \WP_REST_Request() );

            self::assert_same(
                'teaser',
                $result['field_states']['hover_effect'],
                'A higher-tier field resolves to a static teaser (no license check).'
            );
        }

        private static function test_payload_carries_no_simulate_state(): void {
            self::seed_catalog();

            $result = Catalog_Field_States_Endpoint::get_field_states( new \WP_REST_Request() );

            self::assert_same(
                false,
                isset( $result['simulate_state'] ),
                'The payload no longer carries a simulate_state key.'
            );
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
