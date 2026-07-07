<?php
declare(strict_types=1);

namespace {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }

    if ( ! class_exists( 'WP_Error' ) ) {
        class WP_Error {
            public function __construct(
                public string $code,
                public string $message = '',
                public array $data = []
            ) {}
        }
    }

    if ( ! class_exists( 'WP_REST_Request' ) ) {
        class WP_REST_Request {
            /**
             * @param array<string, mixed> $params
             */
            public function __construct( private array $params = [] ) {}

            public function get_param( string $key ): mixed {
                return $this->params[ $key ] ?? null;
            }
        }
    }

    // Global-namespace stub: string callbacks such as array_map( 'absint', ... )
    // resolve in the global namespace, not the caller's namespace.
    if ( ! function_exists( 'absint' ) ) {
        function absint( mixed $value ): int {
            return abs( (int) $value );
        }
    }

    if ( ! function_exists( 'esc_url_raw' ) ) {
        function esc_url_raw( string $url ): string {
            return $url;
        }
    }

    if ( ! function_exists( 'rest_url' ) ) {
        function rest_url( string $path = '' ): string {
            return 'https://example.com/wp-json/' . ltrim( $path, '/' );
        }
    }

    if ( ! function_exists( 'wp_create_nonce' ) ) {
        function wp_create_nonce( string $action = '' ): string {
            unset( $action );
            return 'test-nonce';
        }
    }

    if ( ! function_exists( 'do_action' ) ) {
        function do_action( string $hook_name, mixed ...$args ): void {
            unset( $hook_name, $args );
        }
    }

    if ( ! function_exists( 'wp_scripts' ) ) {
        function wp_scripts(): object {
            return new class() {
                /**
                 * @var array<string, object>
                 */
                public array $registered = [];

                public function get_data( string $handle, string $key ): mixed {
                    unset( $handle, $key );
                    return false;
                }
            };
        }
    }
}

namespace FotoGrids\Render\Internal {
    final class Preview_Test_Render_Context {
        /**
         * @param array<string, mixed> $settings
         * @param array<int, string>   $warnings
         */
        public function __construct(
            public array $settings = [],
            public array $warnings = []
        ) {}

        /**
         * @param array<string, mixed> $changes
         */
        public function with( array $changes ): self {
            return new self(
                settings: $changes['settings'] ?? $this->settings,
                warnings: $changes['warnings'] ?? $this->warnings
            );
        }
    }

    final class Context_Builder {
        /**
         * @var array<string, mixed>
         */
        public static array $last_args = [];

        public static function for_preview(): self {
            return new self();
        }

        /**
         * @param array<string, mixed> $base_settings
         * @param array<string, mixed> $settings_overlay
         * @param array<int, int>      $collection_item_ids
         * @param array<int|string, array<string, mixed>> $item_overrides
         */
        public function build_for_preview(
            int $gallery_id,
            array $base_settings = [],
            array $settings_overlay = [],
            array $collection_item_ids = [],
            array $item_overrides = [],
            mixed $source = null,
            ?string $simulate_state = null
        ): Preview_Test_Render_Context {
            self::$last_args = [
                'gallery_id' => $gallery_id,
                'base_settings' => $base_settings,
                'settings_overlay' => $settings_overlay,
                'collection_item_ids' => $collection_item_ids,
                'item_overrides' => $item_overrides,
                'source' => $source,
                'simulate_state' => $simulate_state,
            ];

            return new Preview_Test_Render_Context(
                settings: array_replace_recursive( $base_settings, $settings_overlay ),
                warnings: []
            );
        }
    }

    final class Render_Controller {
        public static ?Preview_Test_Render_Context $last_context = null;

        public static function factory(): self {
            return new self();
        }

        public function render( Preview_Test_Render_Context $render_context ): object {
            self::$last_context = $render_context;
            return (object) [
                'html' => '<div class="fg-preview">ok</div>',
                'instance_id' => 'fg-preview-1',
                'active_modules' => [ 'layouts' => [ 'fotogrids/grid' ] ],
                'http_status' => 200,
                'inline_css' => '',
                'inline_js' => '',
                'json_ld' => '',
            ];
        }
    }

