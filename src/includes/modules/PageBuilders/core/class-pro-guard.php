<?php
/**
 * Pro-feature guard for page-builder hosts.
 *
 * @package FotoGrids\Modules\PageBuilders
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Computes whether a gallery or album "requires Pro" - i.e. whether any of
 * its current settings rely on a Pro-only feature.
 *
 * This guard exists for **insertion decisions**, not rendering. The product
 * rule is:
 *
 *   - Rendering is license-blind. A gallery created with Pro keeps rendering
 *     forever, on any license state, in both editor previews and on the
 *     public page. The renderer never calls this guard.
 *   - Insertion uses this guard to decide whether the picker disables the
 *     gallery card for the current user:
 *       - never-Pro user           -> card disabled with a Requires Pro badge
 *       - active-Pro user          -> card enabled
 *       - lapsed-Pro user          -> card stays enabled; the user is
 *                                     placing an existing gallery, not
 *                                     editing one
 *
 * The set of "Pro features" is **filter-driven**. Free ships an empty
 * registry; Pro adds its own features when it loads. This avoids hard-coding
 * a Free-side list of Pro features that would drift the moment Pro evolves.
 *
 *   add_filter(
 *       'fotogrids/page_builders/pro_features',
 *       function ( $registry ) {
 *           $registry['pro_layouts']        = [ 'detect' => 'callback', ... ];
 *           $registry['pro_permissions']    = [ ... ];
 *           return $registry;
 *       }
 *   );
 *
 * Each registry entry's `detect` is a callable that receives the resolved
 * gallery/album settings array and returns true if THAT feature is in use
 * for this collection. The guard short-circuits on the first true.
 *
 * @since 1.0.0
 */
final class Pro_Guard {

	/**
	 * Filter name for the Pro-feature registry. Pro hooks here to declare
	 * its features.
	 *
	 * @var string
	 */
	public const FILTER_REGISTRY = 'fotogrids/page_builders/pro_features';

	/**
	 * Filter name for the final per-collection decision. Lets Pro or
	 * third-party plugins force a result if their own logic needs to (e.g.
	 * a custom permission model not represented in settings).
	 *
	 * @var string
	 */
	public const FILTER_REQUIRES_PRO = 'fotogrids/page_builders/requires_pro';

	/**
	 * Returns true if a gallery requires Pro to render with its current
	 * settings.
	 *
	 * Pure read - never mutates settings or fires any side effect. Always
	 * safe to call from the REST layer.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return bool
	 */
	public static function gallery_requires_pro( int $gallery_id ): bool {
		if ( $gallery_id <= 0 ) {
			return false;
		}
		$settings = self::resolve_gallery_settings( $gallery_id );
		return self::settings_require_pro( $settings, 'gallery', $gallery_id );
	}

	/**
	 * Returns true if an album requires Pro to render with its current
	 * settings.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album post ID.
	 * @return bool
	 */
	public static function album_requires_pro( int $album_id ): bool {
		if ( $album_id <= 0 ) {
			return false;
		}
		$settings = self::resolve_album_settings( $album_id );
		return self::settings_require_pro( $settings, 'album', $album_id );
	}

	/**
	 * Returns the list of Pro-feature ids triggered by a gallery's current
	 * settings. Useful for the picker tooltip ("Requires: Pro Layouts, EXIF
	 * Map") and for debugging.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return string[] Feature ids; empty if the gallery does not require Pro.
	 */
	public static function gallery_pro_features( int $gallery_id ): array {
		if ( $gallery_id <= 0 ) {
			return array();
		}
		return self::triggered_features(
			self::resolve_gallery_settings( $gallery_id ),
			'gallery',
			$gallery_id
		);
	}

	/**
	 * Returns the list of Pro-feature ids triggered by an album's current
	 * settings.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album post ID.
	 * @return string[] Feature ids; empty if the album does not require Pro.
	 */
	public static function album_pro_features( int $album_id ): array {
		if ( $album_id <= 0 ) {
			return array();
		}
		return self::triggered_features(
			self::resolve_album_settings( $album_id ),
			'album',
			$album_id
		);
	}

	// -------------------------------------------------------------------------
	// Internals
	// -------------------------------------------------------------------------

