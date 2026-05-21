<?php
declare(strict_types=1);

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

namespace FotoGrids\Tests\Integration;

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

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/enum-columns-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/enum-render-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/enum-request-source.php';
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

    public function structural_data_attrs( Render_Context $render_context ): array {
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
        self::test_render_output_emits_scoped_vars_style_tag();
        self::test_error_markup_visibility_respects_settings_flag();
    }

    private static function test_wrapper_includes_required_class_and_data_attribute(): void {
        Module_Registry::reset();
        Module_Registry::register( 'layouts', Parity_Layout_Module::class );

        $render_result = Render_Controller::factory()->render( self::make_context( true ) );

        self::assert_contains( 'class="fg-layout-grid fotogrids-gallery"', $render_result->html, 'Wrapper should include fotogrids-gallery class.' );
        self::assert_contains( 'data-gallery-id="321"', $render_result->html, 'Wrapper should expose gallery ID as data attribute.' );
    }

    private static function test_render_output_emits_scoped_vars_style_tag(): void {
        Module_Registry::reset();
        Module_Registry::register( 'layouts', Parity_Layout_Module::class );

        $render_result = Render_Controller::factory()->render( self::make_context( true ) );

        self::assert_contains( '<style class="fg-vars">', $render_result->html, 'Render path should include scoped variable style tag.' );
        self::assert_contains( '#fg-instance-321 {', $render_result->html, 'Scoped variable style should target wrapper instance ID.' );
        self::assert_contains( '--fg-gap-d: 10px;', $render_result->html, 'Scoped variable style should use readable declaration formatting.' );
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
                captions_enabled: true,
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
}

if ( PHP_SAPI === 'cli' && basename( __FILE__ ) === basename( (string) ( $_SERVER['SCRIPT_FILENAME'] ?? '' ) ) ) {
    PublicRenderParityTest::run();
    fwrite( STDOUT, "PublicRenderParityTest passed\n" );
}
