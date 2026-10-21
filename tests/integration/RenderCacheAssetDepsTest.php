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
    if ( ! defined( 'HOUR_IN_SECONDS' ) ) {
        define( 'HOUR_IN_SECONDS', 3600 );
    }
    if ( ! defined( 'MONTH_IN_SECONDS' ) ) {
        define( 'MONTH_IN_SECONDS', 2592000 );
    }

    /**
     * In-memory stand-in for the fotogrids_render_cache table.
     */
    final class Fake_Wpdb {
        public string $prefix = 'wp_';

        /** @var array<string, string> cache_key => stored envelope. */
        public array $rows = array();

        /**
         * @param  mixed ...$args
         * @return array{sql: string, args: array<int, mixed>}
         */
        public function prepare( string $sql, ...$args ): array {
            return array(
                'sql'  => $sql,
                'args' => $args,
            );
        }

        /**
         * @param  array{sql: string, args: array<int, mixed>} $statement
         * @return object|null
         */
        public function get_row( array $statement ) {
            $cache_key = (string) $statement['args'][1];
            if ( ! isset( $this->rows[ $cache_key ] ) ) {
                return null;
            }
            return (object) array( 'html' => $this->rows[ $cache_key ] );
        }

        /**
         * @param  array{sql: string, args: array<int, mixed>} $statement
         * @return int
         */
        public function query( array $statement ): int {
            $this->rows[ (string) $statement['args'][2] ] = (string) $statement['args'][3];
            return 1;
        }
    }

    $GLOBALS['wpdb']                  = new Fake_Wpdb();
    $GLOBALS['fg_object_cache']       = array();
    $GLOBALS['fg_registered_scripts'] = array();
    $GLOBALS['fg_registered_styles']  = array();

    if ( ! function_exists( 'wp_rand' ) ) {
        function wp_rand(): int {
            return mt_rand();
        }
    }
    if ( ! function_exists( 'wp_cache_get' ) ) {
        function wp_cache_get( string $key, string $group = '' ): mixed {
            return $GLOBALS['fg_object_cache'][ $group . ':' . $key ] ?? false;
        }
    }
    if ( ! function_exists( 'wp_cache_set' ) ) {
        function wp_cache_set( string $key, mixed $value, string $group = '', int $ttl = 0 ): bool {
            unset( $ttl );
            $GLOBALS['fg_object_cache'][ $group . ':' . $key ] = $value;
            return true;
        }
    }
    if ( ! function_exists( 'wp_cache_delete' ) ) {
        function wp_cache_delete( string $key, string $group = '' ): bool {
            unset( $GLOBALS['fg_object_cache'][ $group . ':' . $key ] );
            return true;
        }
    }
    if ( ! function_exists( 'wp_json_encode' ) ) {
        function wp_json_encode( mixed $value, int $flags = 0, int $depth = 512 ): string|false {
            return json_encode( $value, $flags, $depth );
        }
    }
    if ( ! function_exists( 'current_time' ) ) {
        function current_time( string $type, int $gmt = 0 ): mixed {
            unset( $gmt );
            return 'timestamp' === $type ? time() : gmdate( 'Y-m-d H:i:s' );
        }
    }
    if ( ! function_exists( 'do_action' ) ) {
        function do_action( string $hook_name, mixed ...$args ): void {
            unset( $hook_name, $args );
        }
    }
    if ( ! function_exists( 'apply_filters' ) ) {
        function apply_filters( string $hook_name, mixed $value, mixed ...$args ): mixed {
            unset( $hook_name, $args );
            return $value;
        }
    }
    if ( ! function_exists( 'add_action' ) ) {
        function add_action(): bool {
            return true;
        }
    }
    if ( ! function_exists( 'did_action' ) ) {
        function did_action( string $hook_name ): int {
            unset( $hook_name );
            return 0;
        }
    }
    if ( ! function_exists( 'wp_register_style' ) ) {
        function wp_register_style( string $handle, mixed $src, array $deps = array(), mixed $version = false ): bool {
            $GLOBALS['fg_registered_styles'][ $handle ] = array(
                'src'     => $src,
                'deps'    => $deps,
                'version' => $version,
            );
            return true;
        }
    }
    if ( ! function_exists( 'wp_enqueue_style' ) ) {
        function wp_enqueue_style( string $handle ): void {
            unset( $handle );
        }
    }
    if ( ! function_exists( 'wp_register_script' ) ) {
        function wp_register_script( string $handle, mixed $src, array $deps = array(), mixed $version = false, mixed $args = array() ): bool {
            $GLOBALS['fg_registered_scripts'][ $handle ] = array(
                'src'     => $src,
                'deps'    => $deps,
                'version' => $version,
                'args'    => $args,
            );
            return true;
        }
    }
    if ( ! function_exists( 'wp_enqueue_script' ) ) {
        function wp_enqueue_script( string $handle ): void {
            unset( $handle );
        }
    }
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\FotoGrids_Cache;
use FotoGrids\Public_Render;
use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Internal\Asset_Resolver;

