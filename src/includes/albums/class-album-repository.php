<?php
/**
 * Read-side repository for FotoGrids albums.
 *
 * @package FotoGrids\Albums
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Albums;

use FotoGrids\Collection_Defaults;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Reads albums and their resolved settings.
 *
 * Validates the post-type guard so callers never have to repeat the
 * `$post->post_type === 'fotogrids_album'` check.
 *
 * @since 1.0.0
 */
final class Album_Repository {

	/**
	 * Get an album post by ID, with post-type validation.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album post ID.
	 * @return \WP_Post|null Album post, or null when not found / wrong type.
	 */
	public static function get( int $album_id ): ?\WP_Post {
		$album = get_post( $album_id );

		if ( ! $album || 'fotogrids_album' !== $album->post_type ) {
			return null;
		}

		return $album;
	}

	/**
	 * Get an album's resolved settings (defaults merged with saved post meta).
	 *
	 * Each per-setting post-meta value is read by key
	 * (`fotogrids_<setting_key>`). Strings that decode as JSON arrays are
	 * merged into the default; everything else replaces the default.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album post ID.
	 * @return array<string, mixed> Album settings.
	 */
	public static function get_settings( int $album_id ): array {
		$defaults = Collection_Defaults::resolve_album();
		$settings = $defaults;

		foreach ( $defaults as $key => $default_value ) {
			$saved_value = get_post_meta( $album_id, 'fotogrids_' . $key, true );

			if ( '' === $saved_value ) {
				continue;
			}

			if ( is_string( $saved_value ) ) {
				$decoded = json_decode( $saved_value, true );
				if ( is_array( $decoded ) ) {
					$settings[ $key ] = is_array( $default_value )
						? array_merge( $default_value, $decoded )
						: $decoded;
				} else {
					$settings[ $key ] = $saved_value;
				}
			} else {
				$settings[ $key ] = $saved_value;
			}
		}

		return $settings;
	}
}
