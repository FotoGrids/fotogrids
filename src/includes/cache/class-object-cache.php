<?php
declare(strict_types=1);

namespace FotoGrids\Cache;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Generic object-cache primitive.
 *
 * A thin, reusable wrapper around the WordPress object cache (wp_cache_*),
 * scoped to a single cache group, with a version-salt namespacing scheme for
 * cheap, backend-agnostic group invalidation.
 *
 * Why the version salt instead of wp_cache_flush_group(): flush_group() is not
 * implemented by every persistent object-cache backend, and is a no-op without
 * one. Instead, every key is namespaced by an integer "version" stored in the
 * cache itself. Bumping that version orphans every previously written key in a
 * single write, which works identically on all backends.
 *
 * Without a persistent object cache, wp_cache_* is per-request only, so this
 * still safely de-duplicates repeated reads within a single request.
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
	 * Cache key (within the group) that holds the current version salt.
	 *
	 * @var string
	 */
	private string $version_key;

	/**
	 * @since 1.0.0
	 * @param string $group Object-cache group name (e.g. 'fotogrids_item_metadata').
	 * @param int    $ttl   Default entry TTL in seconds. 0 = persist until invalidated.
	 */
	public function __construct( string $group, int $ttl = 0 ) {
		$this->group       = $group;
		$this->ttl         = $ttl;
		$this->version_key = $group . '_version';
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
	 * Invalidate every key in this group by bumping the version salt.
	 *
	 * Cheap (one write) and backend-agnostic. Previously written keys become
	 * unreachable rather than being individually deleted.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function flush_namespace(): void {
		$version = $this->version() + 1;
		wp_cache_set( $this->version_key, $version, $this->group, 0 );
	}

	/**
	 * Current namespace version salt, lazily initialised to 1.
	 *
	 * @since 1.0.0
	 * @return int
	 */
	private function version(): int {
		$version = wp_cache_get( $this->version_key, $this->group );
		if ( ! is_int( $version ) ) {
			$version = 1;
			wp_cache_set( $this->version_key, $version, $this->group, 0 );
		}
		return $version;
	}

	/**
	 * Build the version-namespaced storage key for a logical key.
	 *
	 * @since 1.0.0
	 * @param string $key Logical key.
	 * @return string
	 */
	private function namespaced_key( string $key ): string {
		return 'v' . $this->version() . '_' . $key;
	}
}
