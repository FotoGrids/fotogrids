<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

if ( ! defined( 'WPINC' ) ) {
    define( 'WPINC', 'wp-includes' );
}

final class Hook_Spy {
    /** @var array<int, string> */
    public static array $actions = [];

    /** @var array<int, string> */
    public static array $filters = [];

    /** @var array<string, array<int, callable>> */
    public static array $filter_handlers = [];

    public static function reset(): void {
        self::$actions = [];
        self::$filters = [];
        self::$filter_handlers = [];
    }
}

function do_action( string $hook_name, mixed ...$args ): void {
    unset( $args );
    Hook_Spy::$actions[] = $hook_name;
}

function apply_filters( string $hook_name, mixed $value, mixed ...$args ): mixed {
    unset( $args );
    Hook_Spy::$filters[] = $hook_name;

    if ( isset( Hook_Spy::$filter_handlers[ $hook_name ] ) ) {
        foreach ( Hook_Spy::$filter_handlers[ $hook_name ] as $handler ) {
            $value = $handler( $value );
        }
    }

    return $value;
}

namespace FotoGrids\Tests\Integration;

use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Internal\Hooks;
use FotoGrids\Render\Internal\Hook_Spy;

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-columns-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-request-source.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-meta.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-layout.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-behavior.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-context.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-hooks.php';

/**
 * Integration tests for render hook ordering variants.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class HookFiringOrderTest {
    public static function run(): void {
        self::test_action_order_for_gallery_scope();
        self::test_filter_order_and_value_propagation_for_gallery_scope();
        self::test_action_order_for_album_scope();
    }

    private static function test_action_order_for_gallery_scope(): void {
        Hook_Spy::reset();
        $render_context = self::make_render_context( Request_Source::SHORTCODE, 42, null );

        Hooks::fire_action( 'before_render', $render_context );

        self::assert_same(
            [
                'fotogrids/render/before_render',
                'fotogrids/render/before_render/gallery',
                'fotogrids/render/before_render/gallery/42',
            ],
            Hook_Spy::$actions,
            'Action hook order does not match gallery scoped ordering.'
        );
    }

    private static function test_filter_order_and_value_propagation_for_gallery_scope(): void {
        Hook_Spy::reset();
        $render_context = self::make_render_context( Request_Source::SHORTCODE, 13, null );

        Hook_Spy::$filter_handlers['fotogrids/render/css_variables'][] = static fn( string $value ): string => $value . '-flat';
        Hook_Spy::$filter_handlers['fotogrids/render/css_variables/gallery'][] = static fn( string $value ): string => $value . '-type';
        Hook_Spy::$filter_handlers['fotogrids/render/css_variables/gallery/13'][] = static fn( string $value ): string => $value . '-scoped';

        $filtered_value = Hooks::apply_filter( 'css_variables', 'seed', $render_context );

        self::assert_same( 'seed-flat-type-scoped', $filtered_value, 'Filter value should flow through variants in order.' );
        self::assert_same(
            [
                'fotogrids/render/css_variables',
                'fotogrids/render/css_variables/gallery',
                'fotogrids/render/css_variables/gallery/13',
            ],
            Hook_Spy::$filters,
            'Filter hook order does not match gallery scoped ordering.'
        );
    }

    private static function test_action_order_for_album_scope(): void {
        Hook_Spy::reset();
        $render_context = self::make_render_context( Request_Source::ALBUM_AJAX, 91, 7 );

        Hooks::fire_action( 'after_render', $render_context );

        self::assert_same(
            [
                'fotogrids/render/after_render',
                'fotogrids/render/after_render/album',
                'fotogrids/render/after_render/album/7',
            ],
            Hook_Spy::$actions,
            'Action hook order does not match album scoped ordering.'
        );
    }

    private static function make_render_context( Request_Source $source, int $gallery_id, ?int $album_id ): Render_Context {
        return new Render_Context(
            meta: new Render_Meta(
                gallery_id: $gallery_id,
                album_id: $album_id,
                instance_id: 'fg-test-instance',
                source: $source,
                is_preview: false,
                mode: Render_Mode::INITIAL,
                schema_version: 2
            ),
            layout: new Render_Layout(
                layout_id: 'grid',
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
            settings: [],
            items: [],
            warnings: []
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
    HookFiringOrderTest::run();
    fwrite( STDOUT, "HookFiringOrderTest passed\n" );
}
