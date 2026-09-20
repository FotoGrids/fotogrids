<?php
/**
 * Seeds a newly created collection from the site-wide defaults option.
 *
 * @package FotoGrids\Settings
 * @since   1.1.3
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Collection_Defaults_Seeder
 *
 * Copies the settings saved on Settings -> Defaults into a gallery's or
 * album's own post meta at the moment the post is created, so the collection
 * owns its values from the start and the editor opens showing them.
 *
 * A default applies only to collections created after it was saved: editing a
 * default never reaches a collection that already exists.
 *
 * @package FotoGrids\Settings
 * @since   1.1.3
 */
final class Collection_Defaults_Seeder {

	const OPTION = 'fotogrids_gallery_defaults';

	/**
	 * Register the creation hook.
	 *
	 * @since  1.1.3
	 * @return void
	 */
	public static function init(): void {
		add_action( 'wp_insert_post', array( __CLASS__, 'on_insert_post' ), 10, 3 );
	}

	/**
	 * Seed a collection when, and only when, its post is first created.
	 *
	 * @since  1.1.3
	 * @param  int      $post_id Post ID.
	 * @param  \WP_Post $post    Post object.
	 * @param  bool     $update  True when an existing post was updated.
	 * @return void
	 */
	public static function on_insert_post( $post_id, $post, $update ): void {
		if ( $update ) {
			return;
		}

		if ( ! in_array( $post->post_type, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
			return;
		}

		self::seed( (int) $post_id, $post->post_type );
	}

	/**
	 * Write the saved defaults into a collection's post meta.
	 *
	 * Keys absent from the collection type's resolved defaults are skipped, as
	 * is any key the collection already carries, so a caller that creates a
	 * post with settings of its own keeps them.
	 *
	 * @since  1.1.3
	 * @param  int    $post_id   Collection post ID.
	 * @param  string $post_type Collection post type.
	 * @return void
	 */
	public static function seed( int $post_id, string $post_type ): void {
		$saved = get_option( self::OPTION, array() );

		if ( ! is_array( $saved ) || array() === $saved ) {
			return;
		}

		$defaults = 'fotogrids_album' === $post_type
			? \FotoGrids\Collection_Defaults::resolve_album()
			: \FotoGrids\Collection_Defaults::resolve_gallery();

		$protect_on = ! empty( $saved['password_protect'] ) && '0' !== $saved['password_protect'];

		foreach ( $saved as $key => $value ) {
			if ( ! array_key_exists( $key, $defaults ) ) {
				continue;
			}

			// A stored password outlives the protection toggle, matching the
			// per-collection field. Seeding it while protection is off would
			// give a new collection a password its owner never set.
			if ( ! $protect_on && 'password_input' === Setting_Value_Codec::catalog_field_type( $key ) ) {
				continue;
			}

			$meta_key = 'fotogrids_' . $key;

			if ( '' !== get_post_meta( $post_id, $meta_key, true ) ) {
				continue;
			}

			$stored = self::encode( $key, $value, $defaults[ $key ] );

			if ( null === $stored ) {
				continue;
			}

			update_post_meta( $post_id, $meta_key, $stored );
		}
	}

	/**
	 * Convert a saved default into the shape post meta stores.
	 *
	 * Mirrors `Setting_Value_Codec::persist()` so a seeded collection is
	 * indistinguishable from one the user saved by hand. Returns null for a
	 * value that must not be written.
	 *
	 * @since  1.1.3
	 * @param  string $key           Setting key.
	 * @param  mixed  $value         Saved default value.
	 * @param  mixed  $default_value Resolved default - drives serialisation.
	 * @return string|null
	 */
	private static function encode( string $key, $value, $default_value ): ?string {
		if ( is_array( $default_value ) ) {
			return is_array( $value ) ? (string) wp_json_encode( $value ) : null;
		}

		if ( is_bool( $default_value ) ) {
			return ( true === $value || '1' === $value || 1 === $value || 'true' === $value ) ? '1' : '0';
		}

		if ( is_numeric( $default_value ) ) {
			return is_numeric( $value ) ? (string) $value : null;
		}

		if ( 'password_input' === Setting_Value_Codec::catalog_field_type( $key ) ) {
			$stored = is_scalar( $value ) ? (string) $value : '';

			// Only ciphertext is seeded. A plaintext row predates encryption on
			// this path and copying it would carry the exposure into the
			// collection.
			return \FotoGrids\Password_Crypto::is_encrypted( $stored ) ? $stored : null;
		}

		return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : null;
	}
}