require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-gallery.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-item.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-render.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/cache/class-object-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/class-fotogrids-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-asset-decl.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-module-assets.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-asset-resolver.php';
require_once dirname( __DIR__, 2 ) . '/src/public/class-public-render.php';

/**
 * Regression coverage for asset dependencies and versions carried through the render cache.
 *
 * A layout script is collected before the runtime it depends on. A cache hit
 * has to register every script and style with the dependencies and version
 * the miss used, or WordPress prints them in collection order and the layout
 * runs before the runtime exists.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.3.0
 */
final class RenderCacheAssetDepsTest {

    private const MASONRY    = 'fotogrids-layout-masonry';
    private const RUNTIME    = 'fotogrids-runtime';
    private const HOVER_BASE = 'fotogrids-hover-base';
    private const HOVER      = 'fotogrids-hover-effects';
    private const ADDON      = 'fotogrids-addon-script';

    public static function run(): void {
        self::test_capture_records_registration_data();
        self::test_css_url_map_keeps_its_shape();
        self::test_cache_round_trip_keeps_registration_data();
        self::test_stored_styles_keep_the_url_map_earlier_releases_read();
        self::test_cache_hit_registers_assets_as_the_miss_did();
        self::test_head_style_replay_registers_styles_as_the_miss_did();
        self::test_schema_4_envelope_is_treated_as_a_miss();
    }

    private static function test_capture_records_registration_data(): void {
        self::reset();
        $captured = self::capture_masonry_assets();
        $js       = $captured['js'];
        $css      = $captured['css'];

        self::assert_same( array( self::RUNTIME ), $js[ self::MASONRY ]['deps'] ?? null, 'The capture should record script dependencies.' );
        self::assert_same( '1.0.0', $js[ self::MASONRY ]['version'] ?? null, 'The capture should record the script version.' );
        self::assert_same( '2.5.0', $js[ self::ADDON ]['version'] ?? null, 'A script from another origin should carry that origin\'s version.' );
        self::assert_same( array( self::HOVER_BASE ), $css[ self::HOVER ]['deps'] ?? null, 'The capture should record style dependencies.' );
        self::assert_same( '1.0.0', $css[ self::HOVER ]['version'] ?? null, 'The capture should record the style version.' );
        self::assert_same( Asset_Resolver::instance()->get_js_asset_data(), $js, 'REST script data should match what the capture recorded.' );
    }

    private static function test_css_url_map_keeps_its_shape(): void {
        self::reset();
        self::render_masonry_assets();

        self::assert_same(
            array(
                self::HOVER_BASE => 'https://example.com/wp-content/plugins/fotogrids/public/render/decorators/hover/base.css',
                self::HOVER      => 'https://example.com/wp-content/plugins/fotogrids/public/render/decorators/effects/effects.css',
            ),
            Asset_Resolver::instance()->get_css_asset_urls(),
            'get_css_asset_urls() should still return a handle to URL map.'
        );
    }

