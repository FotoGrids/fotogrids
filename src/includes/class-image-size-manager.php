<?php
declare(strict_types=1);

namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Manages FotoGrids plugin-wide and gallery-custom image sizes.
 *
 * Responsibilities:
 * - Registers plugin-managed WP image sizes at `init` (fotogrids_thumbnail,
 *   fotogrids_full, and the hidden fotogrids_full_mobile companion).
 * - Re-registers the gallery-custom sizes (fotogrids_custom_*) stored in the
 *   fotogrids_custom_sizes option, which follows each collection's saved settings.
 * - Resolves a setting value (e.g. 'fotogrids_thumbnail', 'custom', 'large')
 *   to a WP size string that actually exists for a given attachment, with a
 *   graceful fallback chain.
 * - Computes deterministic slugs for gallery-custom sizes.
 *
 * @package FotoGrids
 * @since   1.0.0
 */
final class Image_Size_Manager {

	public const SLUG_THUMBNAIL     = 'fotogrids_thumbnail';
	public const SLUG_FULL          = 'fotogrids_full';
	public const SLUG_FULL_MOBILE   = 'fotogrids_full_mobile';  // hidden companion
	public const SLUG_MASONRY       = 'fotogrids_masonry';      // fixed width, variable height
	public const SLUG_JUSTIFIED     = 'fotogrids_justified';    // fixed height, variable width
	public const CUSTOM_SLUG_PREFIX = 'fotogrids_custom_';

	// Option keys
	private const OPT_PLUGIN_SIZES = 'fotogrids_media_settings';
	private const OPT_CUSTOM_SIZES = 'fotogrids_custom_sizes';

	// Post meta keys of the collection settings that select a custom size.
	private const SIZE_META_KEY_PREFIXES = array(
		'fotogrids_thumbnail_size',
		'fotogrids_thumbnail_custom_size_',
		'fotogrids_full_image_size',
		'fotogrids_full_image_custom_size_',
	);

	/**
	 * Collections being deleted in this request, whose meta removal must not re-sync the registry.
	 *
	 * @var array<int, true>
	 */
	private static array $deleting = array();

	// Fallback chains (per size role)
	private const FALLBACK_THUMBNAIL = array( self::SLUG_THUMBNAIL, 'thumbnail', 'medium', 'full' );
	private const FALLBACK_FULL      = array( self::SLUG_FULL, 'large', 'full' );

	// Default plugin-wide size dimensions
	private const DEFAULT_THUMBNAIL_WIDTH     = 400;
	private const DEFAULT_THUMBNAIL_HEIGHT    = 300;
	private const DEFAULT_THUMBNAIL_CROP      = true;
	private const DEFAULT_THUMBNAIL_ALIGNMENT = 'center';
	private const DEFAULT_FULL_WIDTH          = 1920;
	private const DEFAULT_FULL_HEIGHT         = 0;   // 0 = proportional
	private const DEFAULT_FULL_CROP           = false;
	private const DEFAULT_MASONRY_WIDTH       = 600; // height auto (variable)
	private const DEFAULT_JUSTIFIED_HEIGHT    = 400; // width  auto (variable)

	/**
	 * Wire up the WordPress hooks.
	 *
	 * Call once from fotogrids_init() (runs on plugins_loaded, before init).
	 * The add_image_size() calls must happen on or after 'init', so they are
	 * scheduled there.
	 *
	 * @since 1.0.0
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'add_image_sizes' ), 1 );
		add_action( 'before_delete_post', array( __CLASS__, 'on_before_delete_post' ), 10, 2 );
		add_action( 'added_post_meta', array( __CLASS__, 'on_post_meta_change' ), 10, 3 );
		add_action( 'updated_post_meta', array( __CLASS__, 'on_post_meta_change' ), 10, 3 );
		add_action( 'deleted_post_meta', array( __CLASS__, 'on_post_meta_change' ), 10, 3 );
	}

	/**
	 * Drop a deleted gallery's or album's association from the custom size registry.
	 *
	 * @since 1.1.3
	 * @param int      $post_id Post ID being deleted.
	 * @param \WP_Post $post    Post object being deleted.
	 * @return void
	 */
	public static function on_before_delete_post( int $post_id, \WP_Post $post ): void {
		if ( 'fotogrids_gallery' !== $post->post_type && 'fotogrids_album' !== $post->post_type ) {
			return;
		}

		self::$deleting[ $post_id ] = true;
		self::remove_gallery_from_custom_sizes( $post_id );
	}

