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
            unset( $handle, $src, $deps, $version );
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
            unset( $src, $version, $args );
            $GLOBALS['fg_registered_scripts'][ $handle ] = $deps;
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
 * Regression coverage for script dependencies carried through the render cache.
 *
 * A password-gated gallery's lock screen enqueues password-gate.js with a
 * dependency on fotogrids-runtime. A cache hit has to re-register the script
 * with that dependency, or the runtime never reaches the page and modules
 * injected after the unlock run without it.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class RenderCacheScriptDepsTest {

    private const GATE    = 'fotogrids-password-gate';
    private const RUNTIME = 'fotogrids-runtime';

    public static function run(): void {
        self::test_resolver_reports_script_dependencies();
        self::test_cache_round_trip_keeps_script_dependencies();
        self::test_cache_hit_registers_scripts_with_their_dependencies();
        self::test_schema_3_envelope_is_treated_as_a_miss();
    }

    private static function test_resolver_reports_script_dependencies(): void {
        self::reset();

        $js = self::render_lock_screen_assets();

        self::assert_same( array( self::RUNTIME ), $js[ self::GATE ]['deps'] ?? null, 'The resolver should report the gate script dependencies.' );
    }

    private static function test_cache_round_trip_keeps_script_dependencies(): void {
        self::reset();

        $js = self::render_lock_screen_assets();
        FotoGrids_Cache::put( 9, 'key-lock', '<div class="fotogrids-gate"></div>', array(), $js, '', '', '', 24 );

        $GLOBALS['fg_object_cache'] = array();
        $cached                     = FotoGrids_Cache::get( 9, 'key-lock' );

        self::assert_true( is_array( $cached ), 'A stored lock screen should come back as a hit.' );
        self::assert_same( array( self::RUNTIME ), $cached['js'][ self::GATE ]['deps'] ?? null, 'A cache hit should carry the stored script dependencies.' );
    }

    private static function test_cache_hit_registers_scripts_with_their_dependencies(): void {
        self::reset();

        $js = self::render_lock_screen_assets();
        FotoGrids_Cache::put( 9, 'key-lock', '<div class="fotogrids-gate"></div>', array(), $js, '', '', '', 24 );
        $from_miss = $GLOBALS['fg_registered_scripts'];

        // A later request: fresh resolver, nothing registered, the entry is a hit.
        Asset_Resolver::reset_for_tests();
        $GLOBALS['fg_registered_scripts'] = array();
        $cached                           = FotoGrids_Cache::get( 9, 'key-lock' );

        $replay = new \ReflectionMethod( Public_Render::class, 'replay_cached_assets' );
        $replay->setAccessible( true );
        $replay->invoke( null, $cached['css'], $cached['js'] );

        self::assert_same( $from_miss, $GLOBALS['fg_registered_scripts'], 'A cache hit must register scripts with the same dependencies as the miss.' );
    }

    private static function test_schema_3_envelope_is_treated_as_a_miss(): void {
        self::reset();

        $GLOBALS['wpdb']->rows['key-v3'] = (string) json_encode(
            array(
                'schema'     => 3,
                'html'       => '<div class="fotogrids-gate"></div>',
                'css'        => array(),
                'js'         => array(
                    self::GATE => array(
                        'src'       => 'https://example.com/password-gate.js',
                        'in_footer' => true,
                    ),
                ),
                'inline_css' => '',
                'inline_js'  => '',
                'json_ld'    => '',
                'expires_at' => time() + HOUR_IN_SECONDS,
            )
        );

        self::assert_same( false, FotoGrids_Cache::get( 9, 'key-v3' ), 'An envelope written without script dependencies must read as a miss.' );
    }

    /**
     * Collects and flushes the password gate's scripts as a lock-screen render does.
     *
     * @return array<string, array{src: string, in_footer: bool, deps: array<int, string>}>
     */
    private static function render_lock_screen_assets(): array {
        $resolver = Asset_Resolver::instance();
        $resolver->collect(
            new Module_Assets(
                array(),
                array(
                    self::GATE => new Asset_Decl( '../../assets/js/password-gate.js', array( self::RUNTIME ), true ),
                )
            ),
            'fotogrids'
        );
        $resolver->flush();

        return $resolver->get_js_asset_data();
    }

    private static function reset(): void {
        Asset_Resolver::reset_for_tests();
        Asset_Resolver::register_plugin( 'fotogrids', 'https://example.com/wp-content/plugins/fotogrids', '1.0.0' );
        $GLOBALS['wpdb']                  = new \Fake_Wpdb();
        $GLOBALS['fg_object_cache']       = array();
        $GLOBALS['fg_registered_scripts'] = array();
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
    RenderCacheScriptDepsTest::run();
    fwrite( STDOUT, "RenderCacheScriptDepsTest passed\n" );
}
}
