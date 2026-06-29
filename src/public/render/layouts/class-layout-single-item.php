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
 * Single Item layout module.
 *
 * Renders one item from the gallery as a full-width hero. The item is
 * picked by the active sorter (Context_Builder slices the sorted ID list
 * to length 1 for this layout), so:
 *
 *   - sort=manual  -> the first manually-ordered item
 *   - sort=random  -> a different random item per request
 *   - sort=date    -> the earliest/latest by date
 *   - sort=title   -> the first by title order
 *
 * When Animate Images (auto progress) is enabled the full sorted set is
 * rendered stacked instead, and layout-single-item.js cycles through the
 * items on a timer with an optional progress bar / spinner indicator.
 *
 * The image renders at fotogrids_full size (also enforced upstream) so
 * the <picture> srcset has full-resolution candidates available for
 * high-DPI displays. All standard decorators (Lightbox, Sharing, hover
 * effects, etc.) still apply.
 *
 * Opt-in capabilities:
 *   - enforces_item_box : --fg-item-aspect-ratio / --fg-item-fit /
 *                         data-fg-natural-ratio (when ratio = None)
 *   - lightbox_extends  : data-fg-lightbox-extended + total-items +
 *                         render-url + nonce, when click=lightbox and
 *                         the user picked lightbox_scope=gallery
 *
 * Opt-out capabilities:
 *   - paginates : false (only one item is ever rendered)
 *   - filters   : false (nothing meaningful to filter a single image)
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Single_Item implements Layout {

	public function id(): string {
		return 'fotogrids/single-item';
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
		return 'single-item';
	}

	public function supports( Render_Context $render_context ): bool {
		return 'single-item' === $render_context->layout->layout_id;
	}

	public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
		$animates   = $this->animates( $render_context );
		$items_html = '';
		$index      = 0;

		foreach ( $render_context->items as $item_view ) {
			$view = $item_view;

			// Stacked items start hidden so there is no flash of every image
			// before the JS reveals the active one; the first stays visible.
			if ( $animates && $index > 0 ) {
				$view = $item_view->with(
					array(
						'classes' => array_merge( $item_view->classes, array( 'fg-item-hidden' ) ),
					)
				);
			}

			$items_html .= $item_renderer->render( $view, $render_context );
			++$index;
		}

		$root_attr = $animates ? ' data-fg-items-root="true"' : '';

		return '<div class="fg-single-item-track"' . $root_attr . '>' . $items_html . '</div>';
	}

	public function structural_classes( Render_Context $render_context ): array {
		return array();
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		if ( ! $this->animates( $render_context ) ) {
			return array();
		}

		$s = $render_context->settings;

		// Progress Indicator, Bar Location and Pause on Hover are not exposed
		// in the Single Item admin yet, so the indicator defaults to none and
		// hover pausing stays off - the deck simply cross-fades on the timer.
		return array(
			'data-fg-si-auto-progress'    => '1',
			'data-fg-si-delay'            => (string) max( 1, (int) ( $s['single_item_auto_progress_delay'] ?? 5 ) ),
			'data-fg-si-progress-style'   => self::sanitize_choice(
				$s['single_item_auto_progress_style'] ?? 'none',
				array( 'bar', 'spinner', 'none' ),
				'none'
			),
			'data-fg-si-progress-bar-loc' => self::sanitize_choice(
				$s['single_item_auto_progress_bar_location'] ?? 'bottom',
				array( 'top', 'right', 'bottom', 'left' ),
				'bottom'
			),
			'data-fg-si-pause-on-hover'   => ! empty( $s['single_item_auto_progress_pause_on_hover'] ) ? '1' : '0',
		);
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		$css = array(
			'fotogrids-render-base'        => new Asset_Decl( 'base/collection-base.css' ),
			'fotogrids-layout-single-item' => new Asset_Decl( 'layouts/single-item/single-item.css' ),
		);

		$js = array();
		if ( $this->animates( $render_context ) ) {
			$js['fotogrids-layout-single-item'] = new Asset_Decl(
				'../../assets/js/layout-single-item.js',
				array( 'fotogrids-runtime' ),
				true,
			);
		}

		return new Module_Assets( $css, $js );
	}

	/**
	 * Whether Animate Images (auto progress) is enabled for this render.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Active render context.
	 * @return bool
	 */
	private function animates( Render_Context $render_context ): bool {
		return ! empty( $render_context->settings['single_item_auto_progress'] );
	}

	/**
	 * Returns $value when it is one of $allowed, otherwise $default_value.
	 *
	 * @since 1.0.0
	 * @param mixed    $value         Raw setting value.
	 * @param string[] $allowed       Allowed string values.
	 * @param string   $default_value Fallback when $value is not allowed.
	 * @return string
	 */
	private static function sanitize_choice( $value, array $allowed, string $default_value ): string {
		$value = is_string( $value ) ? $value : '';
		return in_array( $value, $allowed, true ) ? $value : $default_value;
	}

	public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
		return \FotoGrids\Image_Size_Manager::SLUG_FULL;
	}

	public function requires_thumbnail_size( Render_Context $render_context ): bool {
		return false;
	}

	public function capabilities(): array {
		return array(
			'enforces_item_box' => true,
			'lightbox_extends'  => true,
			'paginates'         => false,
			'filters'           => false,
		);
	}
}
