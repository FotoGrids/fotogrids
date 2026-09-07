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
     *
     * prepare() returns a structured payload rather than a SQL string so the
     * fake can branch on statement type without parsing SQL.
     */
    final class Fake_Wpdb {
        public string $prefix = 'wp_';

        /** @var array<string, string> cache_key => stored envelope. */
        public array $rows = array();

        /** @var int Number of SELECTs served. */
        public int $select_count = 0;

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
            ++$this->select_count;
            $cache_key = (string) $statement['args'][0];
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
            // INSERT … VALUES ('gallery', %d, %s, %s, %s, %s): key, payload.
            $this->rows[ (string) $statement['args'][1] ] = (string) $statement['args'][2];
            return 1;
        }
    }

    $GLOBALS['wpdb']                 = new Fake_Wpdb();
    $GLOBALS['fg_object_cache']      = array();
    $GLOBALS['fg_inline_styles']     = array();
    $GLOBALS['fg_registered_styles'] = array();

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
    if ( ! function_exists( 'wp_doing_ajax' ) ) {
        function wp_doing_ajax(): bool {
            return false;
        }
    }
    if ( ! function_exists( 'wp_register_style' ) ) {
        function wp_register_style( string $handle, mixed $src, array $deps = array(), mixed $version = false ): bool {
            unset( $src, $deps, $version );
            $GLOBALS['fg_registered_styles'][ $handle ] = true;
            return true;
        }
    }
    if ( ! function_exists( 'wp_enqueue_style' ) ) {
        function wp_enqueue_style( string $handle ): void {
            unset( $handle );
        }
    }
    if ( ! function_exists( 'wp_add_inline_style' ) ) {
        function wp_add_inline_style( string $handle, string $data ): bool {
            $GLOBALS['fg_inline_styles'][ $handle ] = $data;
            return true;
        }
    }
    if ( ! function_exists( 'wp_print_styles' ) ) {
        function wp_print_styles( mixed $handles = false ): array {
            unset( $handles );
            return array();
        }
    }
    if ( ! function_exists( 'wp_script_is' ) ) {
        function wp_script_is( string $handle, string $status = 'enqueued' ): bool {
            unset( $handle, $status );
            return false;
        }
    }
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\FotoGrids_Cache;
use FotoGrids\Render\Internal\Inline_Asset_Emitter;
use FotoGrids\Render\Internal\Render_Result;

require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-gallery.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-item.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-render.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/cache/class-object-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/class-fotogrids-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-render-result.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-inline-asset-emitter.php';

/**
 * Regression coverage for the per-render inline assets carried through the
 * render cache.
 *
 * A cache hit skips the render pipeline entirely, so the inline CSS holding
 * --fg-cols and the other per-gallery custom properties has to come back out
 * of the cache envelope. Before schema 2 it was generated once and never
 * stored, which collapsed every grid for logged-out visitors.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.0.0
 */
final class RenderCacheInlineAssetsTest {

    private const INLINE_CSS = '#fg-instance-77 { --fg-cols: 4; --fg-gap: 10px; }';
    private const INLINE_JS  = 'window.__fgTest = 1;';
    private const JSON_LD    = '{"@context":"https://schema.org"}';

    public static function run(): void {
        self::test_hit_returns_the_inline_payloads_the_miss_stored();
        self::test_hit_emits_the_same_inline_css_as_the_miss();
        self::test_legacy_envelope_is_treated_as_a_miss();
        self::test_legacy_l1_entry_is_dropped_and_missed();
        self::test_emitter_is_inert_during_a_rest_render();
    }

    private static function test_hit_returns_the_inline_payloads_the_miss_stored(): void {
        self::reset();

        FotoGrids_Cache::put( 77, 'key-a', '<div></div>', array( 'h' => 'a.css' ), array(), self::INLINE_CSS, self::INLINE_JS, self::JSON_LD, 24 );

        $cached = FotoGrids_Cache::get( 77, 'key-a' );

        self::assert_true( is_array( $cached ), 'A stored entry should come back as a hit.' );
        self::assert_same( self::INLINE_CSS, $cached['inline_css'], 'Cache hit should carry the stored inline CSS.' );
        self::assert_same( self::INLINE_JS, $cached['inline_js'], 'Cache hit should carry the stored inline JS.' );
        self::assert_same( self::JSON_LD, $cached['json_ld'], 'Cache hit should carry the stored JSON-LD.' );
        self::assert_same( array( 'h' => 'a.css' ), $cached['css'], 'Cache hit should still carry the CSS asset map.' );
    }

