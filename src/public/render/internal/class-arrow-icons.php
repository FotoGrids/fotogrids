<?php
/**
 * Shared SVG arrow-icon loader for carousel-style layouts.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Internal;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Loads the arrow-icon SVG library shared by every layout that needs
 * prev/next chrome (lightbox, slider, image viewer). Reads from the
 * authoritative JSON file under lightbox/shared/ so a single edit
 * updates every consumer.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Arrow_Icons {

	/** @var array<string, array{prev: string, next: string}>|null */
	private static ?array $cache = null;

	/**
	 * Loads the full icon map. Cached per-request.
	 *
	 * @since 1.0.0
	 * @return array<string, array{prev: string, next: string}>
	 */
	public static function all(): array {
		if ( null !== self::$cache ) {
			return self::$cache;
		}

		$path = FOTOGRIDS_PLUGIN_DIR . 'public/render/lightbox/shared/arrow-icons.json';
		if ( file_exists( $path ) ) {
			$decoded = json_decode( (string) file_get_contents( $path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled local plugin file (not a remote URL); WP_Filesystem is unnecessary here.
			if ( is_array( $decoded ) ) {
				self::$cache = $decoded;
				return self::$cache;
			}
		}

		self::$cache = array(
			'chevron' => array(
				'prev' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
				'next' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			),
		);
		return self::$cache;
	}

	/**
	 * Returns the prev/next SVG pair for the requested icon name. Falls
	 * back to 'chevron' if the requested name is unknown.
	 *
	 * @since 1.0.0
	 * @param string $name
	 * @return array{prev: string, next: string}
	 */
	public static function pair( string $name ): array {
		$icons = self::all();
		if ( isset( $icons[ $name ] ) ) {
			return $icons[ $name ];
		}
		return $icons['chevron'] ?? array(
			'prev' => '&lsaquo;',
			'next' => '&rsaquo;',
		);
	}
}
