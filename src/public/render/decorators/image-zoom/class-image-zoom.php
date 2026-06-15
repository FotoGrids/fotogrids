<?php
/**
 * Image Zoom decorator.
 *
 * @package FotoGrids\Render\Decorators\Image_Zoom
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Image_Zoom;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Enlarges gallery images on hover or click, either inline or in a popover.
 *
 * Active when interactions_zoom is on for a gallery render. Two styles:
 * inline transforms the image in place (hover-triggered, CSS only); popover
 * opens the shared Lightbox Mini overlay with the full-size image, triggered
 * on hover (after interactions_zoom_hover_delay) or click.
 *
 * The wrapper carries data-fg-zoom-style and, for popover, data-fg-zoom-mode
 * so CSS and the frontend module can branch. Popover appearance settings are
 * emitted as Lightbox Mini CSS variables on the wrapper.
 *
 * @package FotoGrids\Render\Decorators\Image_Zoom
 * @since   1.0.0
 */
final class Image_Zoom implements Decorator {

	use Setting_Helpers;

	public function id(): string {
		return 'fotogrids/image-zoom';
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
	 * Active for galleries with zoom enabled. Albums never zoom.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		return $this->setting_to_bool( $render_context->settings['interactions_zoom'] ?? false );
	}

	/**
	 * Stamps the full-size image URL on each item.
	 *
	 * Both styles use the full-size source resolved from the Media tab's
	 * full_image_size setting: the popover displays it, and inline pans across
	 * it on mousemove.
	 *
	 * @since   1.0.0
	 * @param   array<int, Item_View> $collection_items Collection items.
	 * @param   Render_Context        $render_context   Render context.
	 * @return  array<int, Item_View>
	 */
	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		$decorated = array();

		foreach ( $collection_items as $item_view ) {
			if ( 'image' !== $item_view->item_type ) {
				$decorated[] = $item_view;
				continue;
			}

			$full_url = $item_view->full_url ?: $item_view->thumb_url;

			$decorated[] = $item_view->with(
				array(
					'data_attrs' => array_merge(
						$item_view->data_attrs,
						array( 'data-fg-zoom-full' => esc_url( $full_url ) )
					),
				)
			);
		}

		return $decorated;
	}

	/**
	 * Writes zoom style (and, for popover, mode) on the gallery wrapper.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$style = $this->zoom_style( $render_context );
		$attrs = array( 'data-fg-zoom-style' => $style );

		if ( 'popover' === $style ) {
			$settings = $render_context->settings;

			$attrs['data-fg-zoom-mode']          = $this->zoom_mode( $render_context );
			$attrs['data-fg-zoom-close-button']  = $this->setting_to_bool( $settings['interactions_zoom_popover_close_button'] ?? true ) ? '1' : '0';
			$attrs['data-fg-zoom-click-outside'] = $this->setting_to_bool( $settings['interactions_zoom_popover_click_outside_to_close'] ?? true ) ? '1' : '0';
		}

		return $attrs;
	}

	/**
	 * Emits the hover delay and, for popover, the Lightbox Mini appearance vars.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function style_vars( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		$vars = array(
			'--fg-zoom-hover-delay' => $this->setting_scalar( $settings['interactions_zoom_hover_delay'] ?? null, '300' ) . 'ms',
		);

		if ( 'popover' !== $this->zoom_style( $render_context ) ) {
			return $vars;
		}

		$vars['--fg-lb-mini-backdrop']      = $this->setting_scalar( $settings['interactions_zoom_popover_bg'] ?? null, 'rgba(0, 0, 0, 0.2)' );
		$vars['--fg-lb-mini-backdrop-blur'] = $this->setting_scalar( $settings['interactions_zoom_popover_bg_blur'] ?? null, '8' ) . 'px';
		$vars['--fg-lb-mini-padding']       = $this->setting_scalar( $settings['interactions_zoom_popover_padding'] ?? null, '24' ) . 'px';

		return $vars;
	}

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		$is_popover = 'popover' === $this->zoom_style( $render_context );

		$css = array(
			'fotogrids-decorator-image-zoom' => new Asset_Decl(
				path: 'decorators/image-zoom/image-zoom.css',
			),
		);

		$image_zoom_deps = array( 'fotogrids-runtime' );
		if ( $is_popover ) {
			$image_zoom_deps[] = 'fotogrids-lightbox-mini';
		}

		$js = array(
			'fotogrids-image-zoom' => new Asset_Decl(
				path:      '../../assets/js/image-zoom.js',
				deps:      $image_zoom_deps,
				in_footer: true,
			),
		);

		if ( $is_popover ) {
			$css['fotogrids-lightbox-mini'] = new Asset_Decl(
				path: 'lightbox/mini/lightbox-mini.css',
			);
			$js['fotogrids-lightbox-mini']  = new Asset_Decl(
				path:      '../../assets/js/lightbox-mini.js',
				deps:      array( 'fotogrids-runtime' ),
				in_footer: true,
			);
		}

		return new Module_Assets( css: $css, js: $js );
	}

	/**
	 * Resolves the zoom style, defaulting to inline.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string 'inline'|'popover'
	 */
	private function zoom_style( Render_Context $render_context ): string {
		$style = $this->setting_scalar( $render_context->settings['interactions_zoom_style'] ?? null, 'inline' );
		return 'popover' === $style ? 'popover' : 'inline';
	}

	/**
	 * Resolves the popover trigger mode, defaulting to hover.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string 'hover'|'click'
	 */
	private function zoom_mode( Render_Context $render_context ): string {
		$mode = $this->setting_scalar( $render_context->settings['interactions_zoom_mode'] ?? null, 'hover' );
		return 'click' === $mode ? 'click' : 'hover';
	}
}
