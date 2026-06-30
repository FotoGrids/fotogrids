<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Direct_Link;

use FotoGrids\Hooks\Filters_Render;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Item_Wrapper;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Internal\Hooks;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Wraps each gallery item (media + caption) in a direct link to the full-size image.
 *
 * Active when click_behavior === 'direct'. Each item gets a plain <a> whose href
 * points to the full-size attachment URL, wrapping both the media block and the
 * caption so the entire item surface is clickable. No lightbox trigger attributes
 * are added - the link navigates the browser to the image file directly.
 *
 * The gallery wrapper also receives data-fg-click="direct" (via wrapper_data_attrs)
 * so CSS cursor rules and any future JS hooks can target this mode.
 *
 * @package FotoGrids\Render\Decorators\Direct_Link
 * @since   1.0.0
 */
final class Direct_Link_Decorator implements Decorator {

	public function id(): string {
		return 'fotogrids/direct-link';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	public function supports( Render_Context $render_context ): bool {
		// Direct-to-image is an attachment-only click behaviour; albums
		// use Album_To_View_Page / Album_To_Gallery_Ajax instead.
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		return 'direct' === $render_context->behavior->click_behavior;
	}

	/**
	 * Adds an <a> figure_wrapper around each item's full contents (media + caption)
	 * that links directly to the full-size image file.
	 *
	 * Uses figure_wrappers (not wrappers) so the anchor encloses both the
	 * fg-item-media block and the figcaption, making the entire item clickable.
	 *
	 * The wrapper carries:
	 *   - href: the full-size image URL (direct navigation target)
	 *   - data-fg-item-id: attachment ID for consistency with other decorators
	 *   - data-fg-direct: marker attribute (present = direct link mode)
	 *
	 * @since   1.0.0
	 * @param   array<int, Item_View> $collection_items Collection items.
	 * @param   Render_Context        $render_context   Render context.
	 * @return  array<int, Item_View>
	 */
	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		$decorated = array();

		foreach ( $collection_items as $item_view ) {
			$wrapper_attrs = array(
				'href'            => esc_url( $item_view->full_url ?: $item_view->thumb_url ),
				'data-fg-item-id' => (string) $item_view->id,
				'data-fg-direct'  => '',
			);

			$wrapper_attrs = (array) Hooks::apply_filter( Filters_Render::ANCHOR_ATTRS_SUFFIX, $wrapper_attrs, $render_context );

			$figure_wrapper = new Item_Wrapper(
				'a',
				$wrapper_attrs,
			);

			$decorated[] = $item_view->with(
				array(
					'figure_wrappers' => array_merge( $item_view->figure_wrappers, array( $figure_wrapper ) ),
				)
			);
		}

		return $decorated;
	}

	/**
	 * Writes data-fg-click="direct" on the gallery wrapper so CSS cursor rules
	 * and JS hooks can target this click mode.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array( 'data-fg-click' => 'direct' );
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}
}