    final class Asset_Resolver {
        private static ?self $instance = null;

        public static function instance(): self {
            if ( self::$instance === null ) {
                self::$instance = new self();
            }

            return self::$instance;
        }

        /**
         * @return array<string, string>
         */
        public function get_css_asset_urls(): array {
            return [];
        }

        /**
         * @return array<string, mixed>
         */
        public function get_js_asset_data(): array {
            return [];
        }
    }
}

namespace FotoGrids\Hooks {
    final class Actions_Render {
        public const LATE_ASSETS = 'fotogrids/render/late_assets';
    }
}

namespace FotoGrids\Settings {
    final class Sharing_Settings_Store {
        /**
         * @return array<string, mixed>
         */
        public static function get(): array {
            return [
                'deep_linking_enabled'  => false,
                'embedded_share_target' => '',
            ];
        }
    }
}

namespace FotoGrids\REST\Admin {
    final class Preview_Endpoint_Test_Doubles {
        public static mixed $post = null;

        /**
         * @var array<int, int>
         */
        public static array $gallery_item_ids = [ 9, 7, 5 ];

        /**
         * @var array<string, mixed>
         */
        public static array $gallery_settings = [ 'layout' => 'grid' ];

        public static bool $can_edit_posts = true;
        public static bool $can_manage_settings = false;
    }

    function absint( mixed $value ): int {
        return abs( (int) $value );
    }

    function __( string $value, string $domain = '' ): string {
        unset( $domain );
        return $value;
    }

    function sanitize_text_field( string $value ): string {
        return trim( $value );
    }

    function is_wp_error( mixed $value ): bool {
        return $value instanceof \WP_Error;
    }

    function get_post( int $id ): mixed {
        unset( $id );
        return Preview_Endpoint_Test_Doubles::$post;
    }

    function current_user_can( string $capability ): bool {
        if ( $capability === 'manage_fotogrids_settings' ) {
            return Preview_Endpoint_Test_Doubles::$can_manage_settings;
        }

        if ( $capability === 'edit_posts' ) {
            return Preview_Endpoint_Test_Doubles::$can_edit_posts;
        }

        return false;
    }

    /**
     * @param array<string, mixed> $response
     * @return array<string, mixed>
     */
    function rest_ensure_response( array $response ): array {
        return $response;
    }
}

namespace FotoGrids\Galleries {

    use FotoGrids\REST\Admin\Preview_Endpoint_Test_Doubles;

    final class Gallery_Repository {
        /**
         * @return array<int, int>
         */
        public static function get_item_ids( int $gallery_id ): array {
            unset( $gallery_id );
            return Preview_Endpoint_Test_Doubles::$gallery_item_ids;
        }

