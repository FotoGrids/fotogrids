<?php
declare(strict_types=1);

namespace {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }
    if ( ! defined( 'ABSPATH' ) ) {
        define( 'ABSPATH', '/tmp/wp/' );
    }
    if ( ! defined( 'FOTOGRIDS_PLUGIN_DIR' ) ) {
        define( 'FOTOGRIDS_PLUGIN_DIR', dirname( __DIR__, 1 ) . '/src/' );
    }
    if ( ! defined( 'FOTOGRIDS_VERSION' ) ) {
        define( 'FOTOGRIDS_VERSION', '1.0.0' );
    }

    if ( ! function_exists( 'apply_filters' ) ) {
        function apply_filters( string $hook_name, mixed $value, mixed ...$args ): mixed {
            unset( $hook_name, $args );
            return $value;
        }
    }
    if ( ! function_exists( 'is_user_logged_in' ) ) {
        function is_user_logged_in(): bool {
            return false;
        }
    }
    if ( ! function_exists( 'is_preview' ) ) {
        function is_preview(): bool {
            return false;
        }
    }
    if ( ! function_exists( 'wp_doing_ajax' ) ) {
        function wp_doing_ajax(): bool {
            return false;
        }
    }
    if ( ! function_exists( 'add_action' ) ) {
        function add_action(): bool {
            return true;
        }
    }
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\FotoGrids_Cache;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Sorters\Random\Random_Sorter;

require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-gallery.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-item.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/cache/class-object-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/class-fotogrids-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-collection-kind.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-columns-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-mode.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-request-source.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-module-assets.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-asset-decl.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-meta.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-layout.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-behavior.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-render-context.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/interface-sorter.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/sorters/random/class-random-sorter.php';