	/**
	 * Register all FotoGrids image sizes with WordPress.
	 *
	 * Called on the `init` action (priority 1, before most other code).
	 *
	 * @since 1.0.0
	 */
	public static function add_image_sizes(): void {
		$settings = self::get_plugin_size_settings();

		$thumb_crop = self::build_crop_param(
			(bool) $settings['thumbnail_crop'],
			(string) $settings['thumbnail_alignment']
		);
		add_image_size(
			self::SLUG_THUMBNAIL,
			(int) $settings['thumbnail_width'],
			(int) $settings['thumbnail_height'],
			$thumb_crop
		);

		add_image_size(
			self::SLUG_FULL,
			(int) $settings['full_width'],
			(int) $settings['full_height'],
			false  // full size is never cropped
		);

		// Hidden companion, always half fotogrids_full width.
		$mobile_width = max( 1, (int) floor( $settings['full_width'] / 2 ) );
		add_image_size(
			self::SLUG_FULL_MOBILE,
			$mobile_width,
			0,     // proportional height
			false
		);

		add_image_size(
			self::SLUG_MASONRY,
			max( 1, (int) $settings['masonry_width'] ),
			0,     // 0 = proportional height (variable)
			false  // never cropped - the layout decides
		);

		add_image_size(
			self::SLUG_JUSTIFIED,
			0,     // 0 = proportional width (variable)
			max( 1, (int) $settings['justified_height'] ),
			false  // never cropped - the layout decides
		);

		$custom_sizes = get_option( self::OPT_CUSTOM_SIZES, array() );
		if ( is_array( $custom_sizes ) ) {
			foreach ( $custom_sizes as $slug => $config ) {
				if ( ! is_array( $config ) ) {
					continue;
				}
				$crop = self::build_crop_param(
					(bool) ( $config['crop'] ?? false ),
					(string) ( $config['alignment'] ?? 'center' )
				);
				add_image_size(
					(string) $slug,
					(int) ( $config['width'] ?? 0 ),
					(int) ( $config['height'] ?? 0 ),
					$crop
				);
			}
		}
	}

	/**
	 * Resolve a setting value to a WP size slug that exists for the given attachment.
	 *
	 * For 'custom', the caller must first ensure the custom size is registered via
	 * resolve_setting_slugs() and pass the resulting slug as $custom_slug.
	 *
	 * @since  1.0.0
	 * @param  int         $attachment_id  WP attachment post ID.
	 * @param  string      $setting_value  The stored setting value ('fotogrids_thumbnail',
	 *                                     'thumbnail', 'large', 'custom', etc.).
	 * @param  string      $role           'thumbnail' or 'full' - determines the fallback chain.
	 * @param  string|null $custom_slug    Resolved slug when $setting_value === 'custom'.
	 * @return string      A WP size slug guaranteed to resolve (falls back to 'full').
	 */
	public static function resolve_size(
		int $attachment_id,
		string $setting_value,
		string $role = 'thumbnail',
		?string $custom_slug = null
	): string {
		$candidates = self::build_candidate_chain( $setting_value, $role, $custom_slug );

		foreach ( $candidates as $candidate ) {
			if ( 'full' === $candidate ) {
				return 'full'; // 'full' always exists (it's the original upload)
			}

			if ( self::size_exists_for_attachment( $attachment_id, $candidate ) ) {
				return $candidate;
			}

			// WordPress skips a size the original already fits inside, so the original is that size.
			if ( 'full' === $role && self::original_fits_size( $attachment_id, $candidate ) ) {
				return 'full';
			}
		}

		return 'full'; // ultimate fallback
	}

	/**
	 * Whether an attachment's original fits within a registered size's bounds.
	 *
	 * @since  1.1.3
	 * @param  int    $attachment_id WP attachment post ID.
	 * @param  string $size_slug     Registered image size slug.
	 * @return bool
	 */
	private static function original_fits_size( int $attachment_id, string $size_slug ): bool {
		$subsizes = wp_get_registered_image_subsizes();
		$metadata = wp_get_attachment_metadata( $attachment_id );

		if ( ! isset( $subsizes[ $size_slug ] ) || ! is_array( $metadata )
			|| empty( $metadata['width'] ) || empty( $metadata['height'] ) ) {
			return false;
		}

		return self::dimensions_fit(
			(int) $metadata['width'],
			(int) $metadata['height'],
			(int) $subsizes[ $size_slug ]['width'],
			(int) $subsizes[ $size_slug ]['height']
		);
	}

