<?php
declare(strict_types=1);

namespace {
    if ( ! defined( 'WPINC' ) ) {
        define( 'WPINC', 'wp-includes' );
    }
    if ( ! defined( 'DAY_IN_SECONDS' ) ) {
        define( 'DAY_IN_SECONDS', 86400 );
    }

    /**
     * In-memory persistent object cache. In 'redis' mode every stored integer
     * or float comes back as a numeric string, as the Redis Object Cache
     * drop-in returns them; in 'typed' mode values keep their type.
     */
    final class Fake_Object_Cache {
        public static string $mode = 'typed';

        /** @var array<string, mixed> */
        public static array $store = array();

        /** @var array<string, int> TTL of the last write per key. */
        public static array $ttls = array();

        public static function reset( string $mode ): void {
            self::$mode  = $mode;
            self::$store = array();
            self::$ttls  = array();
        }
    }

    if ( ! function_exists( 'wp_cache_get' ) ) {
        function wp_cache_get( string $key, string $group = '' ): mixed {
            $value = Fake_Object_Cache::$store[ $group . ':' . $key ] ?? false;
            if ( 'redis' === Fake_Object_Cache::$mode && ( is_int( $value ) || is_float( $value ) ) ) {
                return (string) $value;
            }
            return $value;
        }
    }
    if ( ! function_exists( 'wp_cache_set' ) ) {
        function wp_cache_set( string $key, mixed $value, string $group = '', int $ttl = 0 ): bool {
            Fake_Object_Cache::$store[ $group . ':' . $key ] = $value;
            Fake_Object_Cache::$ttls[ $group . ':' . $key ]  = $ttl;
            return true;
        }
    }
    if ( ! function_exists( 'wp_cache_delete' ) ) {
        function wp_cache_delete( string $key, string $group = '' ): bool {
            unset( Fake_Object_Cache::$store[ $group . ':' . $key ] );
            return true;
        }
    }
    if ( ! function_exists( 'wp_rand' ) ) {
        function wp_rand(): int {
            return mt_rand();
        }
    }
}

namespace FotoGrids\Tests\Integration {

use FotoGrids\Cache\Metadata_Cache;
use FotoGrids\Cache\Object_Cache;

require_once dirname( __DIR__, 2 ) . '/src/includes/cache/class-object-cache.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/cache/class-metadata-cache.php';

/**
 * Group invalidation in Object_Cache across persistent object-cache backends.
 *
 * Each new Object_Cache instance stands in for a new request.
 *
 * @package FotoGrids\Tests\Integration
 * @since   1.3.0
 */
final class ObjectCacheSaltTest {

    private const GROUP = 'fg_test';

    public static function run(): void {
        foreach ( array( 'redis', 'typed' ) as $mode ) {
            self::test_flush_makes_every_earlier_key_a_miss( $mode );
            self::test_salt_never_repeats_across_requests( $mode );
            self::test_lost_salt_does_not_resurrect_earlier_keys( $mode );
            self::test_pre_upgrade_version_keys_are_unreachable( $mode );
        }
        self::test_salt_is_stored_without_expiry();
        self::test_metadata_entries_expire_within_a_day();
    }

    private static function test_flush_makes_every_earlier_key_a_miss( string $mode ): void {
        \Fake_Object_Cache::reset( $mode );

        $written = array();
        for ( $request = 0; $request < 5; $request++ ) {
            $cache = new Object_Cache( self::GROUP );
            $key   = 'k' . $request;
            $cache->set( $key, 'value-' . $request );
            self::assert_same( 'value-' . $request, ( new Object_Cache( self::GROUP ) )->get( $key ), "[$mode] A key should hit before a flush." );
            $written[] = $key;

            ( new Object_Cache( self::GROUP ) )->flush_namespace();

            $reader = new Object_Cache( self::GROUP );
            foreach ( $written as $earlier ) {
                self::assert_same( false, $reader->get( $earlier ), "[$mode] Every key written before flush " . ( $request + 1 ) . " should miss." );
            }
        }
    }

