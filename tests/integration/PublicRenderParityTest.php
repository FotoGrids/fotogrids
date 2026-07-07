<?php
declare(strict_types=1);

namespace {
    // Some shipped files guard on WPINC, others on ABSPATH; define both so
    // requiring them under the CLI test harness does not silently exit.
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }
    if ( ! defined( 'ABSPATH' ) ) {
        define( 'ABSPATH', '/tmp/wp/' );
    }
    if ( ! defined( 'FOTOGRIDS_PLUGIN_DIR' ) ) {
        define( 'FOTOGRIDS_PLUGIN_DIR', dirname( __DIR__, 1 ) . '/src/' );
    }
    if ( ! defined( 'FOTOGRIDS_PLUGIN_URL' ) ) {
        define( 'FOTOGRIDS_PLUGIN_URL', 'https://example.com/wp-content/plugins/fotogrids/' );
    }
    if ( ! defined( 'FOTOGRIDS_VERSION' ) ) {
        define( 'FOTOGRIDS_VERSION', '1.0.0' );
    }

    // Global WordPress-function stubs. Unqualified calls from any namespace in
    // the render pipeline fall back to the global namespace, so these cover the
    // pipeline regardless of which namespace makes the call.
    if ( ! function_exists( 'get_option' ) ) {
        function get_option( string $option, mixed $default_value = false ): mixed {
            unset( $option );
            return $default_value;
        }
    }
    if ( ! function_exists( 'apply_filters' ) ) {
        function apply_filters( string $hook_name, mixed $value, mixed ...$args ): mixed {
            unset( $hook_name, $args );
            return $value;
        }
    }
    if ( ! function_exists( 'do_action' ) ) {
        function do_action( string $hook_name, mixed ...$args ): void {
            unset( $hook_name, $args );
        }
    }
    if ( ! function_exists( 'esc_attr' ) ) {
        function esc_attr( mixed $value ): string {
            return (string) $value;
        }
    }
    if ( ! function_exists( 'esc_html' ) ) {
        function esc_html( mixed $value ): string {
            return (string) $value;
        }
    }
    if ( ! function_exists( 'esc_url' ) ) {
        function esc_url( mixed $value ): string {
            return (string) $value;
        }
    }
    if ( ! function_exists( 'absint' ) ) {
        function absint( mixed $value ): int {
            return abs( (int) $value );
        }
    }
    if ( ! function_exists( 'wp_json_encode' ) ) {
        function wp_json_encode( mixed $value, int $flags = 0, int $depth = 512 ): string|false {
            return json_encode( $value, $flags, $depth );
        }
    }
    if ( ! function_exists( 'wp_register_script' ) ) {
        function wp_register_script(): bool {
            return true;
        }
    }
    if ( ! function_exists( 'wp_enqueue_script' ) ) {
        function wp_enqueue_script(): void {}
    }
    if ( ! function_exists( 'wp_enqueue_style' ) ) {
        function wp_enqueue_style(): void {}
    }
    if ( ! function_exists( 'wp_parse_args' ) ) {
        /**
         * @param array<string, mixed>|object|string $args
         * @param array<string, mixed>               $defaults
         * @return array<string, mixed>
         */
        function wp_parse_args( mixed $args, array $defaults = array() ): array {
            if ( is_object( $args ) ) {
                $args = get_object_vars( $args );
            }
            if ( ! is_array( $args ) ) {
                parse_str( (string) $args, $args );
            }
            return array_merge( $defaults, $args );
        }
    }
    if ( ! function_exists( 'sanitize_text_field' ) ) {
        function sanitize_text_field( string $value ): string {
            return trim( $value );
        }
    }
    if ( ! function_exists( 'sanitize_key' ) ) {
        function sanitize_key( string $key ): string {
            return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', strtolower( $key ) ) ?? '' );
        }
    }
    if ( ! function_exists( 'wp_kses_post' ) ) {
        function wp_kses_post( string $value ): string {
            return $value;
        }
    }
    if ( ! function_exists( 'wp_unslash' ) ) {
        function wp_unslash( mixed $value ): mixed {
            return $value;
        }
    }
    if ( ! function_exists( 'is_admin' ) ) {
        function is_admin(): bool {
            return false;
        }
    }
    if ( ! function_exists( 'did_action' ) ) {
        function did_action( string $hook_name ): int {
            unset( $hook_name );
            return 0;
        }
    }
    if ( ! function_exists( 'doing_action' ) ) {
        function doing_action( ?string $hook_name = null ): bool {
            unset( $hook_name );
            return false;
        }
    }
    if ( ! function_exists( 'add_filter' ) ) {
        function add_filter(): bool {
            return true;
        }
    }
    if ( ! function_exists( 'add_action' ) ) {
        function add_action(): bool {
            return true;
        }
    }
    if ( ! function_exists( 'remove_filter' ) ) {
        function remove_filter(): bool {
            return true;
        }
    }
    if ( ! function_exists( 'wp_get_attachment_image_srcset' ) ) {
        function wp_get_attachment_image_srcset(): string|false {
            return false;
        }
    }
    if ( ! function_exists( 'wp_get_attachment_image_sizes' ) ) {
        function wp_get_attachment_image_sizes(): string|false {
            return false;
        }
    }
    if ( ! function_exists( 'wp_get_attachment_image_url' ) ) {
        function wp_get_attachment_image_url(): string|false {
            return false;
        }
    }
    if ( ! function_exists( 'esc_attr__' ) ) {
        function esc_attr__( string $text, string $domain = '' ): string {
            unset( $domain );
            return $text;
        }
    }
    if ( ! function_exists( 'esc_html__' ) ) {
        function esc_html__( string $text, string $domain = '' ): string {
            unset( $domain );
            return $text;
        }
    }
    if ( ! function_exists( '__' ) ) {
        function __( string $text, string $domain = '' ): string {
            unset( $domain );
            return $text;
        }
    }
}

