<?php
declare(strict_types=1);

namespace FotoGrids\Cache;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Per-item metadata cache.
 *
 * Caches the result of Metadata_Manager::get_item_metadata( $attachment_id ),
 * which runs on the frontend render / lightbox path and can be hit many times
 * per page load. Composes the generic Object_Cache primitive.
 *
 * Invalidation is two-tier and driven by Metadata_Manager's write paths:
 *   - Per-attachment writes (add / remove / clear item links) call
 *     forget_item() to drop that one attachment's entry.
 *   - Tag-definition writes (rename / delete / bulk-delete / merge) can change
 *     the output for an unknown set of attachments, so they call forget_all()
 *     which bumps the namespace version.
 *
 * @package FotoGrids\Cache
 * @since   1.0.0
 */
class Metadata_Cache {

	/**
	 * Object-cache group for per-item metadata.
	 *
	 * @var string
	 */
	private const GROUP = 'fotogrids_item_metadata';

	/**
	 * Shared object-cache instance.
	 *
	 * @var Object_Cache|null
	 */
	private static ?Object_Cache $store = null;

	/**
	 * Lazily build the backing Object_Cache.
	 *
	 * @since 1.0.0
	 * @return Object_Cache
	 */
	private static function store(): Object_Cache {
		if ( null === self::$store ) {
			self::$store = new Object_Cache( self::GROUP, 0 );
		}
		return self::$store;
	}

	/**
	 * Return cached metadata for an attachment, or compute and cache it.
	 *
	 * @since 1.0.0
	 * @param int      $attachment_id Attachment ID.
	 * @param callable $producer      Returns the metadata array on a cache miss.
	 * @return array{tags: array, people: array, locations: array}
	 */
	public static function remember_item( int $attachment_id, callable $producer ): array {
		return (array) self::store()->remember( self::item_key( $attachment_id ), $producer );
	}

	/**
	 * Invalidate one attachment's cached metadata.
	 *
	 * @since 1.0.0
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public static function forget_item( int $attachment_id ): void {
		self::store()->delete( self::item_key( $attachment_id ) );
	}

	/**
	 * Invalidate cached metadata for every attachment.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function forget_all(): void {
		self::store()->flush_namespace();
	}

	/**
	 * Logical cache key for one attachment.
	 *
	 * @since 1.0.0
	 * @param int $attachment_id Attachment ID.
	 * @return string
	 */
	private static function item_key( int $attachment_id ): string {
		return 'item_' . $attachment_id;
	}
}