	/**
	 * Whether a width × height box fits within a size's bounds, where a bound of 0 is unlimited.
	 *
	 * @since  1.1.3
	 * @param  int $width      Image width in pixels.
	 * @param  int $height     Image height in pixels.
	 * @param  int $max_width  Size bound width; 0 means unlimited.
	 * @param  int $max_height Size bound height; 0 means unlimited.
	 * @return bool
	 */
	public static function dimensions_fit( int $width, int $height, int $max_width, int $max_height ): bool {
		return ( 0 === $max_width || $width <= $max_width )
			&& ( 0 === $max_height || $height <= $max_height );
	}

	/**
	 * Returns the mobile companion of the Lightbox image when it is narrower than the image itself.
	 *
	 * @since  1.1.3
	 * @param  int $attachment_id WP attachment post ID.
	 * @param  int $full_width    Width of the resolved Lightbox image in pixels.
	 * @return array{url: string, width: int}|null
	 */
	public static function mobile_companion( int $attachment_id, int $full_width ): ?array {
		$mobile = image_get_intermediate_size( $attachment_id, self::SLUG_FULL_MOBILE );
		if ( ! is_array( $mobile ) || empty( $mobile['url'] ) || empty( $mobile['width'] )
			|| (int) $mobile['width'] >= $full_width ) {
			return null;
		}

		return array(
			'url'   => (string) $mobile['url'],
			'width' => (int) $mobile['width'],
		);
	}

	/**
	 * Build the ordered candidate list for size resolution.
	 *
	 * @since  1.0.0
	 * @param  string      $setting_value
	 * @param  string      $role          'thumbnail' | 'full'
	 * @param  string|null $custom_slug
	 * @return string[]
	 */
	private static function build_candidate_chain(
		string $setting_value,
		string $role,
		?string $custom_slug
	): array {
		if ( 'custom' === $setting_value && null !== $custom_slug ) {
			// Custom size: try the specific slug first, then the role fallback chain
			$fallback = 'full' === $role ? self::FALLBACK_FULL : self::FALLBACK_THUMBNAIL;
			return array_merge( array( $custom_slug ), $fallback );
		}

		if ( self::SLUG_THUMBNAIL === $setting_value ) {
			return self::FALLBACK_THUMBNAIL;
		}

		if ( self::SLUG_FULL === $setting_value ) {
			return self::FALLBACK_FULL;
		}

		// Any other named WP size: try it directly, then fall back by role.
		$fallback = 'full' === $role ? self::FALLBACK_FULL : self::FALLBACK_THUMBNAIL;
		if ( ! in_array( $setting_value, $fallback, true ) ) {
			array_unshift( $fallback, $setting_value );
		}
		return $fallback;
	}

	/**
	 * Check whether a specific image size derivative exists on disk for an attachment.
	 *
	 * Uses image_get_intermediate_size() which returns false when the derivative
	 * file is absent, even if the size is registered.
	 *
	 * @since  1.0.0
	 * @param  int    $attachment_id
	 * @param  string $size_slug
	 * @return bool
	 */
	public static function size_exists_for_attachment( int $attachment_id, string $size_slug ): bool {
		if ( 'full' === $size_slug ) {
			return true;
		}
		$data = image_get_intermediate_size( $attachment_id, $size_slug );
		return ( false !== $data && ! empty( $data['file'] ) );
	}

	/**
	 * Compute the deterministic slug for a gallery-custom size.
	 *
	 * Format: fotogrids_custom_{W}x{H}_{crop_flag}
	 * Examples:
	 *   400×300 hard-crop  → fotogrids_custom_400x300_crop
	 *   800×0 no-crop      → fotogrids_custom_800x0_nocrop
	 *
	 * @since  1.0.0
	 * @param  int    $width
	 * @param  int    $height
	 * @param  bool   $crop
	 * @return string
	 */
	public static function compute_custom_slug( int $width, int $height, bool $crop ): string {
		$crop_flag = $crop ? 'crop' : 'nocrop';
		return self::CUSTOM_SLUG_PREFIX . "{$width}x{$height}_{$crop_flag}";
	}

