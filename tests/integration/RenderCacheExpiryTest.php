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
     * In-memory stand-in for the fotogrids_render_cache table that enforces
     * expires_at on read, as the real SELECT does.
     */
    final class Fake_Expiring_Wpdb {
        public string $prefix = 'wp_';

        /** @var array<string, array{html: string, expires_at: string}> */
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
         * SELECT html FROM %i WHERE cache_key = %s AND expires_at > %s: table, key, now.
         *
         * @param  array{sql: string, args: array<int, mixed>} $statement
         * @return object|null
         */
        public function get_row( array $statement ) {
            ++$this->select_count;
            $cache_key = (string) $statement['args'][1];
            $now       = (string) $statement['args'][2];
            $row       = $this->rows[ $cache_key ] ?? null;
            if ( null === $row || $row['expires_at'] <= $now ) {
                return null;
            }
            return (object) array( 'html' => $row['html'] );
        }

        /**
         * INSERT INTO %i … VALUES ('gallery', %d, %s, %s, %s, %s): table, id, key, payload, cached_at, expires_at.
         *
         * @param  array{sql: string, args: array<int, mixed>} $statement
         * @return int
         */
        public function query( array $statement ): int {
            $this->rows[ (string) $statement['args'][2] ] = array(
                'html'       => (string) $statement['args'][3],
                'expires_at' => (string) $statement['args'][5],
            );
            return 1;
        }
    }

    $GLOBALS['wpdb']            = new Fake_Expiring_Wpdb();
    $GLOBALS['fg_object_cache'] = array();
    $GLOBALS['fg_now']          = 1_800_000_000;

    // A persistent object cache: entries survive across requests and the
    // per-entry TTL argument is not relied on.
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
            $now = (int) $GLOBALS['fg_now'];
            return 'timestamp' === $type ? $now : gmdate( 'Y-m-d H:i:s', $now );
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
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\FotoGrids_Cache;

require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-gallery.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/actions/class-actions-item.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/cache/class-object-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/class-fotogrids-cache.php';

/**
 * Regression coverage for render-cache expiry under a persistent object cache.
 *
 * The object cache (L1) is read before the table (L2), so an entry's
 * cache_duration only holds if the expiry travels with the entry itself.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.1.3
 */
final class RenderCacheExpiryTest {

    private const START = 1_800_000_000;

    public static function run(): void {
        self::test_fresh_entry_is_served_from_l1();
        self::test_entry_is_served_until_its_last_second();
        self::test_expired_l1_entry_is_a_miss_and_is_evicted();
        self::test_entry_promoted_from_l2_keeps_its_expiry();
        self::test_envelope_without_expiry_is_a_miss();
    }

    private static function test_fresh_entry_is_served_from_l1(): void {
        self::reset();

        FotoGrids_Cache::put( 5, 'key-fresh', '<div>fresh</div>', array(), array(), '', '', '', 1 );

        $cached = FotoGrids_Cache::get( 5, 'key-fresh' );

        self::assert_true( is_array( $cached ), 'A fresh entry should hit.' );
        self::assert_same( '<div>fresh</div>', $cached['html'], 'The hit should carry the stored HTML.' );
        self::assert_same( 0, $GLOBALS['wpdb']->select_count, 'A fresh entry should be served from L1 without a query.' );
    }

    private static function test_entry_is_served_until_its_last_second(): void {
        self::reset();

        FotoGrids_Cache::put( 5, 'key-edge', '<div></div>', array(), array(), '', '', '', 1 );

        self::advance( HOUR_IN_SECONDS - 1 );
        self::assert_true( is_array( FotoGrids_Cache::get( 5, 'key-edge' ) ), 'An entry one second from expiry should still hit.' );

        self::advance( 1 );
        self::assert_same( false, FotoGrids_Cache::get( 5, 'key-edge' ), 'An entry should miss at its expiry.' );
    }

    private static function test_expired_l1_entry_is_a_miss_and_is_evicted(): void {
        self::reset();

        FotoGrids_Cache::put( 5, 'key-stale', '<div>stale</div>', array(), array(), '', '', '', 1 );
        self::assert_same( 2, count( $GLOBALS['fg_object_cache'] ), 'The entry should be in L1 alongside the version salt.' );

        self::advance( HOUR_IN_SECONDS + 60 );

        self::assert_same( false, FotoGrids_Cache::get( 5, 'key-stale' ), 'An expired entry must not be replayed from L1.' );
        self::assert_same( 1, count( $GLOBALS['fg_object_cache'] ), 'The expired L1 entry should be evicted, leaving only the version salt.' );

        FotoGrids_Cache::put( 5, 'key-stale', '<div>new</div>', array(), array(), '', '', '', 1 );
        $cached = FotoGrids_Cache::get( 5, 'key-stale' );
        self::assert_true( is_array( $cached ), 'The re-rendered entry should hit.' );
        self::assert_same( '<div>new</div>', $cached['html'], 'The re-rendered entry should replace the expired one.' );
    }

    private static function test_entry_promoted_from_l2_keeps_its_expiry(): void {
        self::reset();

        FotoGrids_Cache::put( 5, 'key-l2', '<div></div>', array(), array(), '', '', '', 2 );

        // A later request on a cold object cache promotes the row from L2.
        $GLOBALS['fg_object_cache'] = array();
        self::advance( HOUR_IN_SECONDS );
        self::assert_true( is_array( FotoGrids_Cache::get( 5, 'key-l2' ) ), 'A live L2 row should hit.' );
        self::assert_same( 1, $GLOBALS['wpdb']->select_count, 'The first read should come from L2.' );

        self::advance( HOUR_IN_SECONDS );
        self::assert_same( false, FotoGrids_Cache::get( 5, 'key-l2' ), 'The promoted L1 copy must expire with the row it came from.' );
    }

    private static function test_envelope_without_expiry_is_a_miss(): void {
        self::reset();

        // A schema-2 envelope: complete payloads, no expiry.
        $legacy = (string) json_encode(
            array(
                'schema'     => 2,
                'html'       => '<div class="stale"></div>',
                'css'        => array(),
                'js'         => array(),
                'inline_css' => '',
                'inline_js'  => '',
                'json_ld'    => '',
            )
        );
        $GLOBALS['fg_object_cache']['fotogrids_render:fotogrids_render_version'] = 1;
        $GLOBALS['fg_object_cache']['fotogrids_render:v1_key-legacy']           = $legacy;

        self::assert_same( false, FotoGrids_Cache::get( 5, 'key-legacy' ), 'An envelope without an expiry must read as a miss.' );
    }

    private static function reset(): void {
        $GLOBALS['wpdb']            = new \Fake_Expiring_Wpdb();
        $GLOBALS['fg_object_cache'] = array();
        $GLOBALS['fg_now']          = self::START;
    }

    private static function advance( int $seconds ): void {
        $GLOBALS['fg_now'] += $seconds;
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
    RenderCacheExpiryTest::run();
    fwrite( STDOUT, "RenderCacheExpiryTest passed\n" );
}
}
