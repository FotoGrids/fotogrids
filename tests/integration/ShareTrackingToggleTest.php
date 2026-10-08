<?php
declare(strict_types=1);

namespace {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }
    if ( ! defined( 'ABSPATH' ) ) {
        define( 'ABSPATH', __DIR__ . '/' );
    }

    $GLOBALS['fotogrids_test_options'] = [];
    $GLOBALS['fotogrids_test_actions'] = [];

    function apply_filters( string $hook_name, mixed $value, mixed ...$args ): mixed {
        return $value;
    }

    function do_action( string $hook_name, mixed ...$args ): void {
        $GLOBALS['fotogrids_test_actions'][] = $hook_name;
    }

    function get_option( string $option, mixed $default_value = false ): mixed {
        return $GLOBALS['fotogrids_test_options'][ $option ] ?? $default_value;
    }

    /**
     * @param array<string, mixed> $args
     * @param array<string, mixed> $defaults
     * @return array<string, mixed>
     */
    function wp_parse_args( array $args, array $defaults ): array {
        return array_merge( $defaults, $args );
    }

    function __( string $text, string $domain = 'default' ): string {
        return $text;
    }

    final class WP_Post {
        public function __construct( public string $post_type, public string $post_status ) {}
    }

    function get_post( int $id ): ?\WP_Post {
        return 42 === $id ? new \WP_Post( 'attachment', 'inherit' ) : null;
    }

    final class WP_Error {
        /**
         * @param array<string, mixed> $data
         */
        public function __construct( public string $code = '', public string $message = '', public array $data = [] ) {}
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

    final class WP_REST_Response {
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
    }

    function rest_ensure_response( mixed $value ): \WP_REST_Response {
        return $value instanceof \WP_REST_Response ? $value : new \WP_REST_Response( (array) $value );
    }
}

namespace FotoGrids {
    final class Statistics {
        /**
         * @var array<int, array{0: string, 1: int, 2: string}>
         */
        public static array $calls = [];

        public static function increment( string $object_type, int $object_id, string $metric ): bool {
            self::$calls[] = [ $object_type, $object_id, $metric ];
            return true;
        }
    }
}

namespace FotoGrids\Tests\Integration {

    use FotoGrids\Hooks\Actions_Gallery;
    use FotoGrids\REST\Stats\Stats_Data;
    use FotoGrids\Settings\Sharing_Settings_Store;
    use FotoGrids\Statistics;

    $src = dirname( __DIR__, 2 ) . '/src/';
    require_once $src . 'includes/hooks/filters/class-filters-sharing.php';
    require_once $src . 'includes/hooks/actions/class-actions-gallery.php';
    require_once $src . 'includes/settings/class-sharing-settings-store.php';
    require_once $src . 'includes/galleries/class-embed-store.php';
    require_once $src . 'includes/rest/stats/stats-data.php';

    /**
     * The Track share clicks setting decides whether POST /stats/share records anything.
     *
     * @package FotoGrids\Tests\Integration
     * @since   1.2.0
     */
    final class ShareTrackingToggleTest {
        public static function run(): void {
            self::test_off_records_nothing();
            self::test_on_records_share();
            self::test_default_records_share();
            self::test_off_missing_object_is_not_found();
        }

        private static function share( ?bool $track_clicks, int $object_id = 42 ): \WP_REST_Response|\WP_Error {
            Statistics::$calls                 = [];
            $GLOBALS['fotogrids_test_actions'] = [];
            $GLOBALS['fotogrids_test_options'] = null === $track_clicks
                ? []
                : [ Sharing_Settings_Store::OPTION => [ 'track_clicks' => $track_clicks ] ];

            return Stats_Data::increment_share(
                new \WP_REST_Request(
                    [
                        'object_type' => 'item',
                        'object_id'   => $object_id,
                        'network'     => 'facebook',
                    ]
                )
            );
        }

        private static function test_off_records_nothing(): void {
            $response = self::share( false );

            self::assert_same( true, $response instanceof \WP_REST_Response, 'Tracking off still answers with a success response.' );
            self::assert_same( [], Statistics::$calls, 'Tracking off increments no counter.' );
            self::assert_same( [], $GLOBALS['fotogrids_test_actions'], 'Tracking off fires no share-tracked action.' );
        }

        private static function test_on_records_share(): void {
            self::share( true );

            self::assert_same( [ [ 'item', 42, 'shares' ] ], Statistics::$calls, 'Tracking on increments the item share count.' );
            self::assert_same( [ Actions_Gallery::SHARE_TRACKED ], $GLOBALS['fotogrids_test_actions'], 'Tracking on fires the share-tracked action.' );
        }

        private static function test_default_records_share(): void {
            self::share( null );

            self::assert_same( 1, count( Statistics::$calls ), 'With nothing saved, tracking follows its default of on.' );
        }

        private static function test_off_missing_object_is_not_found(): void {
            $response = self::share( false, 99999 );

            self::assert_same( true, $response instanceof \WP_Error && 404 === $response->data['status'], 'Tracking off still answers 404 for an object that does not exist.' );
            self::assert_same( [], Statistics::$calls, 'A missing object increments no counter.' );
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
        ShareTrackingToggleTest::run();
        fwrite( STDOUT, "ShareTrackingToggleTest passed\n" );
    }
}
