<?php
/**
 * Permission gate - splits save payloads by the content/settings classifier.
 *
 * @package FotoGrids\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Permissions;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Save-boundary gate. One call per save:
 *
 *   [ $allowed, $skipped ] = Permission_Gate::split_payload(
 *       $payload, $post_id, $post_type
 *   );
 *
 *   // Persist $allowed; return $skipped to the client in
 *   // 'skipped_for_permissions' so the UI can toast.
 *
 * The classifier (Permission_Registry::classify_key) decides per key whether
 * it's content or settings. Content keys stay in $allowed when the user has
 * native edit_post on the gallery / album. Settings keys stay in $allowed
 * only when the user also has modify_fotogrids_{gallery|album}_settings on
 * the same post.
 *
 * Option A behaviour: keys the user can't write are dropped silently rather
 * than failing the whole request. The caller surfaces the skipped list.
 *
 * @since 1.0.0
 */
final class Permission_Gate {

	/**
	 * Atomic settings cap for galleries.
	 */
	public const CAP_GALLERY_SETTINGS = 'modify_fotogrids_gallery_settings';

	/**
	 * Atomic settings cap for albums.
	 */
	public const CAP_ALBUM_SETTINGS = 'modify_fotogrids_album_settings';

	/**
	 * Split a save payload by content/settings classification.
	 *
	 * @param array<string, mixed> $payload   Incoming payload (key => value).
	 * @param int                  $post_id   Post being saved (0 for create).
	 * @param string               $post_type 'fotogrids_gallery' | 'fotogrids_album'.
	 * @return array{0: array<string, mixed>, 1: string[]} [ allowed, skipped ]
	 */
	public static function split_payload( array $payload, int $post_id, string $post_type ): array {
		$settings_cap = self::settings_cap_for( $post_type );
		if ( null === $settings_cap ) {
			// Unknown post type - pass the payload through untouched so this
			// gate never silently corrupts a non-FotoGrids save.
			return array( $payload, array() );
		}

		$can_settings = $post_id > 0
			? Permission_Check::can( $settings_cap, $post_id )
			: Permission_Check::can( $settings_cap );

		if ( $can_settings ) {
			// Fast path - user can write everything.
			return array( $payload, array() );
		}

		$allowed = array();
		$skipped = array();
		foreach ( $payload as $key => $value ) {
			$bucket = Permission_Registry::classify_key( (string) $key, $post_type );
			if ( 'settings' === $bucket ) {
				$skipped[] = (string) $key;
			} else {
				$allowed[ $key ] = $value;
			}
		}

		return array( $allowed, $skipped );
	}

	/**
	 * Return the atomic settings cap for a FotoGrids CPT, or null if the
	 * post type is not a FotoGrids CPT.
	 *
	 * @param string $post_type
	 * @return string|null
	 */
	public static function settings_cap_for( string $post_type ): ?string {
		switch ( $post_type ) {
			case 'fotogrids_gallery':
				return self::CAP_GALLERY_SETTINGS;
			case 'fotogrids_album':
				return self::CAP_ALBUM_SETTINGS;
			default:
				return null;
		}
	}
}