    private static function test_salt_never_repeats_across_requests( string $mode ): void {
        \Fake_Object_Cache::reset( $mode );

        $seen = array( self::stored_salt_after_first_use() => true );
        for ( $flush = 0; $flush < 50; $flush++ ) {
            ( new Object_Cache( self::GROUP ) )->flush_namespace();
            ( new Object_Cache( self::GROUP ) )->get( 'probe' );

            $salt = self::stored_salt();
            self::assert_true( ! isset( $seen[ $salt ] ), "[$mode] Flush " . ( $flush + 1 ) . ' reused an earlier salt.' );
            $seen[ $salt ] = true;
        }
    }

    private static function test_lost_salt_does_not_resurrect_earlier_keys( string $mode ): void {
        \Fake_Object_Cache::reset( $mode );

        ( new Object_Cache( self::GROUP ) )->set( 'k', 'before-eviction' );
        unset( \Fake_Object_Cache::$store[ self::GROUP . ':' . self::GROUP . '_salt' ] );

        $cache = new Object_Cache( self::GROUP );
        self::assert_same( false, $cache->get( 'k' ), "[$mode] A key written before the salt was lost should miss." );

        $cache->set( 'k', 'after-eviction' );
        self::assert_same( 'after-eviction', ( new Object_Cache( self::GROUP ) )->get( 'k' ), "[$mode] A key written after the salt was replaced should hit." );
    }

    private static function test_pre_upgrade_version_keys_are_unreachable( string $mode ): void {
        \Fake_Object_Cache::reset( $mode );

        \Fake_Object_Cache::$store[ self::GROUP . ':' . self::GROUP . '_version' ] = 2;
        \Fake_Object_Cache::$store[ self::GROUP . ':v1_k' ]                         = 'stale-v1';
        \Fake_Object_Cache::$store[ self::GROUP . ':v2_k' ]                         = 'stale-v2';

        self::assert_same( false, ( new Object_Cache( self::GROUP ) )->get( 'k' ), "[$mode] Keys written under the integer version scheme should miss." );
    }

    private static function test_salt_is_stored_without_expiry(): void {
        \Fake_Object_Cache::reset( 'redis' );

        $cache = new Object_Cache( self::GROUP, 600 );
        $cache->set( 'k', 'v' );
        self::assert_same( 0, \Fake_Object_Cache::$ttls[ self::GROUP . ':' . self::GROUP . '_salt' ], 'The salt should be stored without an expiry.' );

        $cache->flush_namespace();
        self::assert_same( 0, \Fake_Object_Cache::$ttls[ self::GROUP . ':' . self::GROUP . '_salt' ], 'A replaced salt should be stored without an expiry.' );
    }

    private static function test_metadata_entries_expire_within_a_day(): void {
        \Fake_Object_Cache::reset( 'redis' );

        Metadata_Cache::remember_item(
            42,
            static function (): array {
                return array(
                    'tags'      => array(),
                    'people'    => array(),
                    'locations' => array(),
                );
            }
        );

        $entry_ttls = array_filter(
            \Fake_Object_Cache::$ttls,
            static function ( string $key ): bool {
                return str_ends_with( $key, '_item_42' );
            },
            ARRAY_FILTER_USE_KEY
        );
        self::assert_same( array( DAY_IN_SECONDS ), array_values( $entry_ttls ), 'A metadata entry should be stored with a one-day expiry.' );
    }

    private static function stored_salt_after_first_use(): string {
        ( new Object_Cache( self::GROUP ) )->get( 'probe' );
        return self::stored_salt();
    }

    private static function stored_salt(): string {
        return (string) \Fake_Object_Cache::$store[ self::GROUP . ':' . self::GROUP . '_salt' ];
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
    ObjectCacheSaltTest::run();
    fwrite( STDOUT, "ObjectCacheSaltTest passed\n" );
}
}
