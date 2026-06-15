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
 * - Re-registers any gallery-custom sizes (fotogrids_custom_*) stored in the
 *   fotogrids_custom_sizes option, so they survive page loads.
 * - Resolves a setting value (e.g. 'fotogrids_thumbnail', 'custom', 'large')
 *   to a WP size string that actually exists for a given attachment, with a
 *   graceful fallback chain.
 * - Computes deterministic slugs for gallery-custom sizes and persists them.
 *
 * @package FotoGrids
 * @since   1.0.0
 */
final class Image_Size_Manager {

	// -------------------------------------------------------------------------
	// Plugin-managed size slugs
	// -------------------------------------------------------------------------

	public const SLUG_THUMBNAIL     = 'fotogrids_thumbnail';
	public const SLUG_FULL          = 'fotogrids_full';
	public const SLUG_FULL_MOBILE   = 'fotogrids_full_mobile';  // hidden companion
	public const SLUG_MASONRY       = 'fotogrids_masonry';      // fixed width, variable height
	public const SLUG_JUSTIFIED     = 'fotogrids_justified';    // fixed height, variable width
	public const CUSTOM_SLUG_PREFIX = 'fotogrids_custom_';

	// Option keys
	private const OPT_PLUGIN_SIZES = 'fotogrids_media_settings';
	private const OPT_CUSTOM_SIZES = 'fotogrids_custom_sizes';

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
	 * The actual add_image_size() calls must happen on or after 'init', so we
	 * schedule them there.
	 *
	 * @since 1.0.0
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'add_image_sizes' ), 1 );
	}

	// -------------------------------------------------------------------------
	// Image size registration
	// -------------------------------------------------------------------------

	/**
	 * Register all FotoGrids image sizes with WordPress.
	 *
	 * Called on the `init` action (priority 1, before most other code).
	 *
	 * @since 1.0.0
	 */
	public static function add_image_sizes(): void {
		$settings = self::get_plugin_size_settings();

		// fotogrids_thumbnail
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

		// fotogrids_full
		add_image_size(
			self::SLUG_FULL,
			(int) $settings['full_width'],
			(int) $settings['full_height'],
			false  // full size is never cropped
		);

		// fotogrids_full_mobile - hidden companion, always half fotogrids_full width
		$mobile_width = max( 1, (int) floor( $settings['full_width'] / 2 ) );
		add_image_size(
			self::SLUG_FULL_MOBILE,
			$mobile_width,
			0,     // proportional height
			false
		);

		// fotogrids_masonry - fixed width, variable height (used by the Masonry layout)
		add_image_size(
			self::SLUG_MASONRY,
			max( 1, (int) $settings['masonry_width'] ),
			0,     // 0 = proportional height (variable)
			false  // never cropped - the layout decides
		);

		// fotogrids_justified - fixed height, variable width (used by the Justified layout)
		add_image_size(
			self::SLUG_JUSTIFIED,
			0,     // 0 = proportional width (variable)
			max( 1, (int) $settings['justified_height'] ),
			false  // never cropped - the layout decides
		);

		// Re-register any gallery-custom sizes from the persistent registry
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

	// -------------------------------------------------------------------------
	// Size resolution (used at render time)
	// -------------------------------------------------------------------------

	/**
	 * Resolve a setting value to a WP size slug that exists for the given attachment.
	 *
	 * For 'custom', the caller must first ensure the custom size is registered via
	 * register_custom_size() and pass the resulting slug as $custom_slug.
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
		// Build the candidate chain for this setting value + role
		$candidates = self::build_candidate_chain( $setting_value, $role, $custom_slug );

		foreach ( $candidates as $candidate ) {
			if ( 'full' === $candidate ) {
				return 'full'; // 'full' always exists (it's the original upload)
			}

			if ( self::size_exists_for_attachment( $attachment_id, $candidate ) ) {
				return $candidate;
			}
		}

		return 'full'; // ultimate fallback
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

		// Any other named WP size: try it directly, then fall back by role
		$fallback = 'full' === $role ? self::FALLBACK_FULL : self::FALLBACK_THUMBNAIL;
		// Insert the specific value at the front if it's not already in the chain
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

	// -------------------------------------------------------------------------
	// Custom size registration
	// -------------------------------------------------------------------------

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
	 * Register a gallery-custom size with WP and persist it to the custom size registry.
	 *
	 * Safe to call multiple times with the same parameters - add_image_size() is
	 * idempotent and save_custom_size_registry() deduplicates.
	 *
	 * @since  1.0.0
	 * @param  int    $width
	 * @param  int    $height
	 * @param  bool   $crop
	 * @param  string $alignment  e.g. 'center', 'top-left', 'bottom-right'
	 * @param  int    $gallery_id The gallery post ID that defined this custom size.
	 * @return string The computed slug.
	 */
	public static function register_custom_size(
		int $width,
		int $height,
		bool $crop,
		string $alignment = 'center',
		int $gallery_id = 0
	): string {
		$slug       = self::compute_custom_slug( $width, $height, $crop );
		$crop_param = self::build_crop_param( $crop, $alignment );

		// Register with WordPress (safe to call even if already registered)
		add_image_size( $slug, $width, $height, $crop_param );

		// Persist to the registry option
		self::save_custom_size_registry(
			$slug,
			array(
				'width'     => $width,
				'height'    => $height,
				'crop'      => $crop,
				'alignment' => $alignment,
			),
			$gallery_id
		);

		return $slug;
	}

	/**
	 * Persist a custom size entry to the fotogrids_custom_sizes option.
	 *
	 * @since  1.0.0
	 * @param  string $slug
	 * @param  array{width: int, height: int, crop: bool, alignment: string} $config
	 * @param  int    $gallery_id  Gallery post ID that uses this size. 0 = no association.
	 */
	public static function save_custom_size_registry( string $slug, array $config, int $gallery_id = 0 ): void {
		$registry = get_option( self::OPT_CUSTOM_SIZES, array() );
		if ( ! is_array( $registry ) ) {
			$registry = array();
		}

		$existing    = $registry[ $slug ] ?? array();
		$gallery_ids = $existing['gallery_ids'] ?? array();

		if ( $gallery_id > 0 && ! in_array( $gallery_id, $gallery_ids, true ) ) {
			$gallery_ids[] = $gallery_id;
		}

		$registry[ $slug ] = array_merge( $config, array( 'gallery_ids' => $gallery_ids ) );

		update_option( self::OPT_CUSTOM_SIZES, $registry, false );
	}

	/**
	 * Remove a gallery's association from all custom sizes it contributed.
	 *
	 * When a gallery is deleted, call this to clean up stale gallery_ids
	 * references. Sizes with no remaining gallery_ids are removed from the
	 * registry (derivatives on disk are left untouched).
	 *
	 * @since  1.0.0
	 * @param  int $gallery_id
	 */
	public static function remove_gallery_from_custom_sizes( int $gallery_id ): void {
		$registry = get_option( self::OPT_CUSTOM_SIZES, array() );
		if ( ! is_array( $registry ) || empty( $registry ) ) {
			return;
		}

		$updated = false;
		foreach ( $registry as $slug => $config ) {
			$gallery_ids = $config['gallery_ids'] ?? array();
			$new_ids     = array_values( array_filter( $gallery_ids, fn( $id ) => $id !== $gallery_id ) );

			if ( count( $new_ids ) !== count( $gallery_ids ) ) {
				$updated = true;
				if ( empty( $new_ids ) ) {
					unset( $registry[ $slug ] );
				} else {
					$registry[ $slug ]['gallery_ids'] = $new_ids;
				}
			}
		}

		if ( $updated ) {
			update_option( self::OPT_CUSTOM_SIZES, $registry, false );
		}
	}

	// -------------------------------------------------------------------------
	// Plugin-wide size settings
	// -------------------------------------------------------------------------

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

		// Re-register sizes immediately so they're available for the current request
		// (WP image size registration is idempotent within a request)
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
			// The hidden companion is not in the custom registry, but filter
			// any future hidden sizes here if needed.
			unset( $registry[ self::SLUG_FULL_MOBILE ] );
		}

		return $registry;
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

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
	public static function build_crop_param( bool $crop, string $alignment ): bool|array {
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