	/**
	 * Decision wrapper: inspect settings, then let the final
	 * `requires_pro` filter override.
	 *
	 * @since 1.0.0
	 * @param array  $settings    Resolved settings (defaults merged).
	 * @param string $kind        'gallery' | 'album'.
	 * @param int    $object_id   Post id, for the filter payload.
	 * @return bool
	 */
	private static function settings_require_pro( array $settings, string $kind, int $object_id ): bool {
		$features  = self::registry();
		$triggered = self::run_detectors( $features, $settings );

		$requires = ! empty( $triggered );

		/**
		 * Final authority on whether a collection requires Pro to be
		 * inserted by a page-builder host. Pro and third parties can short
		 * circuit (return true) or override (return false) the
		 * settings-based decision.
		 *
		 * @since 1.0.0
		 * @param bool   $requires    Whether the collection requires Pro.
		 * @param string $kind        'gallery' | 'album'.
		 * @param int    $object_id   Post id.
		 * @param array  $settings    Resolved settings.
		 * @param array  $triggered   Pro feature ids the settings triggered.
		 */
		return (bool) apply_filters(
			self::FILTER_REQUIRES_PRO,
			$requires,
			$kind,
			$object_id,
			$settings,
			$triggered
		);
	}

	/**
	 * Returns the Pro feature ids triggered by a settings array.
	 *
	 * @since 1.0.0
	 * @param array  $settings  Resolved settings.
	 * @param string $kind      'gallery' | 'album'.
	 * @param int    $object_id Post id.
	 * @return string[]
	 */
	private static function triggered_features( array $settings, string $kind, int $object_id ): array {
		unset( $kind, $object_id );
		return self::run_detectors( self::registry(), $settings );
	}

	/**
	 * Run every registered detector against the settings array.
	 *
	 * @since 1.0.0
	 * @param array $registry Filter-built registry: [ id => [ 'detect' => callable, ... ] ].
	 * @param array $settings Resolved settings.
	 * @return string[] Triggered feature ids.
	 */
	private static function run_detectors( array $registry, array $settings ): array {
		$triggered = array();

		foreach ( $registry as $feature_id => $spec ) {
			if ( ! is_array( $spec ) || empty( $spec['detect'] ) || ! is_callable( $spec['detect'] ) ) {
				continue;
			}
			try {
				$hit = (bool) call_user_func( $spec['detect'], $settings );
			} catch ( \Throwable $e ) {
				// A misbehaving detector must not poison the whole guard.
				$hit = false;
			}
			if ( $hit ) {
				$triggered[] = (string) $feature_id;
			}
		}

		return $triggered;
	}

	/**
	 * Build the Pro-feature registry. Free ships an empty registry; Pro
	 * (and any third party) adds features via the filter.
	 *
	 * @since 1.0.0
	 * @return array<string, array<string, mixed>>
	 */
	private static function registry(): array {
		$registry = array();

		/**
		 * Pro-feature registry. Each entry:
		 *   $registry['feature_id'] = [
		 *       'label'  => __( 'Human label', '...' ),
		 *       'detect' => function ( array $settings ): bool { ... },
		 *   ];
		 *
		 * @since 1.0.0
		 * @param array<string, array<string, mixed>> $registry
		 */
		$registry = apply_filters( self::FILTER_REGISTRY, $registry );

		return is_array( $registry ) ? $registry : array();
	}

	/**
	 * Resolve a gallery's current settings with defaults merged in.
	 *
	 * `Public_Render::get_gallery_settings()` is `private`, so the guard
	 * cannot delegate to it. Instead we merge defaults from
	 * Collection_Defaults onto the saved post meta directly. This is the
	 * same shape the renderer sees, minus the runtime filters - which is
	 * fine, because Pro_Guard only looks at opt-ins (post-meta values),
	 * never at defaults that would always be the same.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery post ID.
	 * @return array
	 */
	private static function resolve_gallery_settings( int $gallery_id ): array {
		if ( class_exists( '\FotoGrids\Galleries\Gallery_Repository' ) ) {
			return (array) \FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery_id );
		}
		return array();
	}

	/**
	 * Resolve an album's current settings with defaults merged in.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album post ID.
	 * @return array
	 */
	private static function resolve_album_settings( int $album_id ): array {
		if ( class_exists( '\FotoGrids\Albums\Album_Repository' ) ) {
			return (array) \FotoGrids\Albums\Album_Repository::get_settings( $album_id );
		}

		$settings = array();
		$saved    = get_post_meta( $album_id, 'fotogrids_settings', true );
		if ( is_array( $saved ) ) {
			$settings = array_merge( $settings, $saved );
		}
		return $settings;
	}
}
