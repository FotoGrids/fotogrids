<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Grid;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Setting_Helpers;

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
 *      (data-fg-grid-items), the dark / light theme (data-fg-lb-theme), and
 *      the gallery's click behaviour so grid tiles can replay it.
 *
 * Activation is per-render: active only on Featured Item galleries that
 * have more items than the layout shows inline (so a Show all button is
 * present). Albums never use it.
 *
 * @package FotoGrids\Render\Lightbox\Grid
 * @since   1.0.0
 */
final class Lightbox_Grid implements Feature {

	use Setting_Helpers;

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

		// Featured Item always uses the grid: the auto "Show all" button (when
		// the gallery overflows its inline display) and clicking any inline
		// item both open it.
		if ( 'featured-item' === $render_context->layout->layout_id ) {
			return true;
		}

		// On the variant-eligible layouts the grid is the chosen click target:
		// clicking any item opens the grid overlay.
		return 'grid' === $render_context->behavior->lightbox_variant;
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
				'id'          => $item_view->id,
				'full'        => '' !== $item_view->full_url ? $item_view->full_url : $item_view->thumb_url,
				'thumb'       => $thumb,
				'alt'         => $item_view->alt,
				'title'       => $item_view->title,
				'caption'     => '' !== $item_view->caption_title ? $item_view->caption_title : $item_view->caption,
				'description' => $item_view->description ?? '',
				'video'       => $is_video,
				'w'           => $item_view->full_width ?? $item_view->width,
				'h'           => $item_view->full_height ?? $item_view->height,
			);
		}

		$is_featured = 'featured-item' === $render_context->layout->layout_id;

		$attrs = array(
			'data-fg-grid-items' => wp_json_encode( $items ),
			// The gallery's click behaviour, so grid tiles replay it.
			'data-fg-grid-click' => (string) $render_context->behavior->click_behavior,
		);

		// On Featured Item the grid opens from the "Show all" button; on the
		// variant-eligible layouts clicking any item opens the grid directly.
		if ( ! $is_featured ) {
			$attrs['data-fg-grid-open-on-item'] = '1';
		}

		// Captions use the shared lightweight-lightbox caption settings (mini +
		// grid share these keys). Caption Location decides whether captions show
		// in the grid tiles, the full-size view, or both.
		if ( ! empty( $render_context->settings['lightbox_lite_caption_show'] ) ) {
			$location = $render_context->settings['lightbox_lite_caption_location'] ?? array( 'grid', 'full' );
			if ( is_string( $location ) ) {
				$decoded  = json_decode( $location, true );
				$location = is_array( $decoded ) ? $decoded : array( 'grid', 'full' );
			}
			if ( ! is_array( $location ) ) {
				$location = array( 'grid', 'full' );
			}

			$source                               = is_string( $render_context->settings['lightbox_lite_caption_source'] ?? null )
				? $render_context->settings['lightbox_lite_caption_source']
				: 'caption';
			$attrs['data-fg-grid-caption-source'] = $source;

			if ( in_array( 'grid', $location, true ) ) {
				$attrs['data-fg-grid-captions'] = '1';
			}
			if ( in_array( 'full', $location, true ) ) {
				$attrs['data-fg-grid-full-captions'] = '1';
			}
		}

		// Aspect ratio for grid tiles (empty = the layout's own ratio handling).
		$aspect = is_string( $render_context->settings['lightbox_grid_aspect_ratio'] ?? null )
			? $render_context->settings['lightbox_grid_aspect_ratio']
			: '';
		if ( '' !== $aspect ) {
			$attrs['data-fg-grid-aspect'] = $aspect;
		}

		// Max content width per breakpoint (the overlay renders outside the
		// wrapper, so the JS applies these rather than inheriting a CSS var).
		$max_raw                            = $render_context->settings['lightbox_grid_max_width'] ?? null;
		$attrs['data-fg-grid-maxw-desktop'] = $this->resolve_responsive_value( $max_raw, 'desktop', 'vw', '60vw' );
		$attrs['data-fg-grid-maxw-tablet']  = $this->resolve_responsive_value( $max_raw, 'tablet', 'vw', '80vw' );
		$attrs['data-fg-grid-maxw-mobile']  = $this->resolve_responsive_value( $max_raw, 'mobile', 'vw', '90vw' );

		// The grid carries its own dark / light theme. The overlay CSS assigns
		// the chrome colours from this attribute.
		$attrs['data-fg-lb-theme'] = is_string( $render_context->settings['lightbox_grid_theme'] ?? null )
			&& 'light' === $render_context->settings['lightbox_grid_theme']
			? 'light'
			: 'dark';

		// Optional per-state custom toolbar button colours, overriding the theme
		// palette. The overlay renders outside the wrapper, so these are passed
		// as attributes and the JS re-applies them as inline custom properties.
		foreach ( $this->custom_button_color_attrs( $render_context ) as $attr => $value ) {
			$attrs[ $attr ] = $value;
		}

		// Share config (only when sharing is enabled for the gallery). The
		// Sharing decorator already stamps data-fg-sharing on the wrapper
		// when sharing is on; the grid JS reads that same attribute, so we
		// don't duplicate it here - we only need to know whether to show the
		// toolbar share button, which the JS derives from data-fg-sharing.

		return $attrs;
	}

	/**
	 * Per-state custom toolbar button colours, as overlay data attributes.
	 *
	 * Returns an empty array unless the Custom Button Colors toggle is on.
	 * Each set colour is emitted as a data-fg-grid-btn-* attribute; the grid
	 * JS reads these and writes the matching inline custom properties onto the
	 * overlay, where they override the theme palette.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return array<string, string>
	 */
	private function custom_button_color_attrs( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		if ( ! $this->setting_to_bool( $settings['lightbox_grid_custom_btn_colors'] ?? null ) ) {
			return array();
		}

		$map = array(
			'lightbox_grid_btn_bg'                 => 'data-fg-grid-btn-bg',
			'lightbox_grid_btn_color'              => 'data-fg-grid-btn-color',
			'lightbox_grid_btn_border_color'       => 'data-fg-grid-btn-border-color',
			'lightbox_grid_btn_hover_bg'           => 'data-fg-grid-btn-hover-bg',
			'lightbox_grid_btn_hover_color'        => 'data-fg-grid-btn-hover-color',
			'lightbox_grid_btn_hover_border_color' => 'data-fg-grid-btn-hover-border-color',
			'lightbox_grid_btn_focus_bg'           => 'data-fg-grid-btn-focus-bg',
			'lightbox_grid_btn_focus_color'        => 'data-fg-grid-btn-focus-color',
			'lightbox_grid_btn_focus_border_color' => 'data-fg-grid-btn-focus-border-color',
		);

		$attrs = array();
		foreach ( $map as $key => $attr ) {
			$value = $settings[ $key ] ?? null;
			if ( is_string( $value ) && '' !== $value ) {
				$attrs[ $attr ] = $value;
			}
		}

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