    private static function test_cache_round_trip_keeps_registration_data(): void {
        self::reset();
        $captured = self::capture_masonry_assets();
        FotoGrids_Cache::put( 9, 'key-masonry', '<div class="fotogrids-gallery"></div>', $captured['css'], $captured['js'], '', '', '', 24 );

        $GLOBALS['fg_object_cache'] = array();
        $cached                     = FotoGrids_Cache::get( 9, 'key-masonry' );

        self::assert_true( is_array( $cached ), 'A stored gallery should come back as a hit.' );
        self::assert_same( $captured['js'], $cached['js'], 'A cache hit should carry the stored script data.' );
        self::assert_same( $captured['css'], $cached['css'], 'A cache hit should carry the stored style data.' );
    }

    private static function test_stored_styles_keep_the_url_map_earlier_releases_read(): void {
        self::reset();
        $captured = self::capture_masonry_assets();
        FotoGrids_Cache::put( 9, 'key-masonry', '<div class="fotogrids-gallery"></div>', $captured['css'], $captured['js'], '', '', '', 24 );

        $stored = json_decode( $GLOBALS['wpdb']->rows['key-masonry'], true );

        self::assert_same(
            array(
                self::HOVER_BASE => 'https://example.com/wp-content/plugins/fotogrids/public/render/decorators/hover/base.css',
                self::HOVER      => 'https://example.com/wp-content/plugins/fotogrids/public/render/decorators/effects/effects.css',
            ),
            $stored['css'],
            'Stored styles should stay a handle to URL map.'
        );
        self::assert_same(
            array(
                'deps'    => array( self::HOVER_BASE ),
                'version' => '1.0.0',
            ),
            $stored['css_meta'][ self::HOVER ] ?? null,
            'Style dependencies and versions should be stored beside the URL map.'
        );
    }

    private static function test_cache_hit_registers_assets_as_the_miss_did(): void {
        self::reset();
        $captured = self::capture_masonry_assets();
        FotoGrids_Cache::put( 9, 'key-masonry', '<div class="fotogrids-gallery"></div>', $captured['css'], $captured['js'], '', '', '', 24 );
        $scripts_from_miss = $GLOBALS['fg_registered_scripts'];
        $styles_from_miss  = $GLOBALS['fg_registered_styles'];

        Asset_Resolver::reset_for_tests();
        $GLOBALS['fg_registered_scripts'] = array();
        $GLOBALS['fg_registered_styles']  = array();
        $GLOBALS['fg_object_cache']       = array();
        $cached                           = FotoGrids_Cache::get( 9, 'key-masonry' );

        $replay = new \ReflectionMethod( Public_Render::class, 'replay_cached_assets' );
        $replay->setAccessible( true );
        $replay->invoke( null, $cached['css'], $cached['js'] );

        self::assert_same( $scripts_from_miss, $GLOBALS['fg_registered_scripts'], 'A cache hit must register scripts exactly as the miss did.' );
        self::assert_same( $styles_from_miss, $GLOBALS['fg_registered_styles'], 'A cache hit must register styles exactly as the miss did.' );
    }

    private static function test_head_style_replay_registers_styles_as_the_miss_did(): void {
        self::reset();
        $resolver = Asset_Resolver::instance();
        $resolver->collect(
            new Module_Assets(
                array(
                    self::HOVER_BASE => new Asset_Decl( 'decorators/hover/base.css' ),
                    self::HOVER      => new Asset_Decl( 'decorators/effects/effects.css', array( self::HOVER_BASE ) ),
                )
            ),
            'fotogrids'
        );
        $styles = $resolver->queued_css();
        $resolver->flush();
        FotoGrids_Cache::put( 9, 'key-head', '', $styles, array(), '', '', '', 24 );
        $styles_from_miss = $GLOBALS['fg_registered_styles'];

        Asset_Resolver::reset_for_tests();
        $GLOBALS['fg_registered_styles'] = array();
        $GLOBALS['fg_object_cache']      = array();
        $cached                          = FotoGrids_Cache::get( 9, 'key-head' );
        Asset_Resolver::instance()->replay_styles( $cached['css'] );

        self::assert_same( $styles_from_miss, $GLOBALS['fg_registered_styles'], 'A head-styles hit must register styles exactly as the miss did.' );
    }