namespace FotoGrids\Render\Internal {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }

    function do_action( string $hook_name, mixed ...$args ): void {
        unset( $hook_name, $args );
    }

    function apply_filters( string $hook_name, mixed $value, mixed ...$args ): mixed {
        unset( $hook_name, $args );
        return $value;
    }

    function esc_attr( mixed $value ): string {
        return (string) $value;
    }

    function esc_html( mixed $value ): string {
        return (string) $value;
    }

    function esc_url( mixed $value ): string {
        return (string) $value;
    }

    function error_log( string $message ): bool {
        unset( $message );
        return true;
    }
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Internal\Item_Renderer;
use FotoGrids\Render\Internal\Module_Registry;
use FotoGrids\Render\Internal\Render_Controller;

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-columns-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-request-source.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-collection-kind.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-item-view.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-module-assets.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-meta.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-layout.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-behavior.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-context.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/interface-gate.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/interface-decorator.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/interface-layout.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/interface-feature.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/interface-sidecar.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-render-result.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-hooks.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-style-var-builder.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-asset-resolver.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-item-renderer.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-module-registry.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-render-controller.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-breakpoint-config.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-render.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/watermark/class-watermark-render-filter.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/settings/class-watermark-settings-store.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-watermark.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/class-debug-log.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-layout-wrapper-composer.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-layout-capabilities.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-responsive-var.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/video/class-video-item-helpers.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/assets/class-loading-icon-library.php';

/**
 * Layout stub used for public render parity checks.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class Parity_Layout_Module implements Layout {
    public function id(): string {
        return 'tests/parity-layout';
    }

    public function origin(): string {
        return 'fotogrids';
    }

    public function replaces(): ?string {
        return null;
    }

    public function extends_id(): ?string {
        return null;
    }

    public function layout_key(): string {
        return 'grid';
    }

    public function supports( Render_Context $render_context ): bool {
        return $render_context->layout->layout_id === 'grid';
    }

    public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
        $items_html = '';
        foreach ( $render_context->items as $item_view ) {
            $items_html .= $item_renderer->render( $item_view, $render_context );
        }
        return '<div class="fg-parity-track">' . $items_html . '</div>';
    }

    public function structural_classes( Render_Context $render_context ): array {
        unset( $render_context );
        return [ 'fg-layout-grid' ];
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        unset( $render_context );
        return [ 'data-layout' => 'grid' ];
    }

    public function style_vars( Render_Context $render_context ): array {
        unset( $render_context );
        return [ '--fg-gap-d' => '10px' ];
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        unset( $render_context );
        return new Module_Assets();
    }

    public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
        unset( $render_context );
        return null;
    }

    public function requires_thumbnail_size( Render_Context $render_context ): bool {
        unset( $render_context );
        return false;
    }

    /**
     * @return array<string, bool>
     */
    public function capabilities(): array {
        return [];
    }
}