/**
 * Coverage for the random_mode setting.
 *
 * `refetch` (default) and `reorder` both keep the page cacheable and are
 * resolved client-side, so both ship random-sort.js. `uncached` promises a new
 * order per request, which only holds if nothing stores the render - so it has
 * to take the FotoGrids cache out of the picture and ship no client module.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class RandomSortModeTest {

    public static function run(): void {
        self::test_mode_defaults_to_refetch();
        self::test_client_and_server_randomized_require_both_settings();
        self::test_render_cache_is_bypassed_in_server_mode_only();
        self::test_client_module_ships_for_refetch_and_reorder();
        self::test_hold_stylesheet_ships_for_refetch_only();
        self::test_nothing_ships_for_albums();
    }

    private static function test_mode_defaults_to_refetch(): void {
        self::assert_same( Random_Sorter::MODE_REFETCH, Random_Sorter::mode( array() ), 'An unset random_mode should resolve to refetch.' );
        self::assert_same( Random_Sorter::MODE_REFETCH, Random_Sorter::mode( array( 'random_mode' => '' ) ), 'An empty random_mode should resolve to refetch.' );
        self::assert_same( Random_Sorter::MODE_REFETCH, Random_Sorter::mode( array( 'random_mode' => 'nonsense' ) ), 'An unrecognised random_mode should resolve to refetch.' );
        self::assert_same( Random_Sorter::MODE_REORDER, Random_Sorter::mode( array( 'random_mode' => 'reorder' ) ), 'random_mode = reorder should resolve to reorder.' );
        self::assert_same( Random_Sorter::MODE_UNCACHED, Random_Sorter::mode( array( 'random_mode' => 'uncached' ) ), 'random_mode = uncached should resolve to uncached.' );
    }

    private static function test_client_and_server_randomized_require_both_settings(): void {
        self::assert_true(
            Random_Sorter::is_server_randomized( self::settings( 'random', 'uncached' ) ),
            'Random sort in uncached mode is server-randomized.'
        );
        foreach ( array( Random_Sorter::MODE_REFETCH, Random_Sorter::MODE_REORDER ) as $client_mode ) {
            self::assert_true(
                ! Random_Sorter::is_server_randomized( self::settings( 'random', $client_mode ) ),
                sprintf( 'Random sort in %s mode is not server-randomized.', $client_mode )
            );
            self::assert_true(
                Random_Sorter::is_client_randomized( self::settings( 'random', $client_mode ) ),
                sprintf( 'Random sort in %s mode is client-randomized.', $client_mode )
            );
        }
        self::assert_true(
            ! Random_Sorter::is_client_randomized( self::settings( 'random', 'uncached' ) ),
            'Uncached mode is not client-randomized.'
        );
        self::assert_true(
            ! Random_Sorter::is_server_randomized( self::settings( 'date', 'uncached' ) ),
            'A non-random sort order is never server-randomized, whatever random_mode says.'
        );
        self::assert_true(
            ! Random_Sorter::is_client_randomized( self::settings( 'date', 'refetch' ) ),
            'A non-random sort order is never client-randomized either.'
        );
    }

    private static function test_render_cache_is_bypassed_in_server_mode_only(): void {
        foreach ( array( Random_Sorter::MODE_REFETCH, Random_Sorter::MODE_REORDER ) as $client_mode ) {
            $settings                 = self::settings( 'random', $client_mode );
            $settings['enable_cache'] = true;
            self::assert_true(
                FotoGrids_Cache::should_cache( $settings, 7 ),
                sprintf( 'Random sort in %s mode should still use the render cache.', $client_mode )
            );
        }

        $server                 = self::settings( 'random', 'uncached' );
        $server['enable_cache'] = true;
        self::assert_true(
            ! FotoGrids_Cache::should_cache( $server, 7 ),
            'Uncached-mode random sort must bypass the render cache, or the order freezes for the TTL.'
        );
    }

    private static function test_client_module_ships_for_refetch_and_reorder(): void {
        $sorter = new Random_Sorter();

        foreach ( array( Random_Sorter::MODE_REFETCH, Random_Sorter::MODE_REORDER ) as $client_mode ) {
            $assets = $sorter->assets( self::context( self::settings( 'random', $client_mode ) ) );
            self::assert_true(
                isset( $assets->js['fotogrids-random-sort'] ),
                sprintf( '%s mode should declare the client module.', $client_mode )
            );
            self::assert_same(
                '../../assets/js/random-sort.js',
                $assets->js['fotogrids-random-sort']->path,
                'The declared path should point at the built module.'
            );
            self::assert_same(
                array( 'fotogrids-runtime' ),
                $assets->js['fotogrids-random-sort']->deps,
                'The client module attaches to the frontend runtime.'
            );
        }

        $server_assets = $sorter->assets( self::context( self::settings( 'random', 'uncached' ) ) );
        self::assert_same( array(), $server_assets->js, 'Uncached mode should ship no client module.' );
        self::assert_same( array(), $server_assets->css, 'Uncached mode should ship no stylesheet.' );
    }

    private static function test_hold_stylesheet_ships_for_refetch_only(): void {
        $sorter = new Random_Sorter();

        $refetch = $sorter->assets( self::context( self::settings( 'random', 'refetch' ) ) );
        self::assert_true(
            isset( $refetch->css['fotogrids-random-sort'] ),
            'Refetch mode holds the items hidden, so it needs the stylesheet.'
        );
        self::assert_same(
            'sorters/random/random-sort.css',
            $refetch->css['fotogrids-random-sort']->path,
            'The stylesheet ships verbatim from the render tree.'
        );

        $reorder = $sorter->assets( self::context( self::settings( 'random', 'reorder' ) ) );
        self::assert_same( array(), $reorder->css, 'Reorder mode never hides anything, so it needs no stylesheet.' );
    }

    private static function test_nothing_ships_for_albums(): void {
        $sorter = new Random_Sorter();
        $album  = $sorter->assets( self::context( self::settings( 'random', 'refetch' ), 42, Collection_Kind::ALBUM ) );

        self::assert_same( array(), $album->js, 'Albums do not run the gallery random sorter.' );
        self::assert_same( array(), $album->css, 'Albums ship no random-sort stylesheet either.' );
    }

    /**
     * @return array<string, mixed>
     */
    private static function settings( string $sort_order, string $random_mode ): array {
        return array(
            'default_sort_order' => $sort_order,
            'random_mode'        => $random_mode,
        );
    }

    /**
     * @param array<string, mixed> $settings
     */
    private static function context( array $settings, ?int $seed = 42, string $collection_kind = Collection_Kind::GALLERY ): Render_Context {
        return new Render_Context(
            meta: new Render_Meta(
                gallery_id: 7,
                album_id: null,
                instance_id: 'fg-instance-7',
                source: Request_Source::SHORTCODE,
                is_preview: false,
                mode: Render_Mode::INITIAL,
                schema_version: 2,
                collection_kind: $collection_kind,
                random_seed: $seed
            ),
            layout: new Render_Layout(
                layout_id: 'grid',
                columns_mode: Columns_Mode::FIXED,
                responsive_columns: array( 'desktop' => 3 ),
                responsive_spacing: array( 'desktop' => 10 ),
                columns_auto_range: array()
            ),
            behavior: new Render_Behavior(
                click_behavior: 'lightbox',
                pagination_type: 'show_all',
                pagination_method: 'load_more',
                hover_effect: null
            ),
            settings: $settings,
            items: array(),
            warnings: array()
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
    RandomSortModeTest::run();
    fwrite( STDOUT, "RandomSortModeTest passed\n" );
}
}
