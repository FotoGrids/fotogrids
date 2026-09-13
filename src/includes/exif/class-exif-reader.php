<?php
/**
 * Reads the raw EXIF tag map for an attachment.
 *
 * @package FotoGrids\Exif
 * @since   1.2.0
 */

declare(strict_types=1);

namespace FotoGrids\Exif;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Source of raw EXIF tags for the field registry.
 *
 * `wp_read_image_metadata()` normalises EXIF down to thirteen keys and carries
 * no lens, flash, white balance, metering, exposure mode or GPS, so the tags
 * come from `exif_read_data()` directly. IPTC-derived values that only
 * WordPress resolves - credit and copyright - are merged in behind the EXIF
 * tags of the same meaning.
 *
 * @since 1.2.0
 */
final class Exif_Reader {

	/**
	 * Image types `exif_read_data()` can read.
	 *
	 * @since 1.2.0
	 */
	private const EXIF_IMAGE_TYPES = array( IMAGETYPE_JPEG, IMAGETYPE_TIFF_II, IMAGETYPE_TIFF_MM );

	/**
	 * EXIF sections to flatten, in precedence order.
	 *
	 * @since 1.2.0
	 */
	private const SECTIONS = array( 'IFD0', 'EXIF', 'GPS' );

	/**
	 * Raw tag maps already read this request, keyed by attachment ID.
	 *
	 * @since 1.2.0
	 * @var array<int, array<string, mixed>>
	 */
	private static $cache = array();

	/**
	 * The raw EXIF tag map for an attachment.
	 *
	 * @since  1.2.0
	 * @param  int $attachment_id Attachment ID.
	 * @return array<string, mixed> Empty when the file carries no readable metadata.
	 */
	public static function read( int $attachment_id ): array {
		if ( isset( self::$cache[ $attachment_id ] ) ) {
			return self::$cache[ $attachment_id ];
		}

		$file_path = self::resolve_path( $attachment_id );

		if ( '' === $file_path ) {
			self::$cache[ $attachment_id ] = array();
			return array();
		}

		$tags = self::merge_wp_metadata( self::read_raw_tags( $file_path ), $file_path );

		self::$cache[ $attachment_id ] = $tags;

		return $tags;
	}

	/**
	 * Forget cached tag maps.
	 *
	 * @since  1.2.0
	 * @param  int|null $attachment_id Attachment to forget, or null for all.
	 * @return void
	 */
	public static function flush_cache( ?int $attachment_id = null ): void {
		if ( null === $attachment_id ) {
			self::$cache = array();
			return;
		}

		unset( self::$cache[ $attachment_id ] );
	}

	/**
	 * The file to read metadata from.
	 *
	 * WordPress strips metadata from the `-scaled` file it generates for images
	 * above big_image_size_threshold, so the preserved original is preferred.
	 *
	 * @since  1.2.0
	 * @param  int $attachment_id Attachment ID.
	 * @return string Empty when no readable file exists.
	 */
	private static function resolve_path( int $attachment_id ): string {
		$file_path = wp_get_original_image_path( $attachment_id );

		if ( ! $file_path ) {
			$file_path = get_attached_file( $attachment_id );
		}

		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return '';
		}

		return (string) $file_path;
	}

	/**
	 * Flatten the EXIF sections of a file into a single tag map.
	 *
	 * @since  1.2.0
	 * @param  string $file_path Absolute path to the image.
	 * @return array<string, mixed>
	 */
	private static function read_raw_tags( string $file_path ): array {
		if ( ! is_callable( 'exif_read_data' ) ) {
			return array();
		}

		$image_size = wp_getimagesize( $file_path );

		if ( false === $image_size || ! isset( $image_size[2] ) ) {
			return array();
		}

		if ( ! in_array( (int) $image_size[2], self::EXIF_IMAGE_TYPES, true ) ) {
			return array();
		}

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$sections = exif_read_data( $file_path, null, true );
		} else {
			// Malformed EXIF in the wild emits notices for images that are otherwise fine.
			$sections = @exif_read_data( $file_path, null, true ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Matches core's own handling in wp_read_image_metadata(); see https://core.trac.wordpress.org/ticket/42480
		}

		if ( ! is_array( $sections ) ) {
			return array();
		}

		$tags = array();

		foreach ( self::SECTIONS as $section ) {
			if ( ! isset( $sections[ $section ] ) || ! is_array( $sections[ $section ] ) ) {
				continue;
			}

			foreach ( $sections[ $section ] as $tag => $value ) {
				if ( ! isset( $tags[ $tag ] ) ) {
					$tags[ $tag ] = $value;
				}
			}
		}

		return $tags;
	}

	/**
	 * Fill rights tags WordPress resolves from IPTC when EXIF has none.
	 *
	 * @since  1.2.0
	 * @param  array<string, mixed> $tags      Raw EXIF tags.
	 * @param  string               $file_path Absolute path to the image.
	 * @return array<string, mixed>
	 */
	private static function merge_wp_metadata( array $tags, string $file_path ): array {
		$has_artist    = ! empty( $tags['Artist'] );
		$has_copyright = ! empty( $tags['Copyright'] );

		if ( $has_artist && $has_copyright ) {
			return $tags;
		}

		$image_meta = wp_read_image_metadata( $file_path );

		if ( ! is_array( $image_meta ) ) {
			return $tags;
		}

		if ( ! $has_artist && ! empty( $image_meta['credit'] ) ) {
			$tags['Artist'] = $image_meta['credit'];
		}

		if ( ! $has_copyright && ! empty( $image_meta['copyright'] ) ) {
			$tags['Copyright'] = $image_meta['copyright'];
		}

		return $tags;
	}
}