/**
 * Integration tests for public render output parity.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class PublicRenderParityTest {
    public static function run(): void {
        self::test_wrapper_includes_required_class_and_data_attribute();
        self::test_render_output_emits_scoped_vars_as_inline_css();
        self::test_error_markup_visibility_respects_settings_flag();
    }

    private static function test_wrapper_includes_required_class_and_data_attribute(): void {
        Module_Registry::reset();
        Module_Registry::register( 'layouts', Parity_Layout_Module::class );

        $render_result = Render_Controller::factory()->render( self::make_context( true ) );

        self::assert_contains( 'fotogrids-gallery', $render_result->html, 'Wrapper should include fotogrids-gallery class.' );
        self::assert_contains( 'fg-layout-grid', $render_result->html, 'Wrapper should include the layout structural class.' );
        self::assert_contains( 'data-fg-gallery-id="321"', $render_result->html, 'Wrapper should expose gallery ID via the data-fg-* attribute convention.' );
    }

    private static function test_render_output_emits_scoped_vars_as_inline_css(): void {
        Module_Registry::reset();
        Module_Registry::register( 'layouts', Parity_Layout_Module::class );

        $render_result = Render_Controller::factory()->render( self::make_context( true ) );

        // Per-instance CSS variables are carried on Render_Result::inline_css
        // (enqueued on page renders / returned for AJAX), NOT embedded as an
        // inline <style> in the markup - so the markup can pass through wp_kses().
        self::assert_not_contains( '<style', $render_result->html, 'Render markup must not embed an inline <style> tag.' );
        self::assert_contains( '#fg-instance-321 {', $render_result->inline_css, 'Scoped variables should be emitted as inline_css targeting the wrapper instance ID.' );
        self::assert_contains( '--fg-gap-d: 10px;', $render_result->inline_css, 'inline_css should use readable declaration formatting.' );
    }

    private static function test_error_markup_visibility_respects_settings_flag(): void {
        Module_Registry::reset();

        $hidden_error_result = Render_Controller::factory()->render( self::make_context( false ) );
        self::assert_same( '<div class="fotogrids-error" hidden></div>', $hidden_error_result->html, 'Public error should remain hidden.' );

        $visible_error_result = Render_Controller::factory()->render( self::make_context( true, show_error: true, layout_id: 'carousel' ) );
        self::assert_contains( '<div class="fotogrids-error">', $visible_error_result->html, 'Admin-visible error block should be present when enabled.' );
    }

    private static function make_context( bool $with_item, bool $show_error = false, string $layout_id = 'grid' ): Render_Context {
        $items = [];
        if ( $with_item ) {
            $items[] = new Item_View(
                id: 11,
                thumb_url: 'https://example.com/thumb.jpg',
                full_url: 'https://example.com/full.jpg',
                alt: 'Item alt',
                title: 'Item title',
                caption: 'Item caption',
                description: 'Item description',
                width: 800,
                height: 600
            );
        }

        return new Render_Context(
            meta: new Render_Meta(
                gallery_id: 321,
                album_id: null,
                instance_id: 'fg-instance-321',
                source: Request_Source::SHORTCODE,
                is_preview: false,
                mode: Render_Mode::INITIAL,
                schema_version: 2
            ),
            layout: new Render_Layout(
                layout_id: $layout_id,
                columns_mode: Columns_Mode::FIXED,
                responsive_columns: [ 'desktop' => 3, 'tablet' => 2, 'mobile' => 1 ],
                responsive_spacing: [ 'desktop' => 10, 'tablet' => 8, 'mobile' => 6 ],
                columns_auto_range: []
            ),
            behavior: new Render_Behavior(
                click_behavior: 'lightbox',
                pagination_type: 'show_all',
                pagination_method: 'load_more',
                hover_effect: null
            ),
            settings: $show_error ? [ '_show_render_errors' => true ] : [],
            items: $items,
            warnings: []
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

    private static function assert_contains( string $needle, string $haystack, string $message ): void {
        if ( strpos( $haystack, $needle ) === false ) {
            throw new \RuntimeException( $message . ' Missing fragment: ' . $needle );
        }
    }

    private static function assert_not_contains( string $needle, string $haystack, string $message ): void {
        if ( strpos( $haystack, $needle ) !== false ) {
            throw new \RuntimeException( $message . ' Unexpected fragment present: ' . $needle );
        }
    }
}

if ( PHP_SAPI === 'cli' && basename( __FILE__ ) === basename( (string) ( $_SERVER['SCRIPT_FILENAME'] ?? '' ) ) ) {
    PublicRenderParityTest::run();
    fwrite( STDOUT, "PublicRenderParityTest passed\n" );
}
}