	/**
	 * Custom sizes a set of collection settings asks for, keyed by role.
	 *
	 * @since  1.1.3
	 * @param  array<string, mixed> $settings     Collection settings.
	 * @param  bool                 $include_full Whether to read the Lightbox image size as well as the thumbnail.
	 * @return array<string, array{slug: string, width: int, height: int, crop: bool, alignment: string}>
	 */
	public static function custom_sizes_for( array $settings, bool $include_full = true ): array {
		$sizes = array();

		if ( 'custom' === ( $settings['thumbnail_size'] ?? null ) ) {
			$sizes['thumbnail'] = self::custom_size_spec(
				max( 1, (int) ( $settings['thumbnail_custom_size_width'] ?? 400 ) ),
				max( 0, (int) ( $settings['thumbnail_custom_size_height'] ?? 300 ) ),
				(bool) ( $settings['thumbnail_custom_size_crop'] ?? true ),
				$settings['thumbnail_custom_size_crop_alignment'] ?? null
			);
		}

		if ( $include_full && 'custom' === ( $settings['full_image_size'] ?? null ) ) {
			$sizes['full'] = self::custom_size_spec(
				max( 1, (int) ( $settings['full_image_custom_size_width'] ?? 1920 ) ),
				max( 0, (int) ( $settings['full_image_custom_size_height'] ?? 0 ) ),
				(bool) ( $settings['full_image_custom_size_crop'] ?? false ),
				$settings['full_image_custom_size_crop_alignment'] ?? null
			);
		}

		return $sizes;
	}

	/**
	 * Resolve the thumbnail and Lightbox size slugs a set of collection settings selects.
	 *
	 * A custom size is registered for the current request only; the persistent
	 * registry follows saved settings through sync_collection_sizes().
	 *
	 * @since  1.1.3
	 * @param  array<string, mixed> $settings Collection settings.
	 * @return array{string, string} [ thumbnail slug, Lightbox image slug ].
	 */
	public static function resolve_setting_slugs( array $settings ): array {
		$thumb_slug = is_string( $settings['thumbnail_size'] ?? null )
			? $settings['thumbnail_size']
			: self::SLUG_THUMBNAIL;
		$full_slug  = is_string( $settings['full_image_size'] ?? null )
			? $settings['full_image_size']
			: self::SLUG_FULL;

		foreach ( self::custom_sizes_for( $settings ) as $role => $size ) {
			add_image_size(
				$size['slug'],
				$size['width'],
				$size['height'],
				self::build_crop_param( $size['crop'], $size['alignment'] )
			);

			if ( 'thumbnail' === $role ) {
				$thumb_slug = $size['slug'];
			} else {
				$full_slug = $size['slug'];
			}
		}

		return array( $thumb_slug, $full_slug );
	}

	/**
	 * Re-sync the custom size registry when a collection's image size settings change.
	 *
	 * Hooked to added_post_meta, updated_post_meta and deleted_post_meta, so every
	 * writer of collection settings is covered.
	 *
	 * @since 1.1.3
	 * @param int|int[] $meta_id   Meta ID, or IDs for a delete.
	 * @param int       $object_id Post ID.
	 * @param string    $meta_key  Meta key.
	 * @return void
	 */
	public static function on_post_meta_change( $meta_id, $object_id, $meta_key ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		if ( ! is_string( $meta_key ) || ! self::is_size_meta_key( $meta_key ) || isset( self::$deleting[ (int) $object_id ] ) ) {
			return;
		}

		self::sync_collection_sizes( (int) $object_id );
	}

	/**
	 * Rewrite a collection's entries in the custom size registry from its saved settings.
	 *
	 * @since 1.1.3
	 * @param int $collection_id Gallery or album post ID.
	 * @return void
	 */
	public static function sync_collection_sizes( int $collection_id ): void {
		$post_type = get_post_type( $collection_id );
		if ( 'fotogrids_gallery' !== $post_type && 'fotogrids_album' !== $post_type ) {
			return;
		}

		$sizes = self::custom_sizes_for(
			Galleries\Gallery_Repository::get_settings( $collection_id ),
			'fotogrids_gallery' === $post_type
		);

		$original = get_option( self::OPT_CUSTOM_SIZES, array() );
		$registry = self::detach_collection( is_array( $original ) ? $original : array(), $collection_id );

		foreach ( $sizes as $size ) {
			$gallery_ids   = $registry[ $size['slug'] ]['gallery_ids'] ?? array();
			$gallery_ids[] = $collection_id;

			$registry[ $size['slug'] ] = array(
				'width'       => $size['width'],
				'height'      => $size['height'],
				'crop'        => $size['crop'],
				'alignment'   => $size['alignment'],
				'gallery_ids' => array_values( array_unique( $gallery_ids ) ),
			);

			add_image_size(
				$size['slug'],
				$size['width'],
				$size['height'],
				self::build_crop_param( $size['crop'], $size['alignment'] )
			);
		}

		if ( $registry !== $original ) {
			update_option( self::OPT_CUSTOM_SIZES, $registry, false );
		}
	}

