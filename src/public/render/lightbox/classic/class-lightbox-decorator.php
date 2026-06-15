<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Classic;

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
 * Wraps each gallery item's media in a lightbox trigger anchor.
 *
 * When click_behavior is 'lightbox', every item gets an <a> wrapper with
 * data-fg-lightbox-trigger and href pointing to the full-size image. The
 * lightbox JS uses event delegation on [data-fg-lightbox-trigger] so no
 * per-item JS handlers are needed.
 *
 * @package FotoGrids\Render\Lightbox\Classic
 * @since   1.0.0
 */
final class Lightbox_Decorator implements Decorator {

	public function id(): string {
		return 'fotogrids/lightbox-trigger';
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
		// The lightbox is for opening individual attachments — it never
		// applies to album-as-collection renders, whose items ARE
		// galleries (and therefore have their own click-behaviour
		// decorator, e.g. Album_To_View_Page or Album_To_Gallery_Ajax).
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		return 'lightbox' === $render_context->behavior->click_behavior;
	}

	/**
	 * Adds an <a data-fg-lightbox-trigger> wrapper around each item's media.
	 *
	 * The wrapper carries:
	 *   - href: the full-size image URL (real navigation target if JS fails)
	 *   - data-fg-lightbox-trigger: marker attribute the JS delegates on
	 *   - data-fg-caption: caption text for the lightbox panel (not shown in gallery)
	 *   - data-fg-title: title for the lightbox panel
	 *
	 * @since   1.0.0
	 * @param   array<int, Item_View> $collection_items Collection items.
	 * @param   Render_Context        $render_context   Render context.
	 * @return  array<int, Item_View>
	 */
	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		$decorated = array();

		$inline_video_playback =
			( $render_context->settings['video_playback_mode'] ?? 'inline' ) === 'inline';

		foreach ( $collection_items as $item_view ) {
			// Video items set to inline playback are handled by the inline
			// module's own click handler, so they must not receive the lightbox
			// trigger wrapper (which would otherwise capture the click and open
			// the lightbox instead of playing in place).
			if ( $inline_video_playback
				&& \FotoGrids\Render\Video\Video_Item_Helpers::is_video( $item_view->item_type ) ) {
				$decorated[] = $item_view;
				continue;
			}

			$wrapper_attrs = array(
				'href'                     => esc_url( $item_view->full_url ?: $item_view->thumb_url ),
				'data-fg-lightbox-trigger' => '',
				'data-fg-item-id'          => (string) $item_view->id,
			);

			if ( '' !== $item_view->caption ) {
				$wrapper_attrs['data-fg-caption'] = esc_attr( $item_view->caption );
			}

			if ( '' !== $item_view->title ) {
				$wrapper_attrs['data-fg-title'] = esc_attr( $item_view->title );
			}

			$wrapper_attrs = (array) Hooks::apply_filter( Filters_Render::ANCHOR_ATTRS_SUFFIX, $wrapper_attrs, $render_context );

			$trigger_wrapper = new Item_Wrapper(
				tag:   'a',
				attrs: $wrapper_attrs,
			);

			$decorated[] = $item_view->with(
				array(
					'wrappers' => array_merge( $item_view->wrappers, array( $trigger_wrapper ) ),
				)
			);
		}

		return $decorated;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}
}
