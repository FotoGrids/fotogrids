<?php
declare(strict_types=1);

namespace FotoGrids\Render\Layouts;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Grid layout module.
 *
 * Opt-in capabilities:
 *   - enforces_item_box  : --fg-item-aspect-ratio + --fg-item-fit
 *   - uses_columns       : --fg-cols / --fg-col-min / --fg-col-max,
 *                          plus data-fg-columns-mode
 *   - uses_item_spacing  : --fg-gap
 *
 * Everything those capabilities cover is contributed by
 * Layout_Wrapper_Composer; the layout class only owns its own inner
 * HTML, asset deps, and the data-fg-items-root marker used by
 * pagination-core.js to know where to append/replace new items.
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Grid implements Layout {

	public function id(): string {
		return 'fotogrids/grid';
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

	public function layout_key(): string {
		return 'grid';
	}

	public function supports( Render_Context $render_context ): bool {
		return 'grid' === $render_context->layout->layout_id;
	}

	public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
		$items_html = '';
		foreach ( $render_context->items as $item_view ) {
			$items_html .= $item_renderer->render( $item_view, $render_context );
		}

		// data-fg-items-root marks this element as the container that
		// pagination-core.js can append/replace items inside.
		return '<div class="fg-grid-track" data-fg-items-root="true">' . $items_html . '</div>';
	}

	public function structural_classes( Render_Context $render_context ): array {
		return array();
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			css: array(
				'fotogrids-render-base' => new Asset_Decl(
					path: 'base/collection-base.css'
				),
				'fotogrids-layout-grid' => new Asset_Decl(
					path: 'layouts/grid/grid.css'
				),
			)
		);
	}

	public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
		return null;
	}

	public function requires_thumbnail_size( Render_Context $render_context ): bool {
		return false;
	}

	public function capabilities(): array {
		return array(
			'enforces_item_box' => true,
			'uses_columns'      => true,
			'uses_item_spacing' => true,
		);
	}
}