	/**
	 * Remove a gallery's association from all custom sizes it contributed.
	 *
	 * Sizes with no remaining gallery_ids are removed from the registry
	 * (derivatives on disk are left untouched).
	 *
	 * @since  1.0.0
	 * @param  int $gallery_id
	 */
	public static function remove_gallery_from_custom_sizes( int $gallery_id ): void {
		$registry = get_option( self::OPT_CUSTOM_SIZES, array() );
		if ( ! is_array( $registry ) || empty( $registry ) ) {
			return;
		}

		$updated = self::detach_collection( $registry, $gallery_id );
		if ( $updated !== $registry ) {
			update_option( self::OPT_CUSTOM_SIZES, $updated, false );
		}
	}

	/**
	 * Remove a collection ID from every registry entry, dropping entries it was the last user of.
	 *
	 * @since  1.1.3
	 * @param  array<string, array<string, mixed>> $registry      Custom size registry.
	 * @param  int                                 $collection_id Gallery or album post ID.
	 * @return array<string, array<string, mixed>>
	 */
	private static function detach_collection( array $registry, int $collection_id ): array {
		foreach ( $registry as $slug => $config ) {
			$gallery_ids = $config['gallery_ids'] ?? array();
			$new_ids     = array_values( array_filter( $gallery_ids, fn( $id ) => $id !== $collection_id ) );

			if ( count( $new_ids ) === count( $gallery_ids ) ) {
				continue;
			}

			if ( empty( $new_ids ) ) {
				unset( $registry[ $slug ] );
			} else {
				$registry[ $slug ]['gallery_ids'] = $new_ids;
			}
		}

		return $registry;
	}

	/**
	 * Build one custom size entry.
	 *
	 * @since  1.1.3
	 * @param  int   $width     Width in pixels.
	 * @param  int   $height    Height in pixels; 0 is proportional.
	 * @param  bool  $crop      Whether the size is cropped.
	 * @param  mixed $alignment Crop alignment setting value.
	 * @return array{slug: string, width: int, height: int, crop: bool, alignment: string}
	 */
	private static function custom_size_spec( int $width, int $height, bool $crop, $alignment ): array {
		return array(
			'slug'      => self::compute_custom_slug( $width, $height, $crop ),
			'width'     => $width,
			'height'    => $height,
			'crop'      => $crop,
			'alignment' => is_string( $alignment ) ? $alignment : 'center',
		);
	}

