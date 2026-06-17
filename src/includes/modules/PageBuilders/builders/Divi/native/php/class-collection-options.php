<?php
/**
 * Native Divi 5 - shared collection-options helper.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Divi\Native
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Divi\Native;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Builds the `value => label` option map injected into the native
 * `divi/select` field at module-registration time.
 *
 * The select's `props.options` in `module.json` ships empty (`{}`); we
 * populate it server-side by overriding `attributes` in
 * `ModuleRegistration::register_module()`'s `$args` (which win the merge
 * over the JSON metadata). This is the supported, decoupled way to feed a
 * dynamic option list without depending on Divi's internal field-options
 * JS API.
 *
 * @since 1.0.0
 */
final class Collection_Options {

	/**
	 * Build the option map for a collection kind.
	 *
	 * Lists published + private collections, ordered by title, with a
	 * leading empty "none" entry. Non-published entries carry a status
	 * suffix so the editor isn't surprised when a draft renders empty on
	 * the live page.
	 *
	 * Divi's `divi/select` field expects options as a map of
	 * `value => array{ label: string }` - NOT a flat `value => label`
	 * map. Each option value points to an object with a `label` key.
	 *
	 * @since 1.0.0
	 * @param 'gallery'|'album' $kind Collection kind.
	 * @return array<string,array{label:string}>
	 */
	public static function map( string $kind ): array {
		$post_type = 'album' === $kind ? 'fotogrids_album' : 'fotogrids_gallery';

		$posts = get_posts(
			array(
				'post_type'        => $post_type,
				// Include non-published collections too - an editor placing
				// a module may reference a draft/scheduled gallery they're
				// still preparing. Non-published entries carry a status
				// suffix below so it's clear they won't render on the live
				// page until published.
				'post_status'      => array( 'publish', 'private', 'draft', 'pending', 'future' ),
				'numberposts'      => -1,
				'orderby'          => 'title',
				'order'            => 'ASC',
				'suppress_filters' => false,
			)
		);

		$options = array(
			'' => array(
				'label' => 'album' === $kind
					? esc_html__( '- Select an album -', 'fotogrids' )
					: esc_html__( '- Select a gallery -', 'fotogrids' ),
			),
		);

		foreach ( $posts as $post ) {
			$title = '' !== $post->post_title
				? $post->post_title
				/* translators: %d: collection post ID. */
				: sprintf( esc_html__( '(no title) #%d', 'fotogrids' ), (int) $post->ID );

			if ( 'publish' !== $post->post_status ) {
				$obj = get_post_status_object( $post->post_status );
				$lbl = ( $obj && ! empty( $obj->label ) ) ? $obj->label : $post->post_status;
				/* translators: %s: post status label. */
				$title .= ' ' . sprintf( esc_html__( '(%s)', 'fotogrids' ), $lbl );
			}

			$options[ (string) $post->ID ] = array( 'label' => $title );
		}

		return $options;
	}

	/**
	 * Decode a module's `module.json` and inject the option map into its
	 * select field, returning an `attributes` array suitable for passing
	 * as the `attributes` override in `register_module()`'s `$args`.
	 *
	 * The select field lives at (single `group-item` structure):
	 *   attributes.<attrKey>.settings.innerContent.item.component.props.options
	 *
	 * @since 1.0.0
	 * @param string $json_file Absolute path to the module's module.json.
	 * @param string $attr_key  Top-level attribute key ('gallery'|'album').
	 * @param string $item_key  Unused (kept for call-site signature stability).
	 * @param string $kind      Collection kind for the option map.
	 * @return array<string,mixed> The `attributes` array, or empty on failure.
	 */
	public static function attributes_with_options( string $json_file, string $attr_key, string $item_key, string $kind ): array {
		if ( ! is_readable( $json_file ) ) {
			return array();
		}

		$metadata = json_decode( (string) file_get_contents( $json_file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled local plugin file (not a remote URL); WP_Filesystem is unnecessary here.
		if ( ! is_array( $metadata ) || empty( $metadata['attributes'] ) ) {
			return array();
		}

		$attributes = $metadata['attributes'];

		if ( isset( $attributes[ $attr_key ]['settings']['innerContent']['item']['component']['props'] ) ) {
			$attributes[ $attr_key ]['settings']['innerContent']['item']['component']['props']['options']
				= self::map( $kind );
		}

		return $attributes;
	}
}
