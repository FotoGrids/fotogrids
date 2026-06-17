<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Collection_Header;

use FotoGrids\Gallery_Album_Relations;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves the parent album that should anchor a gallery's breadcrumb / back
 * button.
 *
 * The breadcrumb model is *visit-context aware*, not a canonical tree:
 *
 *   1. If a `via_album_id` was supplied (?fg_via on the URL, or the REST
 *      meta override coming out of an Album → Gallery AJAX swap) AND that
 *      album really contains the current gallery, that album wins. The
 *      visitor told us where they came from; we trust them.
 *
 *   2. Otherwise, fall back to the canonical relationship table. If the
 *      gallery belongs to *exactly one* album, that album becomes the
 *      breadcrumb parent (also drives Google's BreadcrumbList rich result
 *      on direct visits - see Breadcrumb_Schema).
 *
 *   3. If the gallery belongs to zero or two-plus albums, there is no
 *      single parent to point back to. Returns null. Collection_Header's
 *      supports() check then renders nothing.
 *
 * The resolver is the single source of truth for this rule. Collection_Header,
 * Breadcrumb_Schema, and any future caller (Pro SEO integration, third-party
 * breadcrumb plugin) MUST use this helper rather than re-deriving the rule.
 *
 * @package FotoGrids\Render\Features\Collection_Header
 * @since   1.0.0
 */
final class Breadcrumb_Resolver {

	/**
	 * Per-request memo keyed by `{gallery_id}|{via_album_id|0}`.
	 *
	 * @var array<string, ?int>
	 */
	private static array $cache = array();

	/**
	 * Resolve the parent album for a given gallery render, or null if
	 * no single parent applies.
	 *
	 * @since 1.0.0
	 * @param int      $gallery_id  Gallery whose breadcrumb we're building.
	 * @param int|null $via_album_id Visit-context album (null = no hint).
	 * @return int|null Parent album post ID, or null when nothing should render.
	 */
	public static function resolve_parent_album( int $gallery_id, ?int $via_album_id ): ?int {
		if ( $gallery_id <= 0 ) {
			return null;
		}

		$cache_key = $gallery_id . '|' . ( $via_album_id ? $via_album_id : 0 );
		if ( array_key_exists( $cache_key, self::$cache ) ) {
			return self::$cache[ $cache_key ];
		}

		$resolved = self::resolve_uncached( $gallery_id, $via_album_id );

		self::$cache[ $cache_key ] = $resolved;
		return $resolved;
	}

	/**
	 * Uncached resolver. Called once per cache key per request.
	 *
	 * @since 1.0.0
	 * @param int      $gallery_id   Gallery post ID.
	 * @param int|null $via_album_id Visit-context album (already sanitised to positive int or null).
	 * @return int|null
	 */
	private static function resolve_uncached( int $gallery_id, ?int $via_album_id ): ?int {
		if ( ! class_exists( Gallery_Album_Relations::class ) ) {
			return null;
		}

		// Load the full list of albums this gallery belongs to *once*. We
		// need it for both branches: the visit-context branch validates
		// that the supplied album actually contains the gallery; the
		// canonical-fallback branch counts the list.
		$albums = Gallery_Album_Relations::get_albums_for_gallery(
			$gallery_id,
			array(
				'include_meta' => false,
				// We only need IDs for the contains-check + count, so
				// keep the query as lean as possible. include_meta:false
				// skips the per-album cover/status enrichment.
			)
		);

		if ( ! is_array( $albums ) || empty( $albums ) ) {
			return null;
		}

		$album_ids = array();
		foreach ( $albums as $album_row ) {
			$album_id = (int) ( $album_row->ID ?? 0 );
			if ( $album_id > 0 ) {
				$album_ids[] = $album_id;
			}
		}

		if ( empty( $album_ids ) ) {
			return null;
		}

		// Branch 1 - visit context wins when it points at a real parent.
		if ( null !== $via_album_id && $via_album_id > 0 && in_array( $via_album_id, $album_ids, true ) ) {
			return $via_album_id;
		}

		// Branch 2 - single-album fallback. Includes direct visits where
		// ?fg_via is absent, and the case where it's set but doesn't
		// actually contain the gallery (treat as no hint).
		if ( count( $album_ids ) === 1 ) {
			return $album_ids[0];
		}

		// Branch 3 - ambiguous (2+ albums): nothing to render.
		return null;
	}

	/**
	 * Resets the per-request cache. Used by tests.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function reset_for_tests(): void {
		self::$cache = array();
	}
}