	/**
	 * Whether a post meta key holds a collection image size setting.
	 *
	 * @since  1.1.3
	 * @param  string $meta_key Meta key.
	 * @return bool
	 */
	private static function is_size_meta_key( string $meta_key ): bool {
		foreach ( self::SIZE_META_KEY_PREFIXES as $prefix ) {
			if ( 0 === strpos( $meta_key, $prefix ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Read the plugin-wide size settings option, with defaults filled in.
	 *
	 * @since  1.0.0
	 * @return array{
	 *     thumbnail_width: int,
	 *     thumbnail_height: int,
	 *     thumbnail_crop: bool,
	 *     thumbnail_alignment: string,
	 *     full_width: int,
	 *     full_height: int,
	 *     full_crop: bool,
	 *     masonry_width: int,
	 *     justified_height: int,
	 * }
	 */
	public static function get_plugin_size_settings(): array {
		$defaults = self::get_plugin_size_defaults();
		$stored   = get_option( self::OPT_PLUGIN_SIZES, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		return array_merge( $defaults, $stored );
	}

	/**
	 * Validate, persist, and re-register plugin-wide size settings.
	 *
	 * Called from the REST POST /admin/media-settings endpoint.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $raw  Raw input from the request.
	 * @return array  The sanitised settings that were saved.
	 */
	public static function save_plugin_size_settings( array $raw ): array {
		$settings = array(
			'thumbnail_width'     => max( 1, (int) ( $raw['thumbnail_width'] ?? self::DEFAULT_THUMBNAIL_WIDTH ) ),
			'thumbnail_height'    => max( 0, (int) ( $raw['thumbnail_height'] ?? self::DEFAULT_THUMBNAIL_HEIGHT ) ),
			'thumbnail_crop'      => (bool) ( $raw['thumbnail_crop'] ?? self::DEFAULT_THUMBNAIL_CROP ),
			'thumbnail_alignment' => self::sanitize_alignment( (string) ( $raw['thumbnail_alignment'] ?? self::DEFAULT_THUMBNAIL_ALIGNMENT ) ),
			'full_width'          => max( 1, (int) ( $raw['full_width'] ?? self::DEFAULT_FULL_WIDTH ) ),
			'full_height'         => max( 0, (int) ( $raw['full_height'] ?? self::DEFAULT_FULL_HEIGHT ) ),
			'full_crop'           => false,  // full size is never cropped; ignore input
			'masonry_width'       => max( 1, (int) ( $raw['masonry_width'] ?? self::DEFAULT_MASONRY_WIDTH ) ),
			'justified_height'    => max( 1, (int) ( $raw['justified_height'] ?? self::DEFAULT_JUSTIFIED_HEIGHT ) ),
		);

		update_option( self::OPT_PLUGIN_SIZES, $settings, false );

		// Re-register so the new sizes are available within the current request.
		self::add_image_sizes();

		return $settings;
	}

	/**
	 * Default plugin-wide size settings.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	public static function get_plugin_size_defaults(): array {
		return array(
			'thumbnail_width'     => self::DEFAULT_THUMBNAIL_WIDTH,
			'thumbnail_height'    => self::DEFAULT_THUMBNAIL_HEIGHT,
			'thumbnail_crop'      => self::DEFAULT_THUMBNAIL_CROP,
			'thumbnail_alignment' => self::DEFAULT_THUMBNAIL_ALIGNMENT,
			'full_width'          => self::DEFAULT_FULL_WIDTH,
			'full_height'         => self::DEFAULT_FULL_HEIGHT,
			'full_crop'           => self::DEFAULT_FULL_CROP,
			'masonry_width'       => self::DEFAULT_MASONRY_WIDTH,
			'justified_height'    => self::DEFAULT_JUSTIFIED_HEIGHT,
		);
	}

	/**
	 * Return custom sizes from the registry, optionally including hidden ones.
	 *
	 * @since  1.0.0
	 * @param  bool $include_hidden  Whether to include fotogrids_full_mobile.
	 * @return array<string, array<string, mixed>>  slug → config
	 */
	public static function get_custom_sizes( bool $include_hidden = false ): array {
		$registry = get_option( self::OPT_CUSTOM_SIZES, array() );
		if ( ! is_array( $registry ) ) {
			return array();
		}

		if ( ! $include_hidden ) {
			// Drop the hidden full-mobile companion if it is present.
			unset( $registry[ self::SLUG_FULL_MOBILE ] );
		}

		return $registry;
	}

	/**
	 * Build the WP crop parameter (bool or array) from crop flag + alignment string.
	 *
	 * WP accepts:
	 *   - false               → proportional resize
	 *   - true                → center-center crop
	 *   - ['left','top']      → positional crop
	 *
	 * FotoGrids alignment values: 'center', 'top', 'bottom', 'left', 'right',
	 * 'top-left', 'top-right', 'bottom-left', 'bottom-right'.
	 *
	 * @since  1.0.0
	 * @param  bool   $crop
	 * @param  string $alignment
	 * @return bool|array{string, string}
	 */
	public static function build_crop_param( bool $crop, string $alignment ) {
		if ( ! $crop ) {
			return false;
		}

		$map = array(
			'center'       => array( 'center', 'center' ),
			'top'          => array( 'center', 'top' ),
			'bottom'       => array( 'center', 'bottom' ),
			'left'         => array( 'left', 'center' ),
			'right'        => array( 'right', 'center' ),
			'top-left'     => array( 'left', 'top' ),
			'top-right'    => array( 'right', 'top' ),
			'bottom-left'  => array( 'left', 'bottom' ),
			'bottom-right' => array( 'right', 'bottom' ),
		);

		return $map[ $alignment ] ?? array( 'center', 'center' );
	}

	/**
	 * Sanitise an alignment string against the allowed set.
	 *
	 * @since  1.0.0
	 * @param  string $alignment
	 * @return string
	 */
	private static function sanitize_alignment( string $alignment ): string {
		$allowed = array(
			'center',
			'top',
			'bottom',
			'left',
			'right',
			'top-left',
			'top-right',
			'bottom-left',
			'bottom-right',
		);
		return in_array( $alignment, $allowed, true ) ? $alignment : 'center';
	}
}
