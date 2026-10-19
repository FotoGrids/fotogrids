<?php
declare(strict_types=1);

namespace FotoGrids\Cache;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Generic object-cache primitive.
 *
 * A thin wrapper around the WordPress object cache (wp_cache_*), scoped to a
 * single cache group. Every key is namespaced by a salt stored in the group, so
 * replacing the salt invalidates the whole group in one write on any backend.
 * A missing salt is replaced with a fresh one, never a previous value, so keys
 * written before the salt was lost stay unreachable.
 *
 * Without a persistent object cache, wp_cache_* is per-request only, so this
 * still de-duplicates repeated reads within a single request.
 *
 * Compose this (do not extend it) from a domain cache class - see
 * Metadata_Cache for the canonical example.
 *
 * @package FotoGrids\Cache
 * @since   1.0.0
 */
class Object_Cache {

	/**
	 * Object-cache group all keys live under.
	 *
	 * @var string
	 */
	private string $group;

	/**
	 * Default TTL in seconds for stored entries (0 = no expiry).
	 *
	 * @var int
	 */
	private int $ttl;

	/**
	 * Cache key (within the group) that holds the current namespace salt.
	 *
	 * @var string
	 */
	private string $salt_key;

	/**
	 * @since 1.0.0
	 * @param string $group Object-cache group name (e.g. 'fotogrids_item_metadata').
	 * @param int    $ttl   Default entry TTL in seconds. 0 = persist until invalidated.
	 */
	public function __construct( string $group, int $ttl = 0 ) {
		$this->group    = $group;
		$this->ttl      = $ttl;
		$this->salt_key = $group . '_salt';
	}

	/**
	 * Get-or-compute: return the cached value for $key, or run $callback,
	 * store its result, and return it.
	 *
	 * The callback's return value is cached as-is. If you need to avoid caching
	 * a particular result (e.g. a transient error), don't use remember() for
	 * that path - call get()/set() directly.
	 *
	 * @since 1.0.0
	 * @param string   $key      Logical key (will be namespaced internally).
	 * @param callable $callback Producer invoked on a cache miss.
	 * @param int|null $ttl      Optional TTL override for this entry.
	 * @return mixed
	 */
	public function remember( string $key, callable $callback, ?int $ttl = null ) {
		$cached = $this->get( $key );
		if ( false !== $cached ) {
			return $cached;
		}

		$value = $callback();
		$this->set( $key, $value, $ttl );

		return $value;
	}

	/**
	 * Read a value from the cache.
	 *
	 * @since 1.0.0
	 * @param string $key Logical key.
	 * @return mixed The stored value, or false on a miss.
	 */
	public function get( string $key ) {
		return wp_cache_get( $this->namespaced_key( $key ), $this->group );
	}

	/**
	 * Write a value to the cache.
	 *
	 * @since 1.0.0
	 * @param string   $key   Logical key.
	 * @param mixed    $value Value to store.
	 * @param int|null $ttl   Optional TTL override (defaults to the group TTL).
	 * @return bool
	 */
	public function set( string $key, $value, ?int $ttl = null ): bool {
		return wp_cache_set( $this->namespaced_key( $key ), $value, $this->group, $ttl ?? $this->ttl );
	}

	/**
	 * Delete a single key from the cache.
	 *
	 * @since 1.0.0
	 * @param string $key Logical key.
	 * @return bool
	 */
	public function delete( string $key ): bool {
		return wp_cache_delete( $this->namespaced_key( $key ), $this->group );
	}

	/**
	 * Invalidate every key in this group by replacing the namespace salt.
	 *
	 * Previously written keys become unreachable rather than being
	 * individually deleted, and expire on their own TTL.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function flush_namespace(): void {
		wp_cache_set( $this->salt_key, self::new_salt(), $this->group, 0 );
	}

	/**
	 * Current namespace salt, created on first use and whenever the stored
	 * one is missing.
	 *
	 * Backends differ in the type they return for a stored scalar, so any
	 * non-empty scalar is accepted and compared as a string.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	private function salt(): string {
		$salt = wp_cache_get( $this->salt_key, $this->group );
		if ( is_scalar( $salt ) && '' !== (string) $salt ) {
			return (string) $salt;
		}

		$salt = self::new_salt();
		wp_cache_set( $this->salt_key, $salt, $this->group, 0 );
		return $salt;
	}

	/**
	 * Generate a namespace salt that does not repeat an earlier one.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	private static function new_salt(): string {
		return substr( md5( microtime() . wp_rand() ), 0, 12 );
	}

	/**
	 * Build the salt-namespaced storage key for a logical key.
	 *
	 * @since 1.0.0
	 * @param string $key Logical key.
	 * @return string
	 */
	private function namespaced_key( string $key ): string {
		return 's' . $this->salt() . '_' . $key;
	}
}