    private static function test_schema_4_envelope_is_treated_as_a_miss(): void {
        self::reset();

        $GLOBALS['wpdb']->rows['key-v4'] = (string) json_encode(
            array(
                'schema'     => 4,
                'html'       => '<div class="fotogrids-gallery"></div>',
                'css'        => array( self::HOVER => 'https://example.com/effects.css' ),
                'js'         => array(
                    self::MASONRY => array(
                        'src'       => 'https://example.com/layout-masonry.js',
                        'in_footer' => true,
                    ),
                ),
                'inline_css' => '',
                'inline_js'  => '',
                'json_ld'    => '',
                'expires_at' => time() + HOUR_IN_SECONDS,
                'fonts'      => array(),
            )
        );

        self::assert_same( false, FotoGrids_Cache::get( 9, 'key-v4' ), 'An envelope written without asset dependencies must read as a miss.' );
    }

    /**
     * Collects and flushes a masonry gallery's assets in pipeline order: the layout before the runtime.
     *
     * @return void
     */
    private static function render_masonry_assets(): void {
        $resolver = Asset_Resolver::instance();
        $resolver->collect(
            new Module_Assets(
                array(),
                array(
                    self::MASONRY => new Asset_Decl( '../../assets/js/layout-masonry.js', array( self::RUNTIME ), true ),
                )
            ),
            'fotogrids'
        );
        $resolver->collect(
            new Module_Assets(
                array(
                    self::HOVER_BASE => new Asset_Decl( 'decorators/hover/base.css' ),
                    self::HOVER      => new Asset_Decl( 'decorators/effects/effects.css', array( self::HOVER_BASE ) ),
                ),
                array()
            ),
            'fotogrids'
        );
        $resolver->collect(
            new Module_Assets(
                array(),
                array(
                    self::ADDON => new Asset_Decl( 'addon/addon.js', array( self::RUNTIME ), true ),
                )
            ),
            'fotogrids-addon'
        );
        $resolver->collect(
            new Module_Assets(
                array(),
                array(
                    self::RUNTIME => new Asset_Decl( 'internal/runtime/runtime.js', array(), true ),
                )
            ),
            'fotogrids'
        );
        $resolver->flush();
    }

    /**
     * Captures a masonry gallery's assets as a full render does for the cache.
     *
     * @return array{css: array<string, array<string, mixed>>, js: array<string, array<string, mixed>>}
     */
    private static function capture_masonry_assets(): array {
        $resolver = Asset_Resolver::instance();
        $resolver->begin_capture();
        self::render_masonry_assets();

        return $resolver->end_capture();
    }

    private static function reset(): void {
        Asset_Resolver::reset_for_tests();
        Asset_Resolver::register_plugin( 'fotogrids', 'https://example.com/wp-content/plugins/fotogrids', '1.0.0' );
        Asset_Resolver::register_plugin( 'fotogrids-addon', 'https://example.com/wp-content/plugins/fotogrids-addon', '2.5.0' );
        $GLOBALS['wpdb']                  = new \Fake_Wpdb();
        $GLOBALS['fg_object_cache']       = array();
        $GLOBALS['fg_registered_scripts'] = array();
        $GLOBALS['fg_registered_styles']  = array();
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
    RenderCacheAssetDepsTest::run();
    fwrite( STDOUT, "RenderCacheAssetDepsTest passed\n" );
}
}
