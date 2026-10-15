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
	 * Saved `fotogrids_<key>` meta replaces each default; JSON arrays merge into
	 * associative-array defaults. Adds `_password_encrypted` and blanks `password`.
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
					$settings[ $key ] = is_array( $default_value ) && ! wp_is_numeric_array( $default_value )
						? array_merge( $default_value, $decoded )
						: $decoded;
				} else {
					$settings[ $key ] = $saved_value;
				}
			} else {
				$settings[ $key ] = $saved_value;
			}
		}

		$settings['_password_encrypted'] = (string) get_post_meta( $album_id, 'fotogrids_password', true );
		$settings['password']            = '';

		return $settings;
	}
}
