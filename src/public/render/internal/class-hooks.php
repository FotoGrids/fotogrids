<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Helper for render hook variants and firing order.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Hooks {

	/**
	 * Fires an action with flat, type, and scoped variants.
	 *
	 * @since   1.0.0
	 * @param   string         $hook_name Hook suffix.
	 * @param   Render_Context $render Render context.
	 * @param   mixed          ...$extra Additional arguments.
	 * @return  void
	 */
	public static function fire_action( string $hook_name, Render_Context $render, mixed ...$extra ): void {
		[ $collection_type, $collection_id ] = self::collection_scope( $render );
		$hook_arguments                      = array_merge( $extra, array( $render ) );

		do_action( 'fotogrids/render/' . $hook_name, ...$hook_arguments );
		do_action( 'fotogrids/render/' . $hook_name . '/' . $collection_type, ...$hook_arguments );
		do_action( 'fotogrids/render/' . $hook_name . '/' . $collection_type . '/' . $collection_id, ...$hook_arguments );
	}

	/**
	 * Applies a filter with flat, type, and scoped variants.
	 *
	 * @since   1.0.0
	 * @param   string         $hook_name Hook suffix.
	 * @param   mixed          $value Filter value.
	 * @param   Render_Context $render Render context.
	 * @return  mixed
	 */
	public static function apply_filter( string $hook_name, mixed $value, Render_Context $render ): mixed {
		[ $collection_type, $collection_id ] = self::collection_scope( $render );

		$value = apply_filters( 'fotogrids/render/' . $hook_name, $value, $render );
		$value = apply_filters( 'fotogrids/render/' . $hook_name . '/' . $collection_type, $value, $render );
		$value = apply_filters( 'fotogrids/render/' . $hook_name . '/' . $collection_type . '/' . $collection_id, $value, $render );

		return $value;
	}

	/**
	 * Resolves scoped collection type and ID values.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render Render context.
	 * @return  array{0: 'gallery'|'album', 1: int}
	 */
	private static function collection_scope( Render_Context $render ): array {
		$is_album_context = Request_Source::ALBUM_AJAX === $render->meta->source && null !== $render->meta->album_id;

		if ( $is_album_context ) {
			return array( 'album', $render->meta->album_id );
		}

		return array( 'gallery', $render->meta->gallery_id );
	}
}