        /**
         * @return array<string, mixed>
         */
        public static function get_settings( int $gallery_id ): array {
            unset( $gallery_id );
            return Preview_Endpoint_Test_Doubles::$gallery_settings;
        }
    }
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\REST\Admin\Preview_Endpoint;
use FotoGrids\REST\Admin\Preview_Endpoint_Test_Doubles;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Render_Controller;

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-request-source.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/rest/admin/class-preview-request-validator.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/rest/admin/class-preview-endpoint.php';

/**
 * Integration tests for preview endpoint request flow.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class PreviewEndpointTest {
    public static function run(): void {
        self::test_returns_not_found_error_when_gallery_missing();
        self::test_returns_validator_error_for_unsupported_version();
        self::test_builds_preview_response_from_valid_payload();
        self::test_drops_simulate_state_without_manage_settings_capability();
    }

    private static function test_returns_not_found_error_when_gallery_missing(): void {
        Preview_Endpoint_Test_Doubles::$post = null;
        $request = new \WP_REST_Request( [ 'id' => 77 ] );

        $result = Preview_Endpoint::preview( $request );

        self::assert_true( $result instanceof \WP_Error, 'Missing gallery should return WP_Error.' );
        self::assert_same( 'fotogrids_preview_gallery_not_found', $result->code, 'Unexpected error code for missing gallery.' );
    }

    private static function test_returns_validator_error_for_unsupported_version(): void {
        Preview_Endpoint_Test_Doubles::$post = (object) [ 'post_type' => 'fotogrids_gallery' ];
        $request = new \WP_REST_Request(
            [
                'id' => 12,
                'version' => 3,
            ]
        );

        $result = Preview_Endpoint::preview( $request );

        self::assert_true( $result instanceof \WP_Error, 'Unsupported preview version should return WP_Error.' );
        self::assert_same( 'fotogrids_preview_invalid_version', $result->code, 'Unexpected error code for invalid version.' );
    }

    private static function test_builds_preview_response_from_valid_payload(): void {
        Preview_Endpoint_Test_Doubles::$post = (object) [ 'post_type' => 'fotogrids_gallery' ];
        Preview_Endpoint_Test_Doubles::$gallery_item_ids = [ 41, 42, 43 ];
        Preview_Endpoint_Test_Doubles::$gallery_settings = [ 'layout' => 'grid' ];
        Preview_Endpoint_Test_Doubles::$can_edit_posts = true;
        Preview_Endpoint_Test_Doubles::$can_manage_settings = false;

        $request = new \WP_REST_Request(
            [
                'id' => 55,
                'version' => 2,
                'settings' => [ 'layout' => 'masonry' ],
                'item_order' => [],
                'item_overrides' => [ 41 => [ 'caption' => 'overridden' ] ],
                'simulate_state' => 'invalid-state',
            ]
        );

        $result = Preview_Endpoint::preview( $request );

        self::assert_true( is_array( $result ), 'Valid preview should return response array.' );
        self::assert_same( '<div class="fg-preview">ok</div>', $result['html'], 'Unexpected preview HTML.' );
        self::assert_same( 200, $result['http_status'], 'Unexpected preview status code.' );
        self::assert_same(
            [ 41, 42, 43 ],
            Context_Builder::$last_args['collection_item_ids'],
            'Endpoint should use gallery item fallback when item_order is empty.'
        );
        self::assert_same(
            null,
            Context_Builder::$last_args['simulate_state'],
            'Invalid simulate_state should be dropped by validator.'
        );
        self::assert_true(
            in_array( 'dropped unknown simulate_state: invalid-state', $result['meta']['warnings'], true ),
            'Validator warning should be propagated to response metadata.'
        );
        self::assert_true(
            Render_Controller::$last_context?->settings['_show_render_errors'] === true,
            'Preview context should include edit-capability based inline error visibility.'
        );
    }

    private static function test_drops_simulate_state_without_manage_settings_capability(): void {
        Preview_Endpoint_Test_Doubles::$post = (object) [ 'post_type' => 'fotogrids_gallery' ];
        Preview_Endpoint_Test_Doubles::$gallery_item_ids = [ 41, 42, 43 ];
        Preview_Endpoint_Test_Doubles::$gallery_settings = [ 'layout' => 'grid' ];
        Preview_Endpoint_Test_Doubles::$can_edit_posts = true;
        Preview_Endpoint_Test_Doubles::$can_manage_settings = false;

        $request = new \WP_REST_Request(
            [
                'id' => 55,
                'version' => 2,
                'settings' => [ 'layout' => 'masonry' ],
                'item_order' => [ 43, 41 ],
                'simulate_state' => 'ok',
            ]
        );

        $result = Preview_Endpoint::preview( $request );

        self::assert_true( is_array( $result ), 'Valid preview should return response array.' );
        self::assert_same(
            null,
            Context_Builder::$last_args['simulate_state'],
            'simulate_state should be dropped when user lacks manage settings capability.'
        );
        self::assert_true(
            in_array( 'dropped simulate_state: insufficient permission', $result['meta']['warnings'], true ),
            'Permission-drop warning should be propagated to response metadata.'
        );
    }

    private static function assert_true( bool $condition, string $message ): void {
        if ( ! $condition ) {
            throw new \RuntimeException( $message );
        }
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
    PreviewEndpointTest::run();
    fwrite( STDOUT, "PreviewEndpointTest passed\n" );
}
}