    private static function test_hit_emits_the_same_inline_css_as_the_miss(): void {
        self::reset();

        // The miss: the pipeline produced this result and it was cached.
        $rendered = new Render_Result( '<div></div>', 'fg-instance-77', array(), 200, self::INLINE_CSS, '', '' );
        Inline_Asset_Emitter::enqueue( $rendered );
        $from_miss = self::last_inline_style();

        FotoGrids_Cache::put( 77, 'key-b', '<div></div>', array(), array(), $rendered->inline_css, $rendered->inline_js, $rendered->json_ld, 24 );

        // The hit: no pipeline, the payloads come back out of the envelope.
        $GLOBALS['fg_inline_styles'] = array();
        $cached                      = FotoGrids_Cache::get( 77, 'key-b' );
        Inline_Asset_Emitter::enqueue(
            new Render_Result( '', '', array(), 200, $cached['inline_css'], $cached['inline_js'], $cached['json_ld'] )
        );
        $from_hit = self::last_inline_style();

        self::assert_contains( '--fg-cols', $from_miss, 'The cache miss should emit the grid column variable.' );
        self::assert_same( $from_miss, $from_hit, 'A cache hit must emit the same inline CSS as the miss that populated it.' );
    }

    private static function test_legacy_envelope_is_treated_as_a_miss(): void {
        self::reset();

        // Schema-1 envelope: HTML plus asset maps, no inline payloads.
        $GLOBALS['wpdb']->rows['key-legacy'] = (string) json_encode(
            array(
                'html' => '<div class="stale"></div>',
                'css'  => array( 'h' => 'a.css' ),
                'js'   => array(),
            )
        );

        self::assert_same( false, FotoGrids_Cache::get( 77, 'key-legacy' ), 'A schema-1 envelope must read as a miss.' );

        // Raw HTML rows predate the JSON envelope entirely.
        $GLOBALS['wpdb']->rows['key-raw'] = '<div class="stale"></div>';
        self::assert_same( false, FotoGrids_Cache::get( 77, 'key-raw' ), 'A raw-HTML row must read as a miss.' );

        // A re-render at the current schema replaces it and hits from then on.
        FotoGrids_Cache::put( 77, 'key-legacy', '<div></div>', array(), array(), self::INLINE_CSS, '', '', 24 );
        $cached = FotoGrids_Cache::get( 77, 'key-legacy' );
        self::assert_true( is_array( $cached ), 'The rewritten entry should hit.' );
        self::assert_same( self::INLINE_CSS, $cached['inline_css'], 'The rewritten entry should carry inline CSS.' );
    }

    private static function test_legacy_l1_entry_is_dropped_and_missed(): void {
        self::reset();

        // A legacy payload sitting in L1 must not shadow the miss, and must not
        // be handed back on the next read either.
        $legacy = (string) json_encode( array( 'html' => '<div class="stale"></div>' ) );
        $GLOBALS['wpdb']->rows['key-l1'] = $legacy;
        FotoGrids_Cache::get( 77, 'key-l1' );

        $before = $GLOBALS['wpdb']->select_count;
        self::assert_same( false, FotoGrids_Cache::get( 77, 'key-l1' ), 'A legacy L1 entry must read as a miss.' );
        self::assert_true(
            $GLOBALS['wpdb']->select_count > $before,
            'The legacy L1 entry should have been dropped, so the second read falls through to L2.'
        );
    }

    private static function test_emitter_is_inert_during_a_rest_render(): void {
        self::reset();

        // Inline_Asset_Emitter self-gates on REST: a server-side enqueue would
        // never reach the already-loaded page, so the REST handler returns the
        // payloads as discrete fields instead.
        define( 'REST_REQUEST', true );

        Inline_Asset_Emitter::enqueue( new Render_Result( '', '', array(), 200, self::INLINE_CSS, '', '' ) );

        self::assert_same(
            array(),
            $GLOBALS['fg_inline_styles'],
            'The emitter must not enqueue anything during a REST render.'
        );
    }

    private static function reset(): void {
        $GLOBALS['wpdb']                 = new \Fake_Wpdb();
        $GLOBALS['fg_object_cache']      = array();
        $GLOBALS['fg_inline_styles']     = array();
        $GLOBALS['fg_registered_styles'] = array();
    }

    private static function last_inline_style(): string {
        $styles = $GLOBALS['fg_inline_styles'];
        return empty( $styles ) ? '' : (string) end( $styles );
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
    RenderCacheInlineAssetsTest::run();
    fwrite( STDOUT, "RenderCacheInlineAssetsTest passed\n" );
}
}
