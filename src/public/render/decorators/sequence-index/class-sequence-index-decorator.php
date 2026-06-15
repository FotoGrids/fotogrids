<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Sequence_Index;

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Internal\Gallery_Item_Sequence;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Sequence-index decorator.
 *
 * Stamps `data-fg-sequence-index` on every gallery item, giving each
 * visible `.fg-item` its position within the FULL filtered+sorted
 * sequence — not its position on the current page.
 *
 * Consumed by the lightbox: when a user clicks an item, the lightbox
 * reads `dataset.fgSequenceIndex` to know which slide of the gallery
 * to open at. Without this attribute the lightbox would think the
 * clicked item is "item #2 of the visible 8", when really it might be
 * "item #18 of the filtered 49".
 *
 * Always active for galleries (skipped for albums — sequence indices
 * for albums-of-galleries aren't well-defined here).
 *
 * @package FotoGrids\Render\Decorators\Sequence_Index
 * @since   1.0.0
 */
final class Sequence_Index_Decorator implements Decorator {

	public function id(): string {
		return 'fotogrids/decorator/sequence-index';
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
		return Collection_Kind::GALLERY === $render_context->meta->collection_kind;
	}

	/**
	 * Stamps data-fg-sequence-index on each item with its position in
	 * the full filtered+sorted sequence for this gallery.
	 *
	 * @since 1.0.0
	 * @param array<int, Item_View> $collection_items
	 * @return array<int, Item_View>
	 */
	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		if ( empty( $collection_items ) ) {
			return $collection_items;
		}

		$sequence = Gallery_Item_Sequence::resolve(
			(int) $render_context->meta->gallery_id,
			$render_context->settings,
			$render_context->meta->random_seed,
			$render_context->meta->active_filters
		);

		if ( empty( $sequence ) ) {
			return $collection_items;
		}

		// Build a flipped lookup so the per-item search is O(1).
		$index_by_id = array_flip( $sequence );

		return array_map(
			static function ( Item_View $item ) use ( $index_by_id ): Item_View {
				$index = $index_by_id[ $item->id ] ?? null;
				if ( null === $index ) {
					// Item isn't in the filtered sequence (shouldn't
					// happen — filtering ran upstream in Context_Builder
					// — but be defensive).
					return $item;
				}
				return $item->with(
					array(
						'data_attrs' => array_merge(
							$item->data_attrs,
							array( 'data-fg-sequence-index' => (string) $index )
						),
					)
				);
			},
			$collection_items
		);
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
