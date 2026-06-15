<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\External_Link;

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
 * Wraps each gallery item (media + caption) in a link to its per-item external URL.
 *
 * Active when click_behavior === 'external'. Uses figure_wrappers so the <a>
 * encloses both the fg-item-media block and the figcaption, making the entire
 * item surface clickable.
 *
 * Items with no external_url set are left unwrapped - no dead anchor is emitted.
 *
 * Link target resolution (per-item link_target → resolved HTML target):
 *   'global'  → gallery setting external_link_target ('_self' | '_blank'), default '_blank'
 *   '_blank'  → '_blank'
 *   '_self'   → '_self'
 *   anything else → '_blank' (safe fallback)
 *
 * rel="noopener noreferrer" is added automatically when target resolves to '_blank'.
 *
 * The gallery wrapper receives data-fg-click="external" (via wrapper_data_attrs)
 * so CSS cursor rules and JS hooks can target this click mode.
 *
 * @package FotoGrids\Render\Decorators\External_Link
 * @since   1.0.0
 */
final class External_Link_Decorator implements Decorator {

	public function id(): string {
		return 'fotogrids/external-link';
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
		// External-link click behaviour is per-attachment; albums use
		// their own click-behaviour decorators.
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		return 'external' === $render_context->behavior->click_behavior;
	}

	/**
	 * Adds an <a> figure_wrapper around each item's full contents (media + caption)
	 * linking to its per-item external URL.
	 *
	 * Items whose external_url is empty are left unchanged - no wrapper is added,
	 * so no dead or misleading anchor appears on those items.
	 *
	 * @since   1.0.0
	 * @param   array<int, Item_View> $collection_items Collection items.
	 * @param   Render_Context        $render_context   Render context.
	 * @return  array<int, Item_View>
	 */
	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		$decorated      = array();
		$gallery_target = $this->gallery_default_target( $render_context );

		foreach ( $collection_items as $item_view ) {
			$external_url = (string) ( $item_view->meta['external_url'] ?? '' );

			// Skip items with no external URL - leave the item unwrapped.
			if ( '' === $external_url ) {
				$decorated[] = $item_view;
				continue;
			}

			$link_target = (string) ( $item_view->meta['link_target'] ?? 'global' );
			$target      = $this->resolve_target( $link_target, $gallery_target );

			$wrapper_attrs = array(
				'href'             => esc_url( $external_url ),
				'target'           => $target,
				'data-fg-item-id'  => (string) $item_view->id,
				'data-fg-external' => '',
			);

			// noopener noreferrer is required whenever opening in a new tab.
			if ( '_blank' === $target ) {
				$wrapper_attrs['rel'] = 'noopener noreferrer';
			}

			$wrapper_attrs = (array) Hooks::apply_filter( Filters_Render::ANCHOR_ATTRS_SUFFIX, $wrapper_attrs, $render_context );

			$figure_wrapper = new Item_Wrapper(
				tag:   'a',
				attrs: $wrapper_attrs,
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
	 * Writes data-fg-click="external" on the gallery wrapper so CSS cursor
	 * rules and JS hooks can target this click mode.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array( 'data-fg-click' => 'external' );
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Reads the gallery-level default link target from settings.
	 *
	 * Stored as external_link_target ('_self' | '_blank').
	 * Falls back to '_blank' when the setting is absent or unrecognised.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string '_blank' | '_self'
	 */
	private function gallery_default_target( Render_Context $render_context ): string {
		$setting = $render_context->settings['external_link_target'] ?? '';
		return '_self' === $setting ? '_self' : '_blank';
	}

	/**
	 * Resolves a per-item link_target value to a valid HTML target attribute.
	 *
	 * 'global' defers to the gallery-level default. Any unrecognised value
	 * falls back to '_blank'.
	 *
	 * @since   1.0.0
	 * @param   string $link_target    Raw value from item meta ('global' | '_blank' | '_self').
	 * @param   string $gallery_target Resolved gallery default ('_blank' | '_self').
	 * @return  string '_blank' | '_self'
	 */
	private function resolve_target( string $link_target, string $gallery_target ): string {
		if ( '_self' === $link_target ) {
			return '_self';
		}

		if ( '_blank' === $link_target ) {
			return '_blank';
		}

		// 'global' (and anything else) defers to the gallery-level default.
		return $gallery_target;
	}
}
