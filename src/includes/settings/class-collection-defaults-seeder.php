<?php
/**
 * Seeds a newly created collection from the site-wide defaults option.
 *
 * @package FotoGrids\Settings
 * @since   1.1.3
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Hooks\Filters_Settings;

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
 * default never reaches a collection that already exists. Values are written
 * through `Setting_Value_Codec::persist()`, the same path a hand-saved setting
 * takes. Rules that belong to one feature hook `Filters_Settings::DEFAULTS_SEED`.
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

		$values = (array) apply_filters(
			Filters_Settings::DEFAULTS_SEED,
			array_intersect_key( $saved, $defaults ),
			$post_id,
			$post_type
		);

		foreach ( $values as $key => $value ) {
			if ( ! array_key_exists( $key, $defaults ) ) {
				continue;
			}

			$meta_key = 'fotogrids_' . $key;

			if ( '' !== get_post_meta( $post_id, $meta_key, true ) ) {
				continue;
			}

			Setting_Value_Codec::persist(
				$post_id,
				$meta_key,
				$value,
				$defaults[ $key ],
				Setting_Value_Codec::catalog_field_type( (string) $key )
			);
		}
	}
}
