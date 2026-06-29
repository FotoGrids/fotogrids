<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Mini_Viewer;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Lightbox Mini viewer feature.
 *
 * A lightweight single-image overlay: the clicked image centred over a
 * dimmed backdrop, with previous / next arrows, optional bullets, and a
 * close button. It is the "mini" lightbox variant, chosen per gallery via
 * the Item Click Behavior > Lightbox Style selector.
 *
 * It stamps the item list and the lightbox_mini_* appearance settings on
 * the gallery wrapper; the JS reads them when a lightbox-trigger item is
 * clicked. Active only when the resolved lightbox variant is 'mini'
 * (variant-eligible layouts, never albums).
 *
 * @package FotoGrids\Render\Lightbox\MiniViewer
 * @since   1.0.0
 */
final class Lightbox_Mini_Viewer implements Feature {

	public function id(): string {
		return 'fotogrids/lightbox-mini-viewer';
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
	 * Active when the resolved lightbox variant is 'mini'. Albums never use it.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		return 'mini' === $render_context->behavior->lightbox_variant;
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
	 * Stamp the item list, appearance settings, and chrome colours the mini
	 * overlay JS reads on click.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		$items = array();
		foreach ( $render_context->items as $item_view ) {
			$is_video = 'image' !== $item_view->item_type;
			$items[]  = array(
				'id'          => $item_view->id,
				'full'        => '' !== $item_view->full_url ? $item_view->full_url : $item_view->thumb_url,
				'thumb'       => $item_view->thumb_url,
				'alt'         => $item_view->alt,
				'title'       => $item_view->title,
				'caption'     => '' !== $item_view->caption_title ? $item_view->caption_title : $item_view->caption,
				'description' => $item_view->description,
				'video'       => $is_video,
			);
		}

		$theme = is_string( $settings['lightbox_mini_theme'] ?? null ) && 'light' === $settings['lightbox_mini_theme']
			? 'light'
			: 'dark';

		$blur = is_string( $settings['lightbox_mini_overlay_blur'] ?? null )
			&& in_array( $settings['lightbox_mini_overlay_blur'], array( 'light', 'strong', 'none' ), true )
			? $settings['lightbox_mini_overlay_blur']
			: 'light';

		$attrs = array(
			'data-fg-mini-items'   => wp_json_encode( $items ),
			'data-fg-mini-theme'   => $theme,
			'data-fg-mini-close'   => empty( $settings['lightbox_mini_show_close'] ) ? '0' : '1',
			'data-fg-mini-arrows'  => empty( $settings['lightbox_mini_show_arrows'] ) ? '0' : '1',
			'data-fg-mini-bullets' => empty( $settings['lightbox_mini_show_bullets'] ) ? '0' : '1',
			'data-fg-mini-overlay' => empty( $settings['lightbox_mini_show_overlay'] ) ? '0' : '1',
			'data-fg-mini-blur'    => $blur,
			'data-fg-mini-border'  => empty( $settings['lightbox_mini_show_border'] ) ? '0' : '1',
			'data-fg-mini-shadow'  => empty( $settings['lightbox_mini_show_shadow'] ) ? '0' : '1',
			'data-fg-mini-radius'  => empty( $settings['lightbox_mini_show_radius'] ) ? '0' : '1',
		);

		if ( ! empty( $settings['lightbox_lite_caption_show'] ) ) {
			$attrs['data-fg-mini-captions']       = '1';
			$attrs['data-fg-mini-caption-source'] = is_string( $settings['lightbox_lite_caption_source'] ?? null )
				? $settings['lightbox_lite_caption_source']
				: 'caption';
		}

		// The overlay renders in <body>, outside the wrapper, so it reads the
		// padding from this attribute rather than inheriting a CSS variable.
		$attrs['data-fg-mini-padding'] = $this->padding_css( $render_context );

		return $attrs;
	}

	/**
	 * Resolve the desktop padding value from the responsive padding setting.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return string CSS length (e.g. "24px").
	 */
	private function padding_css( Render_Context $render_context ): string {
		$padding = $render_context->settings['lightbox_mini_padding'] ?? null;
		$value   = 24;
		$unit    = 'px';

		if ( is_array( $padding ) ) {
			$desktop = $padding['desktop'] ?? null;
			if ( is_array( $desktop ) ) {
				$value = isset( $desktop['value'] ) ? (int) $desktop['value'] : $value;
				$unit  = is_string( $desktop['unit'] ?? null ) ? $desktop['unit'] : $unit;
			} elseif ( is_numeric( $desktop ) ) {
				$value = (int) $desktop;
			}
		}

		return $value . $unit;
	}

	/**
	 * Padding custom property, fed from the responsive padding setting's
	 * desktop value.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return array<string, string>
	 */
	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * Mini viewer client assets.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-lightbox-mini-viewer' => new Asset_Decl( 'lightbox/mini-viewer/lightbox-mini-viewer.css' ),
			),
			array(
				'fotogrids-lightbox-mini-viewer' => new Asset_Decl(
					'../../assets/js/lightbox-mini-viewer.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}
}
