<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Grid;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Lightbox\Shared\Lightbox_Colors;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * LightboxGrid feature module.
 *
 * A distinct lightbox variant: instead of a slideshow (arrows / dots /
 * thumbnails / info panel), it shows ALL of the gallery's items in a
 * scrollable, Airbnb-style grid - one full-width image, then a row of two
 * side-by-side, repeating. Its only chrome is a toolbar: a Back/close
 * button on the inline-start side and a Share button (when sharing is
 * enabled) on the inline-end side.
 *
 * It is opened by the Featured Item layout's auto "Show all" button - it
 * never opens by clicking an item. Clicking an item INSIDE the grid runs
 * the gallery's own click behaviour (lightbox / link / etc.), the same as
 * clicking an item on the page.
 *
 * This feature is responsible for:
 *   1. Declaring the LightboxGrid JS + CSS assets (loaded only when active).
 *   2. Stamping the overlay config on the wrapper: the full item list
 *      (data-fg-grid-items), the lightbox colour palette (reused from the
 *      shared Lightbox_Colors helper so the chrome matches the gallery's
 *      lightbox theme), and the gallery's click behaviour so grid tiles
 *      can replay it.
 *
 * Activation is per-render: active only on Featured Item galleries that
 * have more items than the layout shows inline (so a Show all button is
 * present). Albums never use it.
 *
 * @package FotoGrids\Render\Lightbox\Grid
 * @since   1.0.0
 */
final class Lightbox_Grid implements Feature {

	public function id(): string {
		return 'fotogrids/lightbox-grid';
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

	/**
	 * Active on Featured Item gallery renders that overflow the inline
	 * display (featured image + grid count) and therefore show a Show all
	 * button. Albums never use the grid lightbox.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		if ( 'featured-item' !== $render_context->layout->layout_id ) {
			return false;
		}
		return self::should_show_all( $render_context );
	}

	/**
	 * Whether the gallery has more items than the Featured Item layout
	 * shows inline (1 featured + grid count). Shared with the layout so the
	 * button and the overlay agree.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public static function should_show_all( Render_Context $render_context ): bool {
		$grid_count = (int) ( $render_context->settings['featured_thumbs_count'] ?? 6 );
		$inline     = 1 + max( 0, $grid_count );
		return count( $render_context->items ) > $inline;
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Stamp the overlay config: item list, colour palette, share + click
	 * behaviour. The JS reads these from the gallery wrapper when the Show
	 * all button is activated.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$items = array();
		foreach ( $render_context->items as $item_view ) {
			$is_video = 'image' !== $item_view->item_type;
			$thumb    = $is_video && '' !== $item_view->poster_url
				? $item_view->poster_url
				: $item_view->thumb_url;

			$items[] = array(
				'id'      => $item_view->id,
				'full'    => '' !== $item_view->full_url ? $item_view->full_url : $item_view->thumb_url,
				'thumb'   => $thumb,
				'alt'     => $item_view->alt,
				'title'   => $item_view->title,
				'caption' => '' !== $item_view->caption_title ? $item_view->caption_title : $item_view->caption,
				'video'   => $is_video,
				'w'       => $item_view->full_width ?? $item_view->width,
				'h'       => $item_view->full_height ?? $item_view->height,
			);
		}

		$attrs = array(
			'data-fg-grid-items' => wp_json_encode( $items ),
			// The gallery's click behaviour, so grid tiles replay it.
			'data-fg-grid-click' => (string) $render_context->behavior->click_behavior,
		);

		// Reuse the lightbox colour palette for the overlay chrome so it
		// matches the gallery's lightbox theme. Only the toolbar / backdrop
		// colours are needed, but stamping the full set is cheap and keeps
		// the JS simple.
		$attrs = array_merge( $attrs, Lightbox_Colors::attrs( $render_context->settings ) );

		// Share config (only when sharing is enabled for the gallery). The
		// Sharing decorator already stamps data-fg-sharing on the wrapper
		// when sharing is on; the grid JS reads that same attribute, so we
		// don't duplicate it here - we only need to know whether to show the
		// toolbar share button, which the JS derives from data-fg-sharing.

		return $attrs;
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * LightboxGrid client assets - the overlay JS + CSS.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-lightbox-grid' => new Asset_Decl( 'lightbox/grid/lightbox-grid.css' ),
			),
			array(
				'fotogrids-lightbox-grid' => new Asset_Decl(
					'../../assets/js/lightbox-grid.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}
}
